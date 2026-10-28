begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');
insert into public.decks (id, user_id, name)
  values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000000a', 'A');
insert into public.cards (id, user_id, deck_id, front)
  values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000a',
          '00000000-0000-0000-0000-0000000000d1', 'go');
insert into public.review_logs (id, user_id, card_id, reviewed_at, rating, mode, tz_offset_min, elapsed_ms)
  values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000000a',
          '00000000-0000-0000-0000-0000000000c1', now(), 3, 1, 180, 1200);

select ok(bool_and(relrowsecurity and relforcerowsecurity), 'every table forces RLS')
from pg_class
where oid in ('public.app_config'::regclass, 'public.user_settings'::regclass, 'public.decks'::regclass,
              'public.cards'::regclass, 'public.review_logs'::regclass, 'public.applied_ops'::regclass,
              'public.card_conflicts'::regclass);

select is_empty($$
  select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not (c.relrowsecurity and c.relforcerowsecurity)
$$, 'no public table lacks forced RLS, including future ones');

-- ADR 0008: clients write only through sync_push.
select is_empty($$
  select table_name, grantee, privilege_type from information_schema.role_table_grants
  where table_schema = 'public' and grantee in ('anon', 'authenticated')
    and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
$$, 'no public table is writable by clients, including future ones');

-- User A.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select is((select count(*) from public.cards)::int, 1, 'A reads own cards');
select isnt((select server_seq from public.cards), null, 'server_seq is assigned on insert');

select throws_ok($$
  insert into public.decks (id, user_id, name)
  values ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-00000000000a', 'direct')
$$, '42501', null, 'A cannot insert a deck directly');
select throws_ok('update public.cards set front = ''went''', '42501', null, 'A cannot update a card directly');
select throws_ok('delete from public.cards', '42501', null, 'A cannot delete a card directly');
select throws_ok($$
  insert into public.review_logs (id, user_id, card_id, reviewed_at, rating, mode, tz_offset_min, elapsed_ms)
  values ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-00000000000a',
          '00000000-0000-0000-0000-0000000000c1', now(), 3, 1, 180, 1200)
$$, '42501', null, 'A cannot insert a review log directly');
select throws_ok('select sync.normalize(''decks'', ''{}'')', '42501', null, 'A cannot call sync helpers');

-- User B.
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';

select is_empty('select * from public.decks', 'B cannot read A''s decks');
select is_empty('select * from public.cards', 'B cannot read A''s cards');
select is_empty('select * from public.review_logs', 'B cannot read A''s review logs');

-- Anonymous.
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select is((select count(*) from public.app_config)::int, 1, 'anon reads app_config');
select is_empty('select * from public.cards', 'anon cannot read cards');
select throws_ok($$
  insert into public.decks (id, user_id, name)
  values ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-00000000000a', 'anon')
$$, '42501', null, 'anon cannot insert');

select * from finish();
rollback;
