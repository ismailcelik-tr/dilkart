begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

-- lww_merge(cur, clock, incoming, base, hlc)
select is(
  (select row(merged, merged_clock, conflicts)::text from sync.lww_merge(null, null, '{"front": "go"}', '{}', 'h1')),
  row('{"front": "go"}'::jsonb, '{"front": "h1"}'::jsonb, '[]'::jsonb)::text,
  'new row takes incoming values');

select is(
  (select merged->>'front' from sync.lww_merge('{"front": "go"}', '{"front": "h1"}', '{"front": "went"}', '{"front": "h1"}', 'h2')),
  'went', 'newer write on the same base wins');

select is(
  (select conflicts from sync.lww_merge('{"front": "go"}', '{"front": "h1"}', '{"front": "went"}', '{"front": "h1"}', 'h2')),
  '[]', 'sequential write is not a conflict');

select is(
  (select row(merged->>'front', conflicts)::text
   from sync.lww_merge('{"front": "b"}', '{"front": "h2"}', '{"front": "c"}', '{"front": "h1"}', 'h3')),
  row('c', '[{"field": "front", "loser": "b", "loser_hlc": "h2", "winner_hlc": "h3"}]'::jsonb)::text,
  'concurrent newer write wins and records the old value');

select is(
  (select row(merged->>'front', merged_clock->>'front', conflicts)::text
   from sync.lww_merge('{"front": "b"}', '{"front": "h3"}', '{"front": "c"}', '{"front": "h1"}', 'h2')),
  row('b', 'h3', '[{"field": "front", "loser": "c", "loser_hlc": "h2", "winner_hlc": "h3"}]'::jsonb)::text,
  'concurrent older write loses and is recorded');

select is(
  (select conflicts from sync.lww_merge('{"front": "b"}', '{"front": "h2"}', '{"front": "b"}', '{"front": "h1"}', 'h3')),
  '[]', 'concurrent equal values are not a conflict');

select is(
  (select merged->>'front' from sync.lww_merge(
     '{"front": "b", "deleted_at": "2026-10-25T00:00:00+00:00"}', '{"deleted_at": "h1"}',
     '{"front": "c"}', '{}', 'h9')),
  'b', 'edits to a tombstoned row are ignored');

select is(
  (select merged->>'deleted_at' from sync.lww_merge(
     '{"front": "b"}', '{"front": "h9"}', '{"deleted_at": "2026-10-25T00:00:00+00:00"}', '{}', 'h1')),
  '2026-10-25T00:00:00+00:00', 'an older delete still wins');

-- sync_push / sync_pull
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

create temp table batch as select $$[
  {"op_id": "00000000-0000-7000-8000-000000000001", "table": "decks", "row_id": "00000000-0000-0000-0000-0000000000d1",
   "values": {"name": "Fiiller"}, "base": {}, "hlc": "000000000000001-0000-a"},
  {"op_id": "00000000-0000-7000-8000-000000000002", "table": "cards", "row_id": "00000000-0000-0000-0000-0000000000c1",
   "values": {"deck_id": "00000000-0000-0000-0000-0000000000d1", "front": "go", "meanings": [{"tr": "gitmek"}],
              "user_id": "00000000-0000-0000-0000-00000000000b", "server_seq": 1},
   "base": {}, "hlc": "000000000000001-0001-a"},
  {"op_id": "00000000-0000-7000-8000-000000000003", "table": "review_logs", "row_id": "00000000-0000-0000-0000-0000000000e1",
   "values": {"card_id": "00000000-0000-0000-0000-0000000000c1", "reviewed_at": "2026-10-25T06:00:00Z",
              "rating": 3, "mode": 1, "tz_offset_min": 180, "elapsed_ms": 1500},
   "base": {}, "hlc": "000000000000001-0002-a"}
]$$::jsonb as ops;
grant select on batch to authenticated;

select is(public.sync_push((select ops from batch), 1), 3, 'push reports the batch size');
select is((select user_id from public.cards)::text, '00000000-0000-0000-0000-00000000000a', 'owner comes from the JWT');
select is((select meanings from public.cards), '[{"tr": "gitmek"}]', 'jsonb values are stored');
select is((select field_clock->>'front' from public.cards), '000000000000001-0001-a', 'field clock is stored');

select public.sync_push((select ops from batch), 1) from generate_series(1, 4);
select is((select count(*) from public.cards)::int, 1, 'replayed batch keeps one card');
select is((select count(*) from public.review_logs)::int, 1, 'replayed batch keeps one review log');
select is((select field_clock->>'front' from public.cards), '000000000000001-0001-a', 'replay does not touch clocks');

select throws_ok($$ select public.sync_push('[]', 0) $$, 'DK001', null, 'old schema version is rejected');

select public.sync_push($$[{"op_id": "00000000-0000-7000-8000-000000000004", "table": "cards",
  "row_id": "00000000-0000-0000-0000-0000000000c1", "values": {"front": "went"},
  "base": {"front": "000000000000000-0000-z"}, "hlc": "000000000000000-0005-b"}]$$, 1);
select is((select front from public.cards), 'go', 'stale concurrent edit loses');
select is((select loser #>> '{}' from public.card_conflicts), 'went', 'losing value is kept in card_conflicts');

select is((select array_agg(tbl order by seq) from public.sync_pull(0, 10)),
  array['decks', 'cards', 'review_logs'], 'pull returns rows in server_seq order');
select is((select count(*) from public.sync_pull(0, 2))::int, 2, 'pull honors the page size');
select is((select count(*) from public.sync_pull((select max(seq) from public.sync_pull(0, 10)), 10))::int, 0,
  'pull after the last seq is empty');

set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';
select is_empty('select * from public.sync_pull(0, 10)', 'B pulls nothing of A''s');

select * from finish();
rollback;
