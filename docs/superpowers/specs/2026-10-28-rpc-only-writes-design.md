# Sunucuya yalnız sync üzerinden yazma (Aşama 10a)

Tarih: 28 Eki 2026 · Durum: onaylandı · ADR 0008

## Kapsam kararı (28 Eki)

Aşama 10'dan yalnız 10a yapılır. Yedek reposu + geri yükleme provası (10b) ve Maestro E2E (10c)
yapılmaz; sunucu verisinin yedeği yok, cihazlardaki yerel kopya ve web'deki "Verilerimi indir"
kalır. TestFlight / App Store (Aşama 11–12) kullanıcı uygulamayı bir süre kullandıktan sonra
düşünülür. Sıradaki: açık küçük işler (kart listesinde kaydırarak silme, sözlük soğuk açılışı).

## Kurallar

- `anon` ve `authenticated`, `app_config` ve sync tablolarına (`user_settings`, `decks`, `cards`,
  `review_logs`, `applied_ops`, `card_conflicts`) `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`
  yapamaz; insert/update politikaları kalkar. Okuma politikaları kalır.
- `sync_push` `SECURITY DEFINER`. RLS içeride geçmediği için:
  - `sync.apply_lww` satırı `user_id = uid` ile okur; aynı kimlik başka kullanıcıdaysa
    `42501` hatası (`row belongs to another user`); upsert'in güncellemesi de
    `user_id = excluded.user_id` koşullu.
  - Kartın destesi, kaydın ve çakışmanın kartı aynı kullanıcının: bileşik yabancı anahtarlar
    `cards (user_id, deck_id) → decks (user_id, id)`, `review_logs` ve `card_conflicts`
    `(user_id, card_id) → cards (user_id, id)`, `on delete cascade`.
  - `sync` şeması `authenticated`'a kapanır (usage + execute geri alınır).
- `sync_pull` `SECURITY INVOKER` kalır: okumada RLS ikinci kalkan (ADR 0008'den sapma, ADR'de).
- Hata istemcide: `42501` (403) ve yabancı anahtar (`23503`, 409) kalıcı hata; işlem tek başına
  kalana dek bölünür ve `outbox_failed`'a düşer. Normal istemcide olmaz (uuidv7 kimlikler).
- Supabase yeni tablolara `anon`/`authenticated` için tüm yetkileri varsayılan verir; pgTAP
  "public'te `authenticated`'ın yazabildiği tablo yok" testi gelecekteki tabloları da yakalar.

## Testler (önce başarısız)

- `rls.test.sql`: doğrudan insert/update/delete `42501`; okuma izolasyonu aynen; public'te
  `anon`/`authenticated`'a yazma yetkisi olan tablo yok.
- `sync_owner.test.sql`: A, B'nin destesini ve kartını `sync_push` ile değiştiremez (`42501`,
  B'nin satırı aynı); A, B'nin destesine kart, B'nin kartına kayıt ekleyemez (`23503`);
  `authenticated` `sync.apply_lww`'yi doğrudan çağıramaz.
- `sync.test.sql` ve sync harness (yerel Supabase) değişmeden yeşil.
- Elle: prod migration'ından sonra telefonda ve web'de kart ekle, diğerinde görün.
