# 0008 — Sync tablolarına yalnız RPC ile yazma

Durum: Kabul (28 Eki 2026, Aşama 10a)

**Bağlam:** `sync_push` `SECURITY INVOKER`; RLS kullanıcıya kendi satırlarında doğrudan
`insert`/`update` izni veriyor. İstemci RPC'yi atlarsa `field_clock`, `applied_ops` ve
çakışma kaydı devre dışı kalır; zarar yalnız kendi verisine (`docs/poc-b-sync.md`).

**Karar:** `authenticated` rolünden sync tablolarına `insert`/`update` yetkisi kaldırılır;
`sync_push` `SECURITY DEFINER` olur, `user_id`'yi `auth.uid()`'den alır ve `search_path = ''`
ile çalışır. `sync_pull` `SECURITY INVOKER` kalır: okumada RLS ikinci kalkan, definer bir şey
kazandırmaz. Kartın destesi ve kaydın kartı bileşik yabancı anahtarla aynı kullanıcıya bağlanır.

**Sonuçlar:** Bölüm 10'daki "RPC'ler `SECURITY INVOKER`" kararından sapma. RLS `sync_push` içinde
geçerli olmaz; izolasyon fonksiyondaki `auth.uid()` filtrelerine ve bileşik anahtarlara dayanır ve pgTAP ile test
edilir (A kullanıcısı B'nin satırını RPC ile de değiştiremez).
