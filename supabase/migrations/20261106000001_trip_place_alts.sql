-- "Undecided": another place kept beside a stop of the day. The traveller picks one when the moment comes.
-- Not a stop itself, so routes, times, sharing and copies are untouched.
create table public.trip_place_alts (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  stop_id uuid not null references public.trip_places(id) on delete cascade,
  saved_place_id uuid not null references public.saved_places(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (stop_id, saved_place_id)
);
create index trip_place_alts_trip_idx on public.trip_place_alts (trip_id);
create index trip_place_alts_saved_idx on public.trip_place_alts (saved_place_id);
alter table public.trip_place_alts enable row level security;
create policy trip_place_alts_all on public.trip_place_alts for all to authenticated
  using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));
revoke all on public.trip_place_alts from anon;
grant select, insert, update, delete on public.trip_place_alts to authenticated;
