begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');

select ok(bool_and(relrowsecurity and relforcerowsecurity), 'every table forces RLS')
from pg_class
where oid in ('public.app_config'::regclass, 'public.user_settings'::regclass, 'public.decks'::regclass,
              'public.cards'::regclass, 'public.review_logs'::regclass, 'public.applied_ops'::regclass,
              'public.card_conflicts'::regclass);

-- User A writes.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select lives_ok($$
  insert into public.decks (id, user_id, name)
  values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000000a', 'A')
$$, 'A inserts own deck');

select lives_ok($$
  insert into public.cards (id, user_id, deck_id, front)
  values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000a',
          '00000000-0000-0000-0000-0000000000d1', 'go')
$$, 'A inserts own card');

select lives_ok($$
  insert into public.review_logs (id, user_id, card_id, reviewed_at, rating, mode, tz_offset_min, elapsed_ms)
  values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000000a',
          '00000000-0000-0000-0000-0000000000c1', now(), 3, 1, 180, 1200)
$$, 'A inserts own review log');

select isnt((select server_seq from public.cards), null, 'server_seq is assigned on insert');

select throws_ok($$
  insert into public.decks (id, user_id, name)
  values ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-00000000000b', 'spoof')
$$, '42501', null, 'A cannot insert a row owned by B');

update public.review_logs set rating = 1;
select is((select rating from public.review_logs)::int, 3, 'review logs are immutable');

delete from public.cards;
select is((select count(*) from public.cards)::int, 1, 'cards cannot be hard-deleted');

-- User B reads and writes.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';

select is_empty('select * from public.decks', 'B cannot read A''s decks');
select is_empty('select * from public.cards', 'B cannot read A''s cards');
select is_empty('select * from public.review_logs', 'B cannot read A''s review logs');

update public.cards set front = 'hacked';

-- Anonymous.
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select is((select count(*) from public.app_config)::int, 1, 'anon reads app_config');
select is_empty('select * from public.cards', 'anon cannot read cards');
select is_empty('select * from public.user_settings', 'anon cannot read settings');
select throws_ok($$
  insert into public.decks (id, user_id, name)
  values ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-00000000000a', 'anon')
$$, '42501', null, 'anon cannot insert');

reset role;
select is((select front from public.cards), 'go', 'B could not update A''s card');

select * from finish();
rollback;
