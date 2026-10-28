# 0011 — Hesap silme SQL fonksiyonuyla

Durum: Kabul (28 Eki 2026) · Plan bölüm 10'daki `delete-account` Edge Function'ının yerine

**Bağlam:** Apple 5.1.1(v) uygulama içinden hesap silmeyi şart koşar. Plan bunu `service_role`
ile `auth.admin.deleteUser` çağıran bir Edge Function'a bırakmıştı. Kullanıcı tablolarının hepsi
`auth.users`'a `ON DELETE CASCADE` ile bağlı; Supabase'de `postgres` rolü `auth.users`'tan
silebiliyor. Storage kullanmıyoruz.

**Karar:** `public.delete_account()`: `SECURITY DEFINER`, yalnız `authenticated` çağırır,
`auth.users`'tan `id = auth.uid()` satırını siler. Cascade kullanıcı verisini ve oturumları
temizler.

**Sonuçlar:** Tek migration; pgTAP ile test edilir; ayrı deploy hattı, Deno ve `service_role`
yok. Bedeli: Supabase'in önerdiği Admin API yerine doğrudan `auth` şemasına yazma; Supabase
`auth` şemasında rol yetkisini daraltırsa Edge Function'a dönülür. Storage eklenirse dosyaları
bu fonksiyon silmez. Elenen: Edge Function (ikinci dağıtım biçimi, `service_role` sırrı).
