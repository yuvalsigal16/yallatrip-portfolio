-- The how-to video shown once, right after signing up. Existing accounts are not shown it.
alter table public.profiles add column if not exists tour_seen_at timestamptz;
update public.profiles set tour_seen_at = now() where tour_seen_at is null;
create or replace function public.mark_tour_seen()
returns void language sql security definer set search_path = public as $$
  update public.profiles set tour_seen_at = now() where id = auth.uid() and tour_seen_at is null;
$$;
revoke all on function public.mark_tour_seen() from public, anon;
grant execute on function public.mark_tour_seen() to authenticated;
