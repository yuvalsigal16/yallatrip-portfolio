-- Publishing, buying and getting a free route copy the trip; the copy cleared its temp table with a bare
-- DELETE, which the API refuses ("DELETE requires a WHERE clause"), so every copy failed.
create or replace function public.copy_trip_internal(p_source uuid, p_owner uuid, p_title text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  src public.trips%rowtype;
  v_new uuid;
  n_days int;
begin
  select * into src from public.trips where id = p_source;
  if not found then raise exception 'trip not found' using errcode = 'P0002'; end if;

  insert into public.trips (owner_id, title, destination_name, destination_place_id, center_lat, center_lng,
                            start_date, end_date, travelers_count, transport_modes, travel_styles, budget_level)
  values (p_owner, left(coalesce(p_title, src.title), 120), src.destination_name, src.destination_place_id,
          src.center_lat, src.center_lng, src.start_date, src.end_date, src.travelers_count,
          src.transport_modes, src.travel_styles, src.budget_level)
  returning id into v_new;

  -- days: created by the dates trigger; trips without dates get the same number of days
  if src.start_date is null then
    select count(*) into n_days from public.trip_days where trip_id = p_source;
    insert into public.trip_days (trip_id, day_index) select v_new, g from generate_series(1, n_days) g;
  end if;
  update public.trip_days nd set title = od.title, start_time = od.start_time
    from public.trip_days od
   where od.trip_id = p_source and nd.trip_id = v_new and nd.day_index = od.day_index;

  -- saved places (same shared place rows), then stops
  create temp table if not exists _sp_map (old_id uuid, new_id uuid) on commit drop;
  delete from _sp_map where true;  -- the API blocks DELETE without WHERE (pg_safeupdate)
  with src_sp as (
    select sp.*, gen_random_uuid() as nid from public.saved_places sp where sp.trip_id = p_source
  ), ins as (
    insert into public.saved_places (id, trip_id, place_id, category_id, label, is_must)
    select nid, v_new, place_id, category_id, label, is_must from src_sp
    returning id
  )
  insert into _sp_map select id, nid from src_sp;

  insert into public.trip_places (trip_id, trip_day_id, saved_place_id, position, planned_time, duration_min, transport_to_next, note)
  select v_new, nd.id, m.new_id, tp.position, tp.planned_time, tp.duration_min, tp.transport_to_next, tp.note
    from public.trip_places tp
    join public.trip_days od on od.id = tp.trip_day_id
    join public.trip_days nd on nd.trip_id = v_new and nd.day_index = od.day_index
    join _sp_map m on m.old_id = tp.saved_place_id;

  update public.trips set hotel_saved_place_id = (select m.new_id from _sp_map m where m.old_id = src.hotel_saved_place_id)
   where id = v_new and src.hotel_saved_place_id is not null;

  return v_new;
end $$;
