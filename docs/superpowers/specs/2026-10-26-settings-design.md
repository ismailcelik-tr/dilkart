# Ayarlar sayfası (Aşama 8, ilk parça)

Tarih: 26 Eki 2026 · Durum: onaylandı

## Amaç

Çalışma ayarlarını kullanıcıya açmak ve sync ile cihazlar arasında taşımak. Bugün `Study`
sabit varsayılanlarla çalışıyor (`openData.ts`), aksan sabit ABD (`services/speech.ts`).

## Kapsam

| Ayar | Seçenekler | Varsayılan | Saklama |
|---|---|---|---|
| Günlük yeni kart | 5, 10, 20, 30, 50 | 20 | `user_settings.daily_new_limit` |
| Günlük tekrar | 50, 100, 200, 500, Sınırsız | 200 | `user_settings.daily_review_limit` |
| Gün başlangıcı | 00:00–06:00, saat başı | 04:00 | `user_settings.day_start_hour` |
| Aksan | ABD, İngiliz | ABD | `user_settings.tts_accent` (`en-US`, `en-GB`) |
| Koyu görünüm | açık / kapalı | sistem | cihaza özel, `prefs.ts` (değişmez) |
| Gönderilemeyen değişiklik | yalnız gösterim | — | `outbox_failed` sayısı |

- "Sınırsız" tekrar `9999` olarak saklanır (sütun `smallint`).
- `null` alan varsayılan demektir. Migration gerekmez; tablo ve sync hazır.
- Kapsam dışı: hedef hatırlama (`desired_retention`, %90 kalır), gönderilemeyenlerin
  ayrıntı sayfası.

## Mimari

Ayarlar her kullanımda veritabanından okunur; tek doğruluk kaynağı yerel `user_settings`
satırıdır. Sync ile gelen değer bir sonraki okumada geçerli olur, bayat kopya tutulmaz.

```
SettingsScreen ─ useSettings (services) ─ Settings (core/src/data) ─ LocalStore
Study.plan / answer ───────────────────── Settings.get()
useSpeech ─────────── useSettings ─────── Settings.get()
```

- **`Settings` (core):** `get(): Promise<UserSettings>` satırı okur, boş alanlara varsayılan
  koyar. `set(changes)` `LocalStore.write(Table.Settings, SETTINGS_ID, …)` ile yazar
  (LWW + outbox).
- **`Study`:** yapıcıdaki sabit `StudySettings` yerine `Settings`'ten okur; yeni limit,
  `Study` yeniden yaratılmadan uygulanır. `desiredRetention` sayfada olmadığı için
  `Scheduler` bugünkü gibi kurulur.
- **`useSpeech`:** aksanı ayardan alır.

## Misafirden hesaba geçiş

`adoptGuest` ayarları alan alan taşır: hesapta `null` olan alan misafirin değerini alır,
hesapta dolu alan korunur. Yeni hesapta misafir ayarlarının hepsi gelir. Kullanıcı
"ayrı tut" derse ayarlar da taşınmaz (bugünkü akış `adoptGuest`'i hiç çağırmaz).

## Ekranlar

- **Ana sayfa:** üstte "Tümünü çalış", "Yeni deste"; ortada desteler; altta "Hesap",
  "Ayarlar", "Hakkında". Deste yoksa bugünkü "Deste oluştur" görünümü kalır. Koyu görünüm
  anahtarı ana sayfadan kalkar.
- **`/settings`:** gruplar Çalışma (yeni, tekrar, gün başlangıcı), Ses (aksan), Görünüm
  (koyu görünüm), Sync (gönderilemeyen; yalnız hesap açıkken ve sayı > 0 iken, dokunulmaz).
  Satırın alt yazısı güncel değer ("20", "Sınırsız", "04:00", "ABD").
- **`/settings/choose?field=…`:** tek genel seçim sayfası; seçili değerde ✓, dokununca
  kaydeder ve geri döner.

## Testler (önce başarısız test)

Core (Vitest):
- satır yokken varsayılanlar
- `set` → `get` aynı değeri verir, outbox'a işlem düşer
- `Study` yeni limiti yeniden yaratılmadan uygular; "Sınırsız" tekrar
- `adoptGuest`: misafir ayarı yalnız boş alana taşınır

App (Jest):
- sayfa varsayılanları gösterir; 30 seçilince satır ve veritabanı güncellenir
- İngiliz aksanında `speak` `en-GB` ile çağrılır
- gönderilemeyen satırı 0'da gizli, > 0'da görünür
- ana sayfa buton sırası; koyu görünüm testi Ayarlar sayfasına taşınır

Cihaz: Expo Go'da gösterilir; onaydan sonra commit + push ve release build kurulumu.
