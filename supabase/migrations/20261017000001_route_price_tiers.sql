-- Route pricing by length. A short route (up to 5 days, e.g. 3 days in Rome) costs at most 59 ₪ and
-- GoTrip keeps 20% of each sale; a long route (6+ days, e.g. 10 days in Japan) costs at most 149 ₪ and
-- GoTrip keeps 30%. The admin can change these numbers; the database enforces them.

insert into public.platform_settings (key, value) values
  ('short_route_max_days', '5'),
  ('short_max_price_agorot', '5900'),
  ('long_max_price_agorot', '14900'),
  ('short_commission_rate', '0.20'),
  ('long_commission_rate', '0.30')
on conflict (key) do nothing;

create or replace function public.route_is_short(p_days int) returns boolean
language sql stable set search_path = public as $$
  select coalesce(p_days, 0) <= coalesce(public.setting_numeric('short_route_max_days'), 5)
$$;

create or replace function public.route_max_price(p_days int) returns numeric
language sql stable set search_path = public as $$
  select case when public.route_is_short(p_days)
    then coalesce(public.setting_numeric('short_max_price_agorot'), 5900)
    else coalesce(public.setting_numeric('long_max_price_agorot'), 14900) end
$$;

create or replace function public.route_commission(p_days int) returns numeric
language sql stable set search_path = public as $$
  select case when public.route_is_short(p_days)
    then coalesce(public.setting_numeric('short_commission_rate'), 0.2)
    else coalesce(public.setting_numeric('long_commission_rate'), 0.3) end
$$;

create or replace function public.publish_trip(p_trip_id uuid, p_title text, p_description text, p_price_agorot integer)
returns uuid language plpgsql security definer set search_path = public as $function$
declare
  uid uuid := auth.uid();
  t public.trips%rowtype;
  snap uuid;
  rid uuid;
  n_places int;
  n_days int;
begin
  if not exists (select 1 from public.creators c join public.profiles p on p.id = c.user_id
                  where c.user_id = uid and p.role in ('creator', 'admin')) then
    raise exception 'only approved creators can publish' using errcode = '42501';
  end if;
  select * into t from public.trips where id = p_trip_id and owner_id = uid and not is_snapshot;
  if not found then raise exception 'trip not found' using errcode = 'P0002'; end if;
  -- Trips shared with other people stay private between them.
  if exists (select 1 from public.trip_members where trip_id = p_trip_id) then
    raise exception 'shared trips cannot be published' using errcode = '42501';
  end if;
  select count(*) into n_days from public.trip_days where trip_id = p_trip_id;
  if p_price_agorot <> 0 and (p_price_agorot < public.setting_numeric('min_price_agorot')
                              or p_price_agorot > public.route_max_price(n_days)) then
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
end $function$;

create or replace function public.update_my_route(p_route_id uuid, p_title text, p_description text, p_price_agorot integer, p_unpublish boolean default false)
returns public.route_status language plpgsql security definer set search_path = public as $function$
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
                              or p_price_agorot > public.route_max_price(r.days_count)) then
    raise exception 'price out of range' using errcode = '22023';
  end if;
  update public.published_trips
     set title = p_title, description = p_description, price_agorot = p_price_agorot, review_note = null,
         status = case when r.status = 'rejected' then 'rejected'::public.route_status else 'published'::public.route_status end,
         published_at = coalesce(published_at, now())
   where id = p_route_id;
  return case when r.status = 'rejected' then 'rejected'::public.route_status else 'published'::public.route_status end;
end $function$;

-- The commission of each sale follows the route's length (20% short, 30% long) and is kept on the purchase.
create or replace function public._grant_route(p_buyer uuid, p_route uuid, p_amount integer, p_provider text, p_ref text)
returns uuid language plpgsql security definer set search_path = public as $function$
declare
  r public.published_trips%rowtype;
  existing uuid;
  copy_id uuid;
  rate numeric;
  fee integer;
begin
  if p_ref is not null then
    select copied_trip_id into existing from public.purchases where provider_ref = p_ref;
    if found then return existing; end if;
  end if;
  select copied_trip_id into existing from public.purchases where buyer_id = p_buyer and published_trip_id = p_route and status = 'paid';
  if found then return existing; end if;

  select * into r from public.published_trips where id = p_route;
  if not found then raise exception 'route not found' using errcode = 'P0002'; end if;
  if p_amount < r.price_agorot then raise exception 'amount below price' using errcode = '22023'; end if;

  rate := public.route_commission(r.days_count);
  copy_id := public.copy_trip_internal(r.snapshot_trip_id, p_buyer, r.title);
  fee := round(p_amount * rate);
  insert into public.purchases (buyer_id, published_trip_id, amount_agorot, commission_agorot, creator_amount_agorot,
                                commission_rate, provider, provider_ref, copied_trip_id)
  values (p_buyer, p_route, p_amount, fee, p_amount - fee, rate, p_provider, p_ref, copy_id);
  return copy_id;
end $function$;

create or replace function public.admin_set_setting(p_key text, p_value jsonb)
returns void language plpgsql security definer set search_path = public as $function$
declare v numeric := (p_value #>> '{}')::numeric;
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  if p_key in ('commission_rate', 'short_commission_rate', 'long_commission_rate') and (v < 0 or v > 0.5) then
    raise exception 'commission must be between 0 and 0.5' using errcode = '22023';
  end if;
  if p_key in ('short_max_price_agorot', 'long_max_price_agorot') and (v < 500 or v > 100000) then
    raise exception 'max price out of range' using errcode = '22023';
  end if;
  if p_key = 'short_route_max_days' and (v < 1 or v > 60 or v <> trunc(v)) then
    raise exception 'short route days out of range' using errcode = '22023';
  end if;
  update public.platform_settings set value = p_value, updated_at = now(), updated_by = auth.uid() where key = p_key;
  if not found then raise exception 'unknown setting' using errcode = 'P0002'; end if;
end $function$;

-- Helpers used only inside the functions above.
revoke execute on function public.route_is_short(int), public.route_max_price(int), public.route_commission(int)
  from public, anon, authenticated;
