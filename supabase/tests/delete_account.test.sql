begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local');
insert into auth.sessions (id, user_id) values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000a');
insert into public.user_settings (user_id) values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');
insert into public.decks (id, user_id, name) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-00000000000a', 'A'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-00000000000b', 'B');
insert into public.cards (id, user_id, deck_id, front) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000d1', 'go');
insert into public.review_logs (id, user_id, card_id, reviewed_at, rating, mode, tz_offset_min, elapsed_ms) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1', now(), 3, 1, 180, 1200);

set local role anon;
select throws_ok('select public.delete_account()', '42501', null, 'anon cannot delete');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
select lives_ok('select public.delete_account()', 'A deletes own account');

reset role;
select is((select count(*) from auth.users where id = '00000000-0000-0000-0000-00000000000a')::int, 0, 'A is gone');
select is((
  select (select count(*) from public.user_settings where user_id = u) + (select count(*) from public.decks where user_id = u)
       + (select count(*) from public.cards where user_id = u) + (select count(*) from public.review_logs where user_id = u)
       + (select count(*) from public.applied_ops where user_id = u) + (select count(*) from public.card_conflicts where user_id = u)
       + (select count(*) from auth.sessions where user_id = u)
  from (select '00000000-0000-0000-0000-00000000000a'::uuid as u) x)::int, 0, 'no row of A is left');
select is((select count(*) from public.decks where user_id = '00000000-0000-0000-0000-00000000000b')::int, 1, 'B keeps its data');

select * from finish();
rollback;
