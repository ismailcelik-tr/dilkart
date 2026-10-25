# 0002 — Postgres RPC tabanlı kendi senkronizasyonumuz

Durum: Kabul (24 Eki 2026), PoC-B ile doğrulandı (25 Eki 2026, `docs/poc-b-sync.md`)

**Bağlam:** Çevrimdışı öncelikli; Supabase Free; ek ücretli servis yok.

**Karar:** Cihazda outbox; `sync_push` (idempotent, `op_id`) ve `sync_pull`
(`server_seq` imleci) RPC'leri. Tekrar geçmişi yalnız eklenir; kart içeriği alan
bazlı LWW + HLC; aynı alanın eşzamanlı değişiminde kaybeden değer `card_conflicts`'a.

**Sonuçlar:** Ek hesap/servis yok, tamamen test edilebilir; sync kodu bizim
sorumluluğumuzda. Elenen: PowerSync Free (7 gün bağlantısız instance kaldırılıyor),
ElectricSQL (ayrı servis).
