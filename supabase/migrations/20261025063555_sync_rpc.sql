-- sync_push / sync_pull; docs/plan.md section 7. Helpers live in `sync`,
-- which PostgREST does not expose. HLCs compare as text (packages/core hlc.ts).

create schema sync;

-- Op: {op_id, table, row_id, values, base: {field → HLC the writer saw}, hlc}

/** Field-wise LWW; mirrors packages/core merge.ts. A conflict is a write whose base differs from the current clock. */
create function sync.lww_merge(
  cur jsonb, clock jsonb, incoming jsonb, base jsonb, hlc text,
  out merged jsonb, out merged_clock jsonb, out conflicts jsonb
)
language plpgsql immutable set search_path = '' as $$
declare
  k text;
  v jsonb;
  c text;
  concurrent boolean;
begin
  merged := coalesce(cur, '{}');
  merged_clock := coalesce(clock, '{}');
  conflicts := '[]';

  if merged->>'deleted_at' is not null then
    if incoming->>'deleted_at' is not null and hlc collate "C" < (merged_clock->>'deleted_at') collate "C" then
      merged := merged || jsonb_build_object('deleted_at', incoming->'deleted_at');
      merged_clock := merged_clock || jsonb_build_object('deleted_at', hlc);
    end if;
    return;
  end if;

  for k, v in select key, value from jsonb_each(incoming) loop
    c := merged_clock->>k;

    -- Tombstone beats edits regardless of clock.
    if k = 'deleted_at' then
      if v <> 'null' then
        merged := merged || jsonb_build_object(k, v);
        merged_clock := merged_clock || jsonb_build_object(k, hlc);
      end if;
      continue;
    end if;

    concurrent := c is not null and c is distinct from base->>k and merged->k is distinct from v;
    if c is null or hlc collate "C" > c collate "C" then
      if concurrent then
        conflicts := conflicts || jsonb_build_array(
          jsonb_build_object('field', k, 'loser', merged->k, 'loser_hlc', c, 'winner_hlc', hlc));
      end if;
      merged := merged || jsonb_build_object(k, v);
      merged_clock := merged_clock || jsonb_build_object(k, hlc);
    elsif concurrent and hlc <> c then
      conflicts := conflicts || jsonb_build_array(
        jsonb_build_object('field', k, 'loser', v, 'loser_hlc', hlc, 'winner_hlc', c));
    end if;
  end loop;
end $$;

/** Casts incoming values through the column types so they compare equal to stored jsonb. */
create function sync.normalize(tbl text, incoming jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  typed jsonb;
begin
  execute format('select to_jsonb(jsonb_populate_record(null::public.%I, $1))', tbl) into typed using incoming;
  return (
    select coalesce(jsonb_object_agg(key, typed->key), '{}')
    from jsonb_object_keys(incoming - array['id', 'user_id', 'server_seq', 'field_clock']) key
    where typed ? key
  );
end $$;

create function sync.apply_lww(uid uuid, op jsonb) returns void
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
begin
  execute format('select to_jsonb(t) - ''field_clock'', t.field_clock from public.%I t where %I = $1 for update',
                 tbl, key_col)
    into cur, clock using row_id;

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
    'on conflict (%3$I) do update set %4$s', tbl, ins_cols, key_col, upd_cols)
    using next_row;
end $$;

-- Insert-only and keyed by id, so replays need no applied_ops entry.
create function sync.apply_log(uid uuid, op jsonb) returns void
language sql set search_path = '' as $$
  insert into public.review_logs
  select * from jsonb_populate_record(
    null::public.review_logs, (op->'values') || jsonb_build_object('id', op->>'row_id', 'user_id', uid))
  on conflict (id) do nothing;
$$;

create function public.sync_push(ops jsonb, schema_version integer) returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid();
  op jsonb;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if schema_version < (select min_schema_version from public.app_config) then
    raise exception 'schema version % is no longer supported', schema_version using errcode = 'DK001';
  end if;

  -- Serializes a user's pushes so a pull never passes a server_seq that commits later.
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));

  for op in select e.value from jsonb_array_elements(ops) with ordinality e(value, idx) order by e.idx loop
    if op->>'table' = 'review_logs' then
      perform sync.apply_log(uid, op);
      continue;
    end if;
    if op->>'table' not in ('decks', 'cards', 'user_settings') then
      raise exception 'unknown table %', op->>'table' using errcode = '22023';
    end if;

    insert into public.applied_ops (op_id, user_id) values ((op->>'op_id')::uuid, uid) on conflict do nothing;
    if found then
      perform sync.apply_lww(uid, op);
    end if;
  end loop;
  return jsonb_array_length(ops);
end $$;

create function public.sync_pull(since bigint, page integer)
returns table (seq bigint, tbl text, data jsonb)
language sql stable security invoker set search_path = '' as $$
  select * from (
    (select t.server_seq, 'decks', to_jsonb(t) from public.decks t
     where t.user_id = auth.uid() and t.server_seq > since order by t.server_seq limit page)
    union all
    (select t.server_seq, 'cards', to_jsonb(t) from public.cards t
     where t.user_id = auth.uid() and t.server_seq > since order by t.server_seq limit page)
    union all
    (select t.server_seq, 'review_logs', to_jsonb(t) from public.review_logs t
     where t.user_id = auth.uid() and t.server_seq > since order by t.server_seq limit page)
    union all
    (select t.server_seq, 'user_settings', to_jsonb(t) from public.user_settings t
     where t.user_id = auth.uid() and t.server_seq > since)
  ) u
  order by 1
  limit page;
$$;

revoke all on all functions in schema sync from public, anon;
grant usage on schema sync to authenticated;
grant execute on all functions in schema sync to authenticated;

revoke execute on function public.sync_push, public.sync_pull from public, anon;
grant execute on function public.sync_push, public.sync_pull to authenticated;
