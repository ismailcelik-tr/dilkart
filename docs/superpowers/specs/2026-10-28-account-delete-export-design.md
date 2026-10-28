# Hesap silme ve veri dışa aktarma (Aşama 9c)

Tarih: 28 Eki 2026 · Durum: onaylandı

## Kapsam

- **Hesap silme:** web ve telefon (Apple 5.1.1(v)). Sunucuda SQL fonksiyonu (ADR 0011).
- **Dışa aktarma:** yalnız web; telefonda yalnız yönlendirme notu.

## Hesap silme

- Hesap ekranında "Hesabı sil" (`ButtonKind.Danger`, "Çıkış yap"ın altında).
- Onay (`ui/confirm`): başlık "Hesabı sil", metin "Hesabın, sunucudaki tüm kartların ve çalışma
  geçmişin kalıcı olarak silinecek. Geri alınamaz.", düğme "Hesabı sil".
- Onaydan sonra RPC `delete_account`; başarılıysa çıkıştaki yol: hesap veritabanı emekliye
  ayrılır, `signOut({ scope: "local" })`, misafir veritabanı açılınca hesap dosyası silinir.
  Telefondaki misafir verisi kalır; web oturumsuz ana sayfaya döner.
- RPC hatası (ağ yok ya da sunucu hatası): hiçbir şey silinmez, ekranda "Hesap silinemedi;
  bağlantını kontrol edip yeniden dene." (`ErrorText`).
- Diğer cihazlar: oturum yenilenemeyince düşer; o cihazdaki yerel kopya, kullanıcı çıkış yapana
  ya da oturum düşene kadar kalır. Sync'in yazmaları kullanıcı satırı olmadığı için yabancı anahtar
  hatasıyla reddedilir; sunucuda veri yeniden oluşmaz.

## Sunucu

- Migration `public.delete_account()`: `returns void`, `language sql`, `security definer`,
  `set search_path = ''`, gövde `delete from auth.users where id = auth.uid();`.
  `public` ve `anon`'dan `execute` geri alınır, `authenticated`'a verilir.
- pgTAP: silmeden sonra kullanıcının `user_settings`, `decks`, `cards`, `review_logs`,
  `applied_ops`, `card_conflicts` ve `auth.sessions` satır sayısı 0; başka kullanıcının satırları
  yerinde; `anon` çağıramaz. Plan bölüm 12: "Silme sonrası kullanıcıya ait satır sayısı 0".
- Prod'a `supabase db push` kullanıcı onayıyla (kullanıcı çalıştırır).

## Dışa aktarma (web)

- Hesap ekranında (web) "Verilerimi indir" → `dilkart-YYYY-MM-DD.json` (yerel gün).
- Kaynak tarayıcıdaki yerel veritabanı (henüz gönderilmemiş değişiklikler dahil); silinmiş
  (`deleted_at`) deste, kart ve kayıtlar yok.
- Biçim (`version: 1`):

  ```json
  {
    "app": "DilKart", "version": 1, "exportedAt": "2026-10-28T18:00:00.000Z",
    "settings": { "newPerDay": 20, "reviewsPerDay": 200, "dayStartHour": 4, "dailyGoal": 50, "accent": "en-US" },
    "decks": [{ "id": "…", "name": "Fiiller", "cards": [{
      "id": "…", "front": "go", "usageLabel": null, "meanings": [{ "tr": "gitmek" }],
      "exampleEn": null, "exampleTr": null, "isWeak": false }] }],
    "reviews": [{ "cardId": "…", "reviewedAt": "…", "rating": 3 }]
  }
  ```

  Ayarlar `UserSettings`, kart alanları `Card` tipinden; FSRS durumu yok (kayıtlardan yeniden
  hesaplanır). Kayıtlar yalnız canlı kartlarınki.
- Telefonda Hesap ekranında: "Verilerini dilkart.fly.dev'den indirebilirsin."

## Mimari

- Core `data/export.ts`: `exportData(store: LocalStore, lib: Library, settings: Settings, now: number)`
  → yukarıdaki nesne; `Library` (desteler, kartlar), `reviewsByCard(store)` ve `Settings`
  üzerinden okur; Vitest.
- App `services/library.tsx` `Account`: `deleteAccount(): Promise<boolean>` (RPC + çıkış yolu),
  `exportData(): Promise<string>` (JSON metni).
- App `drivers/download.web.ts`: `download(name, text)` (Blob + `<a download>`);
  `drivers/download.ts` mobilde çağrılmaz, hata atar.
- `AccountScreen`: iki düğme, not, hata metni; `IS_WEB` ile.

## Testler (önce başarısız test)

- pgTAP: yukarıdaki silme testleri.
- Core: `exportData` (silinmişler yok, deste altında kartlar, kayıtlar, ayarlar, `exportedAt`).
- App (Jest, sahte Supabase): onay → RPC çağrılır → oturumsuz ekran; RPC hatası → hata metni,
  oturum açık; web'de "Verilerimi indir" `download`'u `dilkart-….json` ile çağırır; telefonda
  not görünür, düğme yok.
- Elle: web'de indir + dosyayı aç; test hesabıyla web'de ve telefonda silme, Supabase'de
  kullanıcının gitmesi.
