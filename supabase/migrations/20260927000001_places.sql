-- =====================================================================
-- GoTrip · Phase 6 · Map and places
-- =====================================================================

-- 1. The shared places table is written only by our server.
--    Before: any signed-in user could insert a place with made-up coordinates,
--    and every other user saving that place would see the wrong pin.
--    Now: only the server (service role, after looking the place up at Google) writes it.
drop policy if exists places_insert on public.places;
revoke insert, update, delete on public.places from anon, authenticated;

-- Inserts a place or refreshes its coordinates once they are 30+ days old
-- (Google's terms allow keeping coordinates for up to 30 days).
create or replace function public.upsert_place(
  p_google_place_id text, p_lat double precision, p_lng double precision, p_primary_type text
) returns uuid language plpgsql security invoker set search_path = public as $$
declare
  pid uuid;
begin
  insert into public.places (google_place_id, lat, lng, primary_type)
  values (p_google_place_id, p_lat, p_lng, p_primary_type)
  on conflict (google_place_id) do update
     set lat = excluded.lat, lng = excluded.lng, primary_type = excluded.primary_type, synced_at = now()
   where public.places.synced_at < now() - interval '30 days'
  returning id into pid;

  if pid is null then
    select id into pid from public.places where google_place_id = p_google_place_id;
  end if;
  return pid;
end $$;
revoke execute on function public.upsert_place(text, double precision, double precision, text) from public, anon, authenticated;
grant execute on function public.upsert_place(text, double precision, double precision, text) to service_role;

-- 2. Saved places of a trip, with what the map needs, in one call.
create or replace view public.saved_places_on_map
with (security_invoker = true) as
select sp.id, sp.trip_id, sp.label, sp.is_must, sp.status, sp.personal_note, sp.created_at,
       c.key as category_key, p.google_place_id, p.lat, p.lng, p.primary_type
  from public.saved_places sp
  join public.places p on p.id = sp.place_id
  left join public.categories c on c.id = sp.category_id;
grant select on public.saved_places_on_map to authenticated;
