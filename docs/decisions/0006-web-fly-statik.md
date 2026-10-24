# 0006 — Web Fly.io'da tek statik container

Durum: Kabul (24 Eki 2026)

**Karar:** Caddy ile `dist/` sunan 256 MB makine, `auto_stop_machines = "stop"`,
`min_machines_running = 0`. Ayrı backend yok; gizli anahtar gerektiren tek iş
(hesap silme) Supabase Edge Function.

**Sonuçlar:** Tahmini maliyet <0,5$/ay. Fly'ın 5$ altı muafiyeti resmî değil; biterse
aynı `dist/` Cloudflare Pages'e taşınır.
