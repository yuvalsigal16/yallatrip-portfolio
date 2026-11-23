-- In-app guide: tour_seen_at = the "my trips" guide, trip_tour_seen_at = the trip-screen guide. Shown once each.
alter table public.profiles add column if not exists trip_tour_seen_at timestamptz;
update public.profiles set trip_tour_seen_at = now() where trip_tour_seen_at is null;
create or replace function public.mark_trip_tour_seen()
returns void language sql security definer set search_path = public as $$
  update public.profiles set trip_tour_seen_at = now() where id = auth.uid() and trip_tour_seen_at is null;
$$;
revoke all on function public.mark_trip_tour_seen() from public, anon;
grant execute on function public.mark_trip_tour_seen() to authenticated;
update public.profiles set tour_seen_at = null, trip_tour_seen_at = null where created_at > now() - interval '2 hours';
