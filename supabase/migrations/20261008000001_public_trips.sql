-- "Public" now means: listed for everyone on the routes page, no link needed.
create or replace function public.list_public_trips(p_q text default null, p_limit int default 60)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
    select t.id, t.title, t.destination_name, t.start_date, t.end_date, t.share_token, t.created_at,
           t.destinations,
           (select count(*) from public.trip_days d where d.trip_id = t.id) as days_count,
           (select count(*) from public.saved_places sp where sp.trip_id = t.id) as places_count,
           split_part(coalesce(pr.display_name, ''), ' ', 1) as owner_name,
           pr.avatar_url as owner_avatar,
           (t.owner_id = auth.uid()) as mine
      from public.trips t
      left join public.profiles pr on pr.id = t.owner_id
     where t.visibility = 'public' and not t.is_snapshot and t.share_token is not null
       and (p_q is null or p_q = '' or t.destination_name ilike '%' || p_q || '%' or t.title ilike '%' || p_q || '%')
     order by t.created_at desc
     limit least(greatest(coalesce(p_limit, 60), 1), 100)
  ) x;
$$;
revoke execute on function public.list_public_trips(text, int) from public;
grant execute on function public.list_public_trips(text, int) to anon, authenticated;

-- "Add to my trips" from a shared trip: the copy keeps the name (no "(copy)") and the destinations list.
create or replace function public.clone_shared_trip(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  src uuid;
  src_title text;
  src_dest jsonb;
  v_new uuid;
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select id, title, destinations into src, src_title, src_dest from public.trips
   where share_token = p_token and visibility in ('link', 'public');
  if src is null then raise exception 'shared trip not found' using errcode = 'P0002'; end if;
  v_new := public.copy_trip_internal(src, uid, src_title);
  update public.trips set destinations = coalesce(src_dest, '[]'::jsonb) where id = v_new;
  return v_new;
end $$;
revoke execute on function public.clone_shared_trip(text) from public, anon;
grant execute on function public.clone_shared_trip(text) to authenticated;

-- The shared view tells the owner it is theirs (to edit instead of copying).
create or replace function public.get_shared_trip(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'trip', jsonb_build_object(
      'title', t.title, 'destination_name', t.destination_name,
      'start_date', t.start_date, 'end_date', t.end_date, 'travelers_count', t.travelers_count,
      'center_lat', t.center_lat, 'center_lng', t.center_lng, 'visibility', t.visibility,
      'destinations', t.destinations),
    'mine', (t.owner_id = auth.uid()),
    'trip_id', case when t.owner_id = auth.uid() then t.id end,
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
            'lat', p.lat, 'lng', p.lng, 'category_key', c.key,
            'review', sp.review, 'photos', to_jsonb(sp.review_photos))
            order by tp.position)
          from public.trip_places tp
          join public.saved_places sp on sp.id = tp.saved_place_id
          join public.places p on p.id = sp.place_id
          left join public.categories c on c.id = sp.category_id
          where tp.trip_day_id = d.id), '[]'::jsonb))
        order by d.day_index)
      from public.trip_days d where d.trip_id = t.id), '[]'::jsonb),
    'recommended', coalesce((
      select jsonb_agg(jsonb_build_object(
        'label', sp.label, 'google_place_id', p.google_place_id, 'lat', p.lat, 'lng', p.lng,
        'category_key', c.key, 'review', sp.review, 'photos', to_jsonb(sp.review_photos))
        order by sp.created_at)
      from public.saved_places sp
      join public.places p on p.id = sp.place_id
      left join public.categories c on c.id = sp.category_id
      where sp.trip_id = t.id
        and (sp.review is not null or cardinality(sp.review_photos) > 0)
        and not exists (select 1 from public.trip_places tp where tp.saved_place_id = sp.id)), '[]'::jsonb),
    'unscheduled_count', (select count(*) from public.saved_places sp
                           where sp.trip_id = t.id
                             and not exists (select 1 from public.trip_places tp where tp.saved_place_id = sp.id)))
  from public.trips t
  where t.share_token = p_token and t.visibility in ('link', 'public');
$$;
revoke execute on function public.get_shared_trip(text) from public;
grant execute on function public.get_shared_trip(text) to anon, authenticated;
