-- =====================================================================
-- GoTrip · Phase 5 · Trip creation support
-- =====================================================================

-- Only known travel styles on a trip (same list as user_preferences).
alter table public.trips
  add constraint trip_travel_styles_known check (
    travel_styles <@ array['food', 'attractions', 'shopping', 'nature', 'nightlife', 'culture', 'relax', 'family']::text[]
  );

-- "My trips" is listed newest first when there are no dates.
create index trips_owner_created_idx on public.trips (owner_id, created_at desc);

-- Before shortening a trip: how many scheduled stops sit on days that would disappear?
-- Runs as the caller, so it only counts stops in the caller's own trips.
create or replace function public.count_stops_after_day(p_trip_id uuid, p_last_day integer)
returns integer language sql stable security invoker set search_path = public as $$
  select count(*)::integer
    from public.trip_places tp
    join public.trip_days d on d.id = tp.trip_day_id
   where tp.trip_id = p_trip_id and d.day_index > p_last_day;
$$;
revoke execute on function public.count_stops_after_day(uuid, integer) from public, anon;
grant execute on function public.count_stops_after_day(uuid, integer) to authenticated;

-- Removing a trip's dates keeps its days (and their stops) but clears the day dates,
-- so no day shows a date that no longer belongs to the trip.
create or replace function public.sync_trip_days()
returns trigger language plpgsql as $$
declare
  n_days int;
begin
  if tg_op = 'UPDATE'
     and new.start_date is not distinct from old.start_date
     and new.end_date is not distinct from old.end_date then
    return new;
  end if;

  if new.start_date is null then
    update public.trip_days set date = null where trip_id = new.id and date is not null;
    return new;
  end if;

  n_days := (new.end_date - new.start_date) + 1;

  delete from public.trip_days where trip_id = new.id and day_index > n_days;

  update public.trip_days
     set date = new.start_date + (day_index - 1)
   where trip_id = new.id;

  insert into public.trip_days (trip_id, day_index, date)
  select new.id, g, new.start_date + (g - 1)
    from generate_series(1, n_days) as g
  on conflict (trip_id, day_index) do nothing;

  return new;
end $$;
