-- Apple 5.1.1(v): in-app account deletion. Every user table cascades from auth.users (ADR 0011).
create function public.delete_account()
returns void
language sql volatile security definer set search_path = '' as $$
  delete from auth.users where id = auth.uid();
$$;

revoke execute on function public.delete_account from public, anon;
grant execute on function public.delete_account to authenticated;
