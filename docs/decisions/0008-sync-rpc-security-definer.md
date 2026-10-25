# 0008 — Sync tablolarına yalnız RPC ile yazma

Durum: Öneri (25 Eki 2026), Aşama 10'da uygulanacak

**Bağlam:** `sync_push` `SECURITY INVOKER`; RLS kullanıcıya kendi satırlarında doğrudan
`insert`/`update` izni veriyor. İstemci RPC'yi atlarsa `field_clock`, `applied_ops` ve
çakışma kaydı devre dışı kalır; zarar yalnız kendi verisine (`docs/poc-b-sync.md`).

**Karar:** `authenticated` rolünden sync tablolarına `insert`/`update` yetkisi kaldırılır;
`sync_push` ve `sync_pull` `SECURITY DEFINER` olur, `user_id`'yi `auth.uid()`'den alır ve
`search_path = ''` ile çalışır. Okuma için RLS select politikaları kalır.

**Sonuçlar:** Bölüm 10'daki "RPC'ler `SECURITY INVOKER`" kararından sapma. RLS RPC içinde
geçerli olmaz; izolasyon fonksiyondaki `auth.uid()` filtrelerine dayanır ve pgTAP ile test
edilir (A kullanıcısı B'nin satırını RPC ile de değiştiremez).
