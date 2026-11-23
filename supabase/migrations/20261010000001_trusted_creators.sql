-- Influencers / bloggers are approved once (by the admin). After that their routes go
-- straight to the store: no review on each publish or edit.
create or replace function public.publish_trip(p_trip_id uuid, p_title text, p_description text, p_price_agorot integer)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  t public.trips%rowtype;
  snap uuid;
  rid uuid;
  n_places int;
begin
  if not exists (select 1 from public.creators c join public.profiles p on p.id = c.user_id
                  where c.user_id = uid and p.role in ('creator', 'admin')) then
    raise exception 'only approved creators can publish' using errcode = '42501';
  end if;
  select * into t from public.trips where id = p_trip_id and owner_id = uid and not is_snapshot;
  if not found then raise exception 'trip not found' using errcode = 'P0002'; end if;
  if p_price_agorot <> 0 and (p_price_agorot < public.setting_numeric('min_price_agorot')
                              or p_price_agorot > public.setting_numeric('max_price_agorot')) then
    raise exception 'price out of range' using errcode = '22023';
  end if;
  select count(*) into n_places from public.trip_places where trip_id = p_trip_id;
  if n_places < 3 then raise exception 'a route needs at least 3 scheduled stops' using errcode = '22023'; end if;

  snap := public.copy_trip_internal(p_trip_id, uid, t.title);
  update public.trips set is_snapshot = true, visibility = 'private' where id = snap;

  insert into public.published_trips (creator_id, source_trip_id, snapshot_trip_id, title, description, destination_name,
                                      days_count, places_count, price_agorot, status, published_at)
  values (uid, p_trip_id, snap, p_title, p_description, t.destination_name,
          (select count(*) from public.trip_days where trip_id = snap), n_places, p_price_agorot, 'published', now())
  returning id into rid;
  return rid;
end $$;
revoke execute on function public.publish_trip(uuid, text, text, integer) from public, anon;
grant execute on function public.publish_trip(uuid, text, text, integer) to authenticated;

create or replace function public.update_my_route(p_route_id uuid, p_title text, p_description text, p_price_agorot integer, p_unpublish boolean default false)
returns public.route_status language plpgsql security definer set search_path = public as $$
declare
  r public.published_trips%rowtype;
begin
  select * into r from public.published_trips where id = p_route_id and creator_id = auth.uid();
  if not found then raise exception 'route not found' using errcode = 'P0002'; end if;
  if p_unpublish then
    update public.published_trips set status = 'unpublished' where id = p_route_id;
    return 'unpublished';
  end if;
  if p_price_agorot <> 0 and (p_price_agorot < public.setting_numeric('min_price_agorot')
                              or p_price_agorot > public.setting_numeric('max_price_agorot')) then
    raise exception 'price out of range' using errcode = '22023';
  end if;
  -- A route the admin took down stays down; anything else goes (back) to the store right away.
  update public.published_trips
     set title = p_title, description = p_description, price_agorot = p_price_agorot, review_note = null,
         status = case when r.status = 'rejected' then 'rejected'::public.route_status else 'published'::public.route_status end,
         published_at = coalesce(published_at, now())
   where id = p_route_id;
  return case when r.status = 'rejected' then 'rejected'::public.route_status else 'published'::public.route_status end;
end $$;
revoke execute on function public.update_my_route(uuid, text, text, integer, boolean) from public, anon;
grant execute on function public.update_my_route(uuid, text, text, integer, boolean) to authenticated;
