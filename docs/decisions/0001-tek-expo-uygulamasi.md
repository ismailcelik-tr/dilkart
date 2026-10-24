# 0001 — Mobil ve web için tek Expo uygulaması

Durum: Kabul (24 Eki 2026)

**Bağlam:** iOS öncelikli mobil uygulama + kart yönetimi için web. Ücretsiz barındırma.

**Karar:** React Native + Expo + TypeScript. Web, aynı uygulamanın Expo Router
`web.output: "static"` çıktısı. Ortak iş kuralları `packages/core`'da (saf TS).

**Sonuçlar:** Tek dil, tek UI kodu; web sunucu kodu çalıştırmaz, statik barındırılır.
Web arayüzü mobil hissi taşır; yönetim paneli için kabul edildi.
Elenen: Next.js (ikinci framework), Flutter (ağır web çıktısı), native (iki kod tabanı).
