# Hatırlatma bildirimi (Aşama 8, son parça)

Tarih: 28 Eki 2026 · Durum: onaylandı

## Amaç

Gün içinde çalışılmadıysa seçilen saatte yerel bildirimle hatırlatmak; seri sürüyorsa onu
korumaya çağırmak.

## Kurallar

- **Yalnız yerel:** `expo-notifications`, sunucu push yok (plan bölüm 4).
- **Saat:** `Kapalı · 09:00 · 12:00 · 18:00 · 20:00 · 21:00 · 22:00 · Özel…`, varsayılan 20:00.
  Özel: iOS saat çarkı (`@expo/ui` `DatePicker`), dakika hassasiyeti (28 Eki ek karar). Cihaza
  özel (`prefs`), sync edilmez (plan bölüm 2).
- **Planlama:** bugünden başlayarak 7 çalışma günü, her gün seçilen saatte tek seferlik
  bildirim. Çalışma günü `k`'nin bildirimi `dayStart(k) + ((dakika − dayStartHour·60) mod 1440)`
  anında; gün başlangıcından önceki saat (ör. 01:30) o çalışma gününün gece yarısı sonrasına
  düşer, "bugün" hep doğru gün.
  Bugünün bildirimi, bugün ≥1 cevap varsa ya da o an geçtiyse planlanmaz.
- **Yeniden planlama:** tüm planlı bildirimler silinip 7 gün yeniden kurulur. Tetikleyiciler:
  uygulama ön plana gelir (`active`), arka plana geçer (`background`), veri açılır (giriş /
  çıkış), saat ayarı değişir.
- **İzin:** güncellemeden sonra ana sayfa ilk yüklendiğinde iOS izni bir kez istenir (yalnız
  henüz sorulmadıysa). Reddedilirse Ayarlar satırı "Kapalı · iOS Ayarları'ndan izin ver"
  gösterir, dokununca `Linking.openSettings()`.
- **Dokunma:** bildirime dokununca uygulama açılır (ana sayfa); özel yönlendirme yok.
- **Reddedilen:** her gün tekrarlayan tek bildirim (çalışılan günü atlayamaz); arka plan görevi
  (iOS çalıştırmayı garanti etmez, yeni native modül); hedef tutmayı "çalıştın" saymak.

## Metin

Planlama anındaki duruma göre, o güne kadar çalışılmayacağı varsayımıyla. `d` = bugünden gün
farkı (0–6), `S` = `Stats.today().streak`, `studied` = bugün ≥1 cevap.

Seri o gün sürer: `S > 0` ve (`d = 0` ya da (`d = 1` ve `studied`)).

| Seri sürer | Başlık | Gövde (`N > 0`) | Gövde (`N = 0`) |
|---|---|---|---|
| evet | 🔥 S günlük serin bitmesin | Bugün N kart seni bekliyor | Birkaç kart çalış, seri sürsün |
| hayır | Çalışma zamanı | Bugün N kart seni bekliyor | Yeni bir seri başlat |

`N` = `due[0] + … + due[d]` (7 günlük tahmin; gecikmiş kartlar `due[0]`'da).

## Mimari

```
Ayarlar ─ ReminderScreen (/settings/reminder) ─┐
DataProvider (AppState active/background) ─────┴─ services/reminders.ts ─┬─ drivers/notifications.ts
                                                                         ├─ services/prefs.ts
                                                                         └─ core: Stats, reminderPlan
```

- **Core `stats/reminders.ts`:** saf `reminderPlan(input): Reminder[]`. Girdi `now`, `minute` (yerel gece yarısından dakika),
  `dayStartHour`, `tzOffsetMin`, `studied`, `streak`, `due: number[]`; çıktı
  `{ at: Date; title: string; body: string }[]` (≤7, artan). Kurallar ve metinler burada.
- **Core `Stats.due(): Promise<number[]>`:** 7 günlük tahmin; yalnız kart durumları, log yok.
  `report().forecast` ile aynı hesap.
- **Driver `drivers/notifications.ts`:** `expo-notifications` yalnız burada. `permission()`
  (`granted | denied | undetermined`), `requestPermission()`, `cancelAll()`,
  `schedule(at, title, body)`, `scheduledCount()`.
- **Servis `services/reminders.ts`:** `refresh()` = `cancelAll` + (saat açık ve izin varsa)
  `reminderPlan` sonucu kadar `schedule`. `askOnce()` = izin `undetermined` ise iste, sonra
  `refresh()`. Hatalar yutulur ve `console.warn` ile yazılır; hatırlatma uygulamayı bozmaz.
- **`prefs.ts`:** `reminderMinute(): Promise<number | null>` (yoksa 1200 = 20:00, `null` =
  kapalı), `rememberReminderMinute(minute | null)`.
- **Tetikleyiciler:** `DataProvider`'da `AppState` dinleyicisi (`active`, `background`) ve veri
  açılınca `refresh()`. Ana sayfa ilk yüklenince `askOnce()`.
- **Ayarlar:** yeni "Bildirim" grubu, "Hatırlatma" satırı (alt yazı saat, "Kapalı" ya da
  izin uyarısı). `ChooseScreen` senkronize `UserSettings`'e bağlı; cihaza özel ayar için ayrı
  küçük `ReminderScreen` (aynı `Row` listesi; en altta "Özel…": çark + "Kaydet"). Seçim
  sonrası `refresh()`.
- **Geliştirme:** `__DEV__` iken `ReminderScreen`'de "Test: 1 dk sonra" satırı, bugünkü metinle
  bir bildirimi 60 sn sonraya kurar (cihazda zamanlama denemesi için).
- **Kurulum:** `app.json` `plugins`'e `expo-notifications`. Expo Go iOS'ta yerel bildirim
  çalışır; release build yeni native modül için yeniden derlenir.

## Bilinen sınırlar (kabul)

- 7 gün uygulama açılmazsa bildirimler biter.
- Başka cihazda (web) çalışılan gün, telefon açılıp sync bitene kadar bilinmez; bugünün
  bildirimi yine gelebilir.
- Metin planlama anındaki seriyi ve tahmini taşır, gösterim anında güncellenmez.

## Testler (önce başarısız test)

Core (Vitest):
- `reminderPlan`: 7 öğe ve saatler; `studied` iken bugün yok; saat geçtiyse bugün yok; seri
  metni yalnız seri o gün sürerken (`d = 0`; `d = 1` ve `studied`); `N` birikimli; `N = 0`
  gövdeleri; 03:30'da (gün başlangıcı 04:00) çalışma günü hâlâ dün, onun 20:00'si geçmiş; ilk
  bildirim bu akşam 20:00, `d = 1`.
- `Stats.due()`: `report().forecast` ile aynı.

App (Jest, `drivers/notifications` mock'lu):
- Hatırlatma kapatılınca planlı bildirim sayısı 0 (plan bölüm 12).
- Saat değişince yeniden planlanır, yeni saatle (plan bölüm 12).
- İzin reddedilmişse Ayarlar satırı uyarıyı gösterir; planlama yok.
- İzin yalnız `undetermined` iken istenir.

Cihaz: Expo Go'da "Test: 1 dk sonra" ile bildirim gelir, dokununca uygulama açılır; Ayarlar
akışı. Onaydan sonra commit + push, telefona release build.
