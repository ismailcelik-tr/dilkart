# 0009 — Yerel şema LocalStore'da, Drizzle yok

Durum: Kabul (25 Eki 2026)

**Bağlam:** Plan, kullanıcı verisi için expo-sqlite + Drizzle öngörüyordu. PoC-B'de
`packages/core` içindeki `LocalStore` satırı, alan saatini ve outbox'ı tek transaction'da
yazıyor; sync garantisi buna dayanıyor.

**Karar:** Yerel tablolar ve migration'ları `LocalStore`'da kalır (`PRAGMA user_version` +
sıralı SQL listesi). Tüm yazmalar `LocalStore` üzerinden geçer; okuma sorguları da `core`'da,
düz SQL ile. Uygulama yalnız `SqlDriver`'ı (expo-sqlite) sağlar.

**Sonuçlar:** Outbox'ı atlayan yazma yolu yok; şema ve sorgular Node'da `node:sqlite` ile
test edilir; babel eklentisi ve `drizzle-kit` kod üretimi gerekmez. Bedeli: tipli sorgu
oluşturucu yok, migration altyapısı bizim (küçük).
