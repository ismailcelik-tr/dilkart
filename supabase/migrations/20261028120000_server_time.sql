-- Server clock for the client's clock check (ms since epoch). Browsers hide the Date header of
-- cross-origin responses, so web cannot read it from HTTP (ADR 0010).
create function public.server_time()
returns bigint
language sql stable security invoker set search_path = '' as $$
  select (extract(epoch from clock_timestamp()) * 1000)::bigint;
$$;

revoke execute on function public.server_time from public, anon;
grant execute on function public.server_time to authenticated;
