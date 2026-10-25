-- Synced tables. Ids come from clients (UUIDv7); field_clock maps field → HLC.

-- One sequence across tables gives clients a single pull cursor.
create sequence public.sync_seq;

create function public.set_server_seq() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.server_seq := nextval('public.sync_seq');
  return new;
end $$;

create table public.app_config (
  id boolean primary key default true check (id),
  min_app_version text not null default '0.0.0',
  min_schema_version integer not null default 1
);
insert into public.app_config default values;

create table public.user_settings (
  user_id uuid primary key references auth.users on delete cascade,
  daily_new_limit smallint,
  daily_review_limit smallint,
  day_start_hour smallint,
  desired_retention real,
  tts_accent text,
  field_clock jsonb not null default '{}',
  server_seq bigint not null
);

create table public.decks (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  name text not null default '',
  field_clock jsonb not null default '{}',
  deleted_at timestamptz,
  server_seq bigint not null
);

create table public.cards (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  deck_id uuid not null references public.decks on delete cascade,
  front text not null default '',
  usage_label text,
  meanings jsonb not null default '[]',
  example_en text,
  example_tr text,
  dict_entry_id text,
  dict_sense_id text,
  is_weak boolean not null default false,
  weak_dismissed_until timestamptz,
  fsrs_state jsonb,
  field_clock jsonb not null default '{}',
  deleted_at timestamptz,
  server_seq bigint not null
);

create table public.review_logs (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  card_id uuid not null references public.cards on delete cascade,
  reviewed_at timestamptz not null,
  rating smallint not null,
  mode smallint not null,
  tz_offset_min smallint not null,
  elapsed_ms integer not null,
  server_seq bigint not null
);

create table public.applied_ops (
  op_id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  applied_at timestamptz not null default now()
);

create table public.card_conflicts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  card_id uuid not null references public.cards on delete cascade,
  field text not null,
  loser jsonb,
  loser_hlc text not null,
  winner_hlc text not null,
  created_at timestamptz not null default now()
);

create index on public.decks (user_id, server_seq);
create index on public.cards (user_id, server_seq);
create index on public.cards (deck_id);
create index on public.review_logs (user_id, server_seq);
create index on public.review_logs (card_id);
create index on public.user_settings (server_seq);
create index on public.applied_ops (user_id);
create index on public.card_conflicts (card_id);

create trigger set_server_seq before insert or update on public.user_settings
  for each row execute function public.set_server_seq();
create trigger set_server_seq before insert or update on public.decks
  for each row execute function public.set_server_seq();
create trigger set_server_seq before insert or update on public.cards
  for each row execute function public.set_server_seq();
create trigger set_server_seq before insert on public.review_logs
  for each row execute function public.set_server_seq();

-- RLS: see docs/plan.md section 10. No delete policies: tombstones only.
alter table public.app_config enable row level security, force row level security;
alter table public.user_settings enable row level security, force row level security;
alter table public.decks enable row level security, force row level security;
alter table public.cards enable row level security, force row level security;
alter table public.review_logs enable row level security, force row level security;
alter table public.applied_ops enable row level security, force row level security;
alter table public.card_conflicts enable row level security, force row level security;

create policy read on public.app_config for select to anon, authenticated using (true);

create policy own_read on public.user_settings for select to authenticated using (user_id = auth.uid());
create policy own_insert on public.user_settings for insert to authenticated with check (user_id = auth.uid());
create policy own_update on public.user_settings for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy own_read on public.decks for select to authenticated using (user_id = auth.uid());
create policy own_insert on public.decks for insert to authenticated with check (user_id = auth.uid());
create policy own_update on public.decks for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy own_read on public.cards for select to authenticated using (user_id = auth.uid());
create policy own_insert on public.cards for insert to authenticated with check (user_id = auth.uid());
create policy own_update on public.cards for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy own_read on public.review_logs for select to authenticated using (user_id = auth.uid());
create policy own_insert on public.review_logs for insert to authenticated with check (user_id = auth.uid());

create policy own_read on public.applied_ops for select to authenticated using (user_id = auth.uid());
create policy own_insert on public.applied_ops for insert to authenticated with check (user_id = auth.uid());

create policy own_read on public.card_conflicts for select to authenticated using (user_id = auth.uid());
create policy own_insert on public.card_conflicts for insert to authenticated with check (user_id = auth.uid());
