-- =====================================================================
-- GoTrip · Phase 11 · Sharing and "copy to my trip"
-- =====================================================================

-- 1. The shared view now also carries each stop's category, the day's name,
--    and the hotel. Still never the owner's id, and never private notes.
create or replace function public.get_shared_trip(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'trip', jsonb_build_object(
      'title', t.title, 'destination_name', t.destination_name,
      'start_date', t.start_date, 'end_date', t.end_date, 'travelers_count', t.travelers_count,
      'center_lat', t.center_lat, 'center_lng', t.center_lng, 'visibility', t.visibility),
    'hotel', (select jsonb_build_object('label', sp.label, 'lat', p.lat, 'lng', p.lng, 'google_place_id', p.google_place_id)
                from public.saved_places sp join public.places p on p.id = sp.place_id
               where sp.id = t.hotel_saved_place_id),
    'days', coalesce((
      select jsonb_agg(jsonb_build_object(
        'day_index', d.day_index, 'date', d.date, 'title', d.title,
        'stops', coalesce((
          select jsonb_agg(jsonb_build_object(
            'planned_time', to_char(tp.planned_time, 'HH24:MI'), 'note', tp.note,
            'label', sp.label, 'google_place_id', p.google_place_id,
            'lat', p.lat, 'lng', p.lng, 'category_key', c.key)
            order by tp.position)
          from public.trip_places tp
          join public.saved_places sp on sp.id = tp.saved_place_id
          join public.places p on p.id = sp.place_id
          left join public.categories c on c.id = sp.category_id
          where tp.trip_day_id = d.id), '[]'::jsonb))
        order by d.day_index)
      from public.trip_days d where d.trip_id = t.id), '[]'::jsonb),
    'unscheduled_count', (select count(*) from public.saved_places sp
                           where sp.trip_id = t.id
                             and not exists (select 1 from public.trip_places tp where tp.saved_place_id = sp.id)))
  from public.trips t
  where t.share_token = p_token and t.visibility in ('link', 'public');
$$;
revoke execute on function public.get_shared_trip(text) from public;
grant execute on function public.get_shared_trip(text) to anon, authenticated;

-- 2. Copy a trip into the caller's account. Used by shared links now,
--    and by the marketplace later (Phase 12). Copies places, days, stops,
--    times and stop notes; never the original owner's private notes.
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
  delete from _sp_map;
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
revoke execute on function public.copy_trip_internal(uuid, uuid, text) from public, anon, authenticated;

create or replace function public.clone_shared_trip(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  src uuid;
  src_title text;
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select id, title into src, src_title from public.trips
   where share_token = p_token and visibility in ('link', 'public');
  if src is null then raise exception 'shared trip not found' using errcode = 'P0002'; end if;
  return public.copy_trip_internal(src, uid, src_title || ' (עותק)');
end $$;
revoke execute on function public.clone_shared_trip(text) from public, anon;
grant execute on function public.clone_shared_trip(text) to authenticated;
