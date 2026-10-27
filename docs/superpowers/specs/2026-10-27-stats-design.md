# İstatistik sayfası ve seri satırı (Aşama 8, üçüncü parça)

Tarih: 27 Eki 2026 · Durum: onaylandı

## Amaç

Çalışma geçmişini tek sayfada göstermek ve ana sayfada seri + günlük hedefle kullanıcıyı her
gün çalışmaya itmek.

## Kurallar

- **Kapsam:** tüm desteler toplamı; deste seçici yok.
- **Seri:** en az bir cevap verilen çalışma günü seriye sayılır (hedef tutmasa da). Bugün
  henüz çalışılmadıysa dünkü seri gün bitene kadar sürer (mevcut `streak`).
- **Cevap:** yeni, tekrar ve pratik (zayıf kelime oturumu dahil) her cevap; `dailyCounts` ile
  aynı.
- **Günlük hedef:** günde verilen cevap sayısı. Seçenekler `Kapalı · 20 · 50 · 100 · 200`,
  varsayılan 50. Seriyi etkilemez; yalnız ilerleme gösterir.
- **Gün:** `dayStartHour` ayarı ve cihazın şu anki saat dilimi. `review_logs.tz_offset_min`
  kullanılmaz; seyahatte seri bir gün kayabilir (kabul).
- **Grafikler:** düz `View` çubukları; grafik kütüphanesi ve `react-native-svg` yok.

## Veri

| Alan | Anlam | Yeni mi |
|---|---|---|
| `user_settings.daily_goal` | günlük cevap hedefi; `0` = kapalı, `null` = varsayılan 50 | **yeni** |

- Yerel: `localStore.ts` migration listesine `ALTER TABLE user_settings ADD COLUMN daily_goal
  INTEGER`, `COLUMNS` haritasına `daily_goal: Kind.Int`.
- Sunucu: yeni migration `alter table public.user_settings add column daily_goal smallint;`.
  Sync RPC'leri sütunları genel işler. Prod'a `supabase db push` kullanıcı onayıyla, telefona
  kurulumdan önce (prod'da sütun yoksa sync alanı sessizce düşürür).
- Misafir → hesap: `adopt.unsetSettings` alanları genel taşır; ek kod yok.
- Core `UserSettings.dailyGoal`, `COLUMN.dailyGoal = "daily_goal"`, `DEFAULT_SETTINGS.dailyGoal
  = 50`.

## Mimari

```
StreakRow (ana sayfa) ─┐
StatsScreen (/stats) ──┴─ useStats (services) ─ Stats (core/src/data/stats.ts) ─ LocalStore
                                                  │
                                                  └─ stats/stats.ts (saf fonksiyonlar)
```

`LocalStore.answersPerDay(dayStartHour, tzOffsetMin): Promise<{ day: number; count: number }[]>`
- Gün numarasını SQL'de `dayKey` formülüyle hesaplar, `GROUP BY` ile sayar. Ana sayfaya log
  satırı değil, gün başına bir sayı gelir.

`Stats` repository (`store`, `settings`, `now`, `tzOffsetMin` alır; saat dilimi varsayılanı
cihaz):
- `today(): Promise<Today>` — `{ streak: number; answers: number; goal: number }`. `streak`
  şu anki seri, `answers` bugünkü cevap, `goal` ayar (0 = kapalı). Kaynak: `answersPerDay`.
- `report(): Promise<Report>`:
  - `streak: { current, longest }`, `daily: number[]` (30 gün, eskiden yeniye): `answersPerDay`
  - `goal`
  - `retention7`, `retention30`: tüm loglar karta göre gruplanıp `retention`'a
  - `states: StateCounts`, `forecast: number[]` (7 gün): kartların `fsrs_state` önbelleği

`stats/stats.ts`: `streak` gün listesinden hesaplayan saf çekirdeğe ayrılır
(`streakOfDays(days, today)`); log alan mevcut imza onu çağırır, iki yol aynı kuralı kullanır.

## Ekranlar

- **Ana sayfa** (en az bir deste varken): `WeakStrip` → **`StreakRow`** → "Tümünü çalış" →
  "Yeni deste" → desteler. Alttaki düğmeler: **İstatistikler** · Hesap · Ayarlar · Hakkında.
  `stats.today()` destelerle aynı `useLoad` içinde yüklenir.
- **`StreakRow`** (`features/stats/StreakRow.tsx`), dokununca `/stats`:

  | Durum | Başlık | Alt yazı |
  |---|---|---|
  | `answers > 0`, hedef tutmadı | 🔥 5 gün seri | Bugün 32/50 cevap |
  | hedef tuttu | 🔥 5 gün seri | Hedef tamam: 62/50 ✓ |
  | `streak > 0`, `answers = 0` | 🔥 5 gün seri | Bugün çalışırsan 6 olur · 0/50 |
  | `streak = 0` | Seriyi başlat | Bugün 0/50 cevap |

  Hedef kapalıyken alt yazıda `/50` kısmı ve "Hedef tamam" durumu yok ("Bugün 32 cevap",
  "Bugün çalışırsan 6 olur"). Alt yazının altında ince ilerleme çubuğu: oran
  `min(answers / goal, 1)`, hedef tutunca yeşil; hedef kapalıyken gizli.
- **`/stats`** (`features/stats/StatsScreen.tsx`, başlık "İstatistikler"):
  1. **Seri:** "Şu an 5 gün" · "En uzun 12 gün"
  2. **Son 30 gün:** 30 çubuk; hedef açıksa yatay hedef çizgisi. Altında "Toplam 912 ·
     günlük ort. 30 · en yüksek 84".
  3. **Hatırlama:** "7 gün %87 · 142 cevap", "30 gün %84 · 610 cevap"; veri yoksa "—". Alt not:
     "Tekrar aşamasındaki kartlarda 'Tekrar' dışındaki cevaplar."
  4. **Kartlar:** Yeni / Öğreniliyor / Tekrarda / Olgun (kararlılık ≥21 gün).
  5. **Önümüzdeki 7 gün:** Bugün, Yarın, sonra kısa gün adları (Çar, Per …); çubuk + sayı.
     "Bugün" gecikmiş kartları da içerir.

  Hiç log yoksa 1–3 yerine tek "Henüz çalışma yok"; 4 ve 5 kalır.
- **`Bars`** (`features/stats/Bars.tsx`): `values`, isteğe bağlı `goal`; tema renkleri.
  Yalnız bu sayfada kullanıldığı için `ui/components`'e taşınmaz.
- **Ayarlar:** "Çalışma" grubuna **Günlük hedef** (`choices.ts`'e `dailyGoal`, `0` →
  "Kapalı"); mevcut `ChooseScreen` akışı.

## Hata durumları

- `fsrs_state` önbelleği boş kart "Yeni" sayılır, tahmine girmez (mevcut `stateCounts` /
  `forecast`).
- Listede olmayan bir hedef değeri sync'ten gelirse olduğu gibi gösterilir (`labelOf`).

## Testler (önce başarısız test)

Core (Vitest):
- `answersPerDay`: 03:30 yerel önceki güne düşer; `dayStartHour` ve saat dilimi sınırları
  ±1 dakika; aynı fikstürde sonuç JS'te `dayKey` ile gruplananla birebir aynı
- `streakOfDays`: boşlukla kopar; bugün çalışılmadıysa dünkü seri sürer; en uzun seri.
  Mevcut `streak` testleri değişmeden geçer.
- `Settings`: `dailyGoal` boşken 50; `0` yazılıp okunur
- `Stats.today()`: üç sayı; pratik cevap sayılır
- `Stats.report()`: fikstür loglarla tüm alanlar; log yokken hatırlama `null`, `daily` sıfır
- `localStore.test.ts` "upgrades an older database": eski şema SQL'inde `daily_goal` düşürülür,
  yükseltme sütunu ekler

Sync harness + pgTAP: `daily_goal` iki istemci arasında gidip gelir; sütun RLS altında.

App (Jest):
- `StreakRow`: dört durumun metni; hedef kapalıyken çubuk yok; dokununca `/stats`
- `StatsScreen`: gruplar ve "Henüz çalışma yok"
- Ayarlar: "Günlük hedef" seçimi kaydedilir

Kabul: plan bölüm 12 "Zayıf kelime + istatistik" satırı ve yukarıdaki testler.

Cihaz: Expo Go'da gösterilir; onaydan sonra prod migration (onayla), commit + push, telefona
build.
