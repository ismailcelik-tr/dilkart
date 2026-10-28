-- ADR 0008: clients write only through sync_push, which runs as definer. RLS does not apply
-- inside it, so apply_lww checks the owner and composite keys keep references within a user.
drop policy own_insert on public.user_settings;
drop policy own_update on public.user_settings;
drop policy own_insert on public.decks;
drop policy own_update on public.decks;
drop policy own_insert on public.cards;
drop policy own_update on public.cards;
drop policy own_insert on public.review_logs;
drop policy own_insert on public.applied_ops;
drop policy own_insert on public.card_conflicts;

revoke insert, update, delete, truncate
  on public.app_config, public.user_settings, public.decks, public.cards, public.review_logs,
     public.applied_ops, public.card_conflicts
  from anon, authenticated;

alter table public.decks add constraint decks_user_id_id_key unique (user_id, id);
alter table public.cards add constraint cards_user_id_id_key unique (user_id, id);
alter table public.cards drop constraint cards_deck_id_fkey,
  add constraint cards_deck_fkey foreign key (user_id, deck_id) references public.decks (user_id, id) on delete cascade;
alter table public.review_logs drop constraint review_logs_card_id_fkey,
  add constraint review_logs_card_fkey foreign key (user_id, card_id) references public.cards (user_id, id) on delete cascade;
alter table public.card_conflicts drop constraint card_conflicts_card_id_fkey,
  add constraint card_conflicts_card_fkey foreign key (user_id, card_id) references public.cards (user_id, id) on delete cascade;

create or replace function sync.apply_lww(uid uuid, op jsonb) returns void
language plpgsql set search_path = '' as $$
declare
  tbl text := op->>'table';
  key_col text := case when tbl = 'user_settings' then 'user_id' else 'id' end;
  row_id uuid := case when tbl = 'user_settings' then uid else (op->>'row_id')::uuid end;
  cur jsonb;
  clock jsonb;
  m record;
  next_row jsonb;
  ins_cols text;
  upd_cols text;
  taken boolean;
begin
  execute format('select to_jsonb(t) - ''field_clock'', t.field_clock from public.%I t where %I = $1 and user_id = $2 for update',
                 tbl, key_col)
    into cur, clock using row_id, uid;
  if cur is null and tbl <> 'user_settings' then
    execute format('select exists (select from public.%I where id = $1)', tbl) into taken using row_id;
    if taken then
      raise exception 'row % belongs to another user', row_id using errcode = '42501';
    end if;
  end if;

  select * into m
  from sync.lww_merge(cur, clock, sync.normalize(tbl, op->'values'), coalesce(op->'base', '{}'), op->>'hlc');

  if tbl = 'cards' then
    insert into public.card_conflicts (user_id, card_id, field, loser, loser_hlc, winner_hlc)
    select uid, row_id, c->>'field', c->'loser', c->>'loser_hlc', c->>'winner_hlc'
    from jsonb_array_elements(m.conflicts) c;
  end if;

  -- Unchanged rows keep their server_seq so clients do not re-pull them.
  if cur is not null and m.merged = cur and m.merged_clock = clock then
    return;
  end if;

  next_row := m.merged || jsonb_build_object(key_col, row_id, 'user_id', uid, 'field_clock', m.merged_clock);

  -- Only present columns, so a new row gets column defaults.
  select string_agg(format('%I', attname), ', '),
         string_agg(format('%1$I = excluded.%1$I', attname), ', ') filter (where attname not in ('id', 'user_id'))
    into ins_cols, upd_cols
  from pg_attribute
  where attrelid = format('public.%I', tbl)::regclass and attnum > 0 and not attisdropped
    and next_row ? attname::text;

  execute format(
    'insert into public.%1$I (%2$s) select %2$s from jsonb_populate_record(null::public.%1$I, $1) '
    'on conflict (%3$I) do update set %4$s where %1$I.user_id = excluded.user_id', tbl, ins_cols, key_col, upd_cols)
    using next_row;
end $$;

alter function public.sync_push(jsonb, integer) security definer;

revoke execute on all functions in schema sync from authenticated;
revoke usage on schema sync from authenticated;
