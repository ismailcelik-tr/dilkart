begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

-- ADR 0008: sync_push runs as definer, so ownership is checked by the function and the keys.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');
insert into public.decks (id, user_id, name)
  values ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-00000000000b', 'B');
insert into public.cards (id, user_id, deck_id, front)
  values ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-00000000000b',
          '00000000-0000-0000-0000-0000000000d2', 'run');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select throws_ok($$ select public.sync_push('[{"op_id": "00000000-0000-7000-8000-000000000011", "table": "cards",
  "row_id": "00000000-0000-0000-0000-0000000000c2", "values": {"front": "stolen"}, "base": {},
  "hlc": "999999999999999-0000-a"}]', 1) $$, '42501', null, 'A cannot change B''s card through sync');

select throws_ok($$ select public.sync_push('[{"op_id": "00000000-0000-7000-8000-000000000012", "table": "decks",
  "row_id": "00000000-0000-0000-0000-0000000000d2", "values": {"name": "stolen"}, "base": {},
  "hlc": "999999999999999-0000-a"}]', 1) $$, '42501', null, 'A cannot change B''s deck through sync');

select throws_ok($$ select public.sync_push('[{"op_id": "00000000-0000-7000-8000-000000000013", "table": "cards",
  "row_id": "00000000-0000-0000-0000-0000000000c3",
  "values": {"deck_id": "00000000-0000-0000-0000-0000000000d2", "front": "go", "meanings": []}, "base": {},
  "hlc": "000000000000001-0000-a"}]', 1) $$, '23503', null, 'A cannot add a card to B''s deck');

select throws_ok($$ select public.sync_push('[{"op_id": "00000000-0000-7000-8000-000000000014", "table": "review_logs",
  "row_id": "00000000-0000-0000-0000-0000000000e3",
  "values": {"card_id": "00000000-0000-0000-0000-0000000000c2", "reviewed_at": "2026-10-28T06:00:00Z",
             "rating": 3, "mode": 1, "tz_offset_min": 180, "elapsed_ms": 1}, "base": {},
  "hlc": "000000000000001-0000-a"}]', 1) $$, '23503', null, 'A cannot log a review on B''s card');

reset role;
select is((select front from public.cards where id = '00000000-0000-0000-0000-0000000000c2'), 'run', 'B''s card is unchanged');
select is((select name from public.decks where id = '00000000-0000-0000-0000-0000000000d2'), 'B', 'B''s deck is unchanged');

select * from finish();
rollback;
