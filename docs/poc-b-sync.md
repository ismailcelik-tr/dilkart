# PoC-B: senkronizasyon

Tarih: 25 Eki 2026. Kod: `supabase/migrations` (şema, RLS, `sync_push`/`sync_pull`),
`packages/core/src/sync` (HLC, birleştirme, yerel depo, motor), `tools/sync-harness`
(iki istemcili senaryolar). Çalıştırma: `supabase start`, `supabase test db`, `pnpm test:sync`.

## Sonuçlar ve plan kriterleri (bölüm 12)

| Kriter | Sonuç | Durum |
|---|---|---|
| Idempotency: aynı paket 5 kez → tek kayıt | 1 kart, 1 log, 0 çakışma | ✅ |
| Farklı alanlar (web anlam, mobil deste) | ikisi de korunur; iki cihaz ve sunucu aynı | ✅ |
| Aynı alan eşzamanlı | büyük HLC kazanır, kaybeden `card_conflicts`'ta; iki varış sırası da test edildi | ✅ |
| Silme vs. sonraki düzenleme | silme kazanır, her yerde tombstone | ✅ |
| İki cihazda çevrimdışı tekrar | 30 + 20 → sunucuda ve iki cihazda 50 | ✅ |
| Çevrimdışı 100 değişiklik + yeniden başlatma | dosya kapatılıp açıldı; 100'ü sunucuda, kopya yok, ≤60 sn | ✅ |
| Misafir 50 kart → hesap | 50 kart aynı kimliklerle | ✅ |
| Eski istemci şeması | `DK001` → `UpgradeRequired`; veri cihazda kalır | ✅ |
| İlk sync 5.000 kart + 50.000 log ≤30 sn | çekme 0,7 sn (gönderme 4,3 sn), yerel Docker | ✅ (aşağıdaki not) |
| RLS izolasyonu | pgTAP 16 test: okuma, sahte `user_id`, anon, değişmez log, hard delete yok | ✅ |
| FSRS durumu iki cihazda bit düzeyinde aynı | ölçülmedi; log kümelerinin eşitliği kanıtlandı | ⏭ Aşama 3 |

Testler: pgTAP 38, core Vitest 34 (sync), harness 10 senaryo. Hepsi CI'da (`sync` job).

Not: süreler Mac'te yerel Supabase'e karşı; ağ gecikmesi yok. Free planda 56 sayfa ×
gidiş-dönüş eklenir; Aşama 7'de prod'a karşı duman testinde yeniden ölçülmeli.

## Tasarım kararları (PoC'de verildi)

- **Tek sequence:** tüm tablolar `sync_seq`'ten `server_seq` alır → istemcide tek imleç.
- **Kullanıcı başına kilit:** `sync_push` `pg_advisory_xact_lock(uid)` alır; aynı
  kullanıcının push'ları sıralanır, böylece geç commit olan küçük bir `server_seq` imlecin
  gerisinde kalmaz.
- **Çakışmanın tanımı:** her işlem, yazanın gördüğü alan saatini (`base`) taşır. Sunucudaki
  saat `base`'den farklıysa ve değerler farklıysa eşzamanlıdır → kaybeden kaydedilir. Aynı
  cihazdan ardışık düzenlemeler çakışma sayılmaz.
- **Tombstone:** düzenlemeye her zaman üstün; iki silmeden HLC'si küçük olan kalır (iki
  taraf aynı sonuca varır).
- **Tekrar logları `applied_ops`'a yazılmaz:** kimlikle ve yalnız ekleme, zaten idempotent
  (bölüm 7'den sapma; 50k logda 50k satır tasarrufu).
- **Çakışma kaydı yalnız kartlarda:** deste ve ayarlarda alan bazlı LWW, kayıt yok.
- **Değişmeyen satır yeniden yazılmaz:** kaybeden işlem `server_seq`'i ilerletmez.
- **Ayarlar:** sunucuda `user_id` anahtarlı; cihazda tek satır (`SETTINGS_ID`).
- **Sync motoru `core`'da:** uygulama Aşama 7'de aynı motoru `expo-sqlite` ve `supabase-js`
  sürücüleriyle kullanır; harness'taki `remote.ts` o zaman `apps/app/src/drivers`'a taşınır.
- **Sayfa boyutu:** `PULL_PAGE` PostgREST `max_rows`'u (1000) aşmamalı; aşarsa kesilen
  sayfa çekmeyi erken bitirir.

## Bilinen eksikler ve riskler

- **Zehirli işlem:** sunucunun her seferinde reddettiği tek bir işlem outbox'ı kilitler
  (bölme tek işleme iner ve hata verir). Aşama 7 öncesi karar: ayrı "başarısız" kuyruğu mu?
- **İleri kaymış cihaz saati:** saati günler ileride olan bir cihazın yazdığı alan, düzeltme
  gelene kadar kazanır. HLC'ye azami sapma sınırı (ör. 1 gün) eklenebilir.
- **Doğrudan tablo yazımı:** RLS kendi satırlarına `insert`/`update`'e izin veriyor; istemci
  RPC'yi atlayıp LWW'yi bozabilir (yalnız kendi verisi). Sertleştirme: tablo yazma yetkisini
  kaldırıp RPC'yi `SECURITY DEFINER` + `auth.uid()` kontrolüyle çalıştırmak (bölüm 10'daki
  `SECURITY INVOKER` kararından sapma; Aşama 10'da).
- **Büyüyen tablolar:** `applied_ops` ve `card_conflicts` için temizlik yok; 30 günlük
  tombstone temizliği de yok (Aşama 10).
- **Kapsam dışı:** dolu hesaba girişteki "kartları ekle/bırak" sorusu, `user_<uid>.sqlite`
  dosyaları, arka plan zamanlayıcısı (`retryDelay` hazır), FSRS yeniden oynatma.
- **Yerel ayar:** `config.toml`'da `sign_in_sign_ups = 1000` (harness her senaryoda kayıt
  açar); prod ayarı değil.

## Karar önerisi

ADR 0002'deki yaklaşım plan kriterlerini yerelde karşılıyor. "PoC-B ile doğrulandı" olarak
işaretlenir; prod gecikmesi Aşama 7'de ölçülür.
