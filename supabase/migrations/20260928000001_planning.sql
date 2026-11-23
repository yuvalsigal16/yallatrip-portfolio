-- =====================================================================
-- GoTrip · Phases 7–9 · Saved places, days and stop order
-- All functions run as the caller: Row Level Security still decides.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. "I've been there" on/off. Turning it off returns the place to
--    'planned' if it sits on a day, otherwise to 'saved'.
-- ---------------------------------------------------------------------
create or replace function public.set_place_visited(p_saved_place_id uuid, p_visited boolean)
returns public.place_status language plpgsql security invoker set search_path = public as $$
declare
  s public.place_status;
begin
  update public.saved_places sp
     set status = case
       when p_visited then 'visited'::public.place_status
       when exists (select 1 from public.trip_places tp where tp.saved_place_id = sp.id) then 'planned'
       else 'saved' end
   where sp.id = p_saved_place_id
  returning sp.status into s;
  if s is null then raise exception 'saved place not found' using errcode = 'P0002'; end if;
  return s;
end $$;

-- ---------------------------------------------------------------------
-- 2. Put a saved place at the end of a day.
-- ---------------------------------------------------------------------
create or replace function public.add_stop_to_day(p_day_id uuid, p_saved_place_id uuid)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_trip uuid;
  v_id uuid;
begin
  select trip_id into v_trip from public.trip_days where id = p_day_id;
  if v_trip is null then raise exception 'day not found' using errcode = 'P0002'; end if;
  insert into public.trip_places (trip_id, trip_day_id, saved_place_id, position)
  values (v_trip, p_day_id, p_saved_place_id,
          coalesce((select max(position) from public.trip_places where trip_day_id = p_day_id), 0) + 1)
  returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- 3. The one primitive for reordering and moving: "day X now holds
--    exactly these stops, in this order". The list must contain every
--    stop already on the day, and may bring in stops from other days
--    of the same trip (that is how a stop moves between days).
-- ---------------------------------------------------------------------
create or replace function public.set_day_order(p_day_id uuid, p_stop_ids uuid[])
returns void language plpgsql security invoker set search_path = public as $$
declare
  v_trip uuid;
  n int := coalesce(array_length(p_stop_ids, 1), 0);
begin
  select trip_id into v_trip from public.trip_days where id = p_day_id;
  if v_trip is null then raise exception 'day not found' using errcode = 'P0002'; end if;

  if n <> (select count(distinct x) from unnest(p_stop_ids) x) then
    raise exception 'duplicate stops in the list' using errcode = '22023';
  end if;
  if exists (select 1 from public.trip_places where trip_day_id = p_day_id and id <> all (coalesce(p_stop_ids, '{}'))) then
    raise exception 'the list must include every stop of the day' using errcode = '22023';
  end if;
  if n <> (select count(*) from public.trip_places where id = any (p_stop_ids) and trip_id = v_trip) then
    raise exception 'unknown stop or stop from another trip' using errcode = '22023';
  end if;

  update public.trip_places tp
     set trip_day_id = p_day_id, position = u.idx
    from unnest(p_stop_ids) with ordinality as u(id, idx)
   where tp.id = u.id;
end $$;

revoke execute on function public.set_place_visited(uuid, boolean) from public, anon;
revoke execute on function public.add_stop_to_day(uuid, uuid) from public, anon;
revoke execute on function public.set_day_order(uuid, uuid[]) from public, anon;
grant execute on function public.set_place_visited(uuid, boolean) to authenticated;
grant execute on function public.add_stop_to_day(uuid, uuid) to authenticated;
grant execute on function public.set_day_order(uuid, uuid[]) to authenticated;

-- A day's start time for automatic scheduling (default 09:00 in the app).
-- trip_days.start_time already exists; nothing to add.
