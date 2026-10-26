# Zayıf kelime şeridi (Aşama 8, ikinci parça)

Tarih: 26 Eki 2026 · Durum: onaylandı

## Amaç

Sık yanlış yapılan kartları kullanıcıya önermek, kabul edilenleri ayrı bir pratik oturumunda
çalıştırmak ve düzelen kartı listeden kendiliğinden çıkarmak.

## Kurallar

- **Öneri** (mevcut `suggestWeak`, plan bölüm 16 madde 8): art arda ≥3 hata; ya da son 30
  günde ≥2 unutma ve son 8 tekrarda ≥%40 hata. Hata = "Tekrar" (Again).
- **Kabul / red kart kart:** önerilen her kart için kullanıcı karar verir. Kabul edilen kart
  zayıf olur; reddedilen kart 14 gün önerilmez.
- **Çıkış:** zayıf kart, `weak_since`'ten sonraki son 3 cevabın hiçbiri "Tekrar" değilse
  zayıflıktan çıkar. Her oturum türündeki cevap sayılır. Çıkan kart için 14 günlük bekleme
  yoktur; kural yeniden öneri üretebilir.
- **Zayıf kelime oturumu:** tüm destelerdeki zayıf kartlar, karışık sırada. Pratik sayılır
  (`SessionKind.Weak`, `scheduled = false`); FSRS zamanlaması değişmez.

## Veri

| Alan | Anlam | Yeni mi |
|---|---|---|
| `cards.is_weak` | kabul edilmiş zayıf kart | var |
| `cards.weak_since` | kabul anı; çıkış yalnız bundan sonraki cevaplara bakar | **yeni** |
| `cards.weak_dismissed_until` | reddedilen öneri bu ana kadar gösterilmez | var |

- Yerel: `localStore.ts` migration listesine yeni giriş (`ALTER TABLE cards ADD COLUMN
  weak_since TEXT`), `COLUMNS` haritasına `weak_since: Kind.Text`.
- Sunucu: yeni migration `alter table public.cards add column weak_since timestamptz;`.
  Sync RPC'leri sütunları genel işler, değişiklik gerekmez. Prod'a `supabase db push`
  kullanıcı onayıyla.
- Neden yeni sütun: `is_weak` yalnız evet/hayır. Unutma kuralıyla önerilen bir kartın son 3
  cevabı doğru olabilir; kabul anı bilinmezse kart bir sonraki doğru cevapta hemen çıkar.
  Elenen: `is_weak`'in sync alan saatinden okumak (sync iç ayrıntısı, kırılgan).

## Mimari

```
Ana sayfa şeridi ─┐
Öneri listesi ────┼─ useWeak (services) ─ Weak (core/src/data/weak.ts) ─ LocalStore
Çalış (weak) ─────┘                         ▲
Study.answer ───────────────────────────────┘ (çıkış kontrolü)
```

`Weak` repository (core):
- `suggestions(): Promise<Card[]>` — SQL önce son 30 günde "Tekrar" almış, zayıf olmayan ve
  reddi süresi geçmiş kartları seçer; bu adaylarda `suggestWeak` çalışır. Ana sayfa her
  açıldığında hesaplanır, saklanmaz.
- `cards(): Promise<Card[]>` — zayıf kartlar.
- `decide(accepted: string[], rejected: string[]): Promise<void>` — tek işlemde: kabul →
  `is_weak = true`, `weak_since = şimdi`; red → `weak_dismissed_until = şimdi + 14 gün`.
- `review(cardId: string): Promise<void>` — kart zayıfsa ve çıkış kuralı tutuyorsa
  `is_weak = false`, `weak_since = null`.

`Study.answer` log yazdıktan sonra `Weak.review` çağırır. Kural fonksiyonları (`weak/weak.ts`)
saf kalır; çıkış kuralı da oraya saf fonksiyon olarak eklenir.

## Ekranlar

- **Ana sayfa:** "Tümünü çalış"ın üstünde bir grup. "N zayıf kelime" (alt yazı "Çalış") →
  `/study?weak=1`; "M yeni öneri" → `/weak/suggestions`. Sıfır olan satır görünmez; ikisi
  sıfırsa grup görünmez.
- **`/weak/suggestions`:** her satır kelime + anlam, hepsi baştan ✓; dokununca ✓ değişir.
  "Onayla" → `decide` → ana sayfaya döner. Öneri yoksa "Öneri yok".
- **`/study?weak=1`:** üstte "Zayıf N", aynı modül listesi; "Başla" `SessionKind.Weak` ile
  oturum açar. Oturum ve eşleştirme ekranı `kind = weak` iken zayıf kartları karışık alır.
  Eşleştirme için ≥4 kart kuralı aynen geçerli.

## Testler (önce başarısız test)

Core (Vitest):
- `suggestions`: kuralı tutan kart gelir; zayıf, reddi süren ve hiç hata almamış kart gelmez
- `decide`: kabul edilen zayıf olur ve `weak_since` yazılır; reddedilen 14 gün gizlenir
- çıkış: `weak_since` sonrası 3 doğruyla çıkar; kabulden önceki doğrular sayılmaz;
  arada "Tekrar" sayacı sıfırlar
- `Study.answer` çıkışı tetikler; `SessionKind.Weak` cevabı zamanlamayı değiştirmez

Sync harness + pgTAP: `weak_since` iki istemci arasında gidip gelir; sütun RLS altında.

App (Jest):
- şerit sıfırda gizli, sayılar doğru
- öneri listesinde bir işaret kaldırılıp onaylanınca kart durumları doğru
- zayıf kelime oturumu yalnız zayıf kartları getirir

Cihaz: Expo Go'da gösterilir; onaydan sonra prod migration (onayla), commit + push,
telefona build.
