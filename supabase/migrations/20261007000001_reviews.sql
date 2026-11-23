-- My recommendation for a place in my trip: a few words and photos I took.
-- Shown to others only when the trip is shared (link or public).
alter table public.saved_places
  add column if not exists review text check (char_length(review) <= 2000),
  add column if not exists review_photos text[] not null default '{}'
    check (cardinality(review_photos) <= 8);

-- Photos: public to read (shown on shared trips), written only into a trip you own:
-- trip-photos/<trip id>/<saved place id>/<file>. Max 5 MB, images only; the browser
-- shrinks them to 1600px WebP/JPEG first, which also drops camera metadata (GPS).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trip-photos', 'trip-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.owns_trip_folder(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when (storage.foldername(p_name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.is_trip_owner(((storage.foldername(p_name))[1])::uuid)
    else false end;
$$;

create policy "trip_photos_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'trip-photos' and public.owns_trip_folder(name));
create policy "trip_photos_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'trip-photos' and public.owns_trip_folder(name));
create policy "trip_photos_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'trip-photos' and public.owns_trip_folder(name));

-- The shared view now carries each place's recommendation and photos,
-- plus recommended places that are not on any day yet.
create or replace function public.get_shared_trip(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'trip', jsonb_build_object(
      'title', t.title, 'destination_name', t.destination_name,
      'start_date', t.start_date, 'end_date', t.end_date, 'travelers_count', t.travelers_count,
      'center_lat', t.center_lat, 'center_lng', t.center_lng, 'visibility', t.visibility,
      'destinations', t.destinations),
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
