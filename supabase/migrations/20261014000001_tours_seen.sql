-- In-app guides per screen (home, new, trip, days, saved, place): which ones this account has seen.
alter table public.profiles add column if not exists tours_seen text[] not null default '{}';
update public.profiles set tours_seen = array['home','new','trip','days','saved','place']
  where created_at <= now() - interval '3 hours';
create or replace function public.mark_tour(p_key text)
returns void language sql security definer set search_path = public as $$
  update public.profiles set tours_seen = array_append(tours_seen, p_key)
  where id = auth.uid() and p_key in ('home','new','trip','days','saved','place') and not (p_key = any(tours_seen));
$$;
create or replace function public.reset_tours()
returns void language sql security definer set search_path = public as $$
  update public.profiles set tours_seen = '{}' where id = auth.uid();
$$;
revoke all on function public.mark_tour(text) from public, anon;
revoke all on function public.reset_tours() from public, anon;
grant execute on function public.mark_tour(text) to authenticated;
grant execute on function public.reset_tours() to authenticated;
