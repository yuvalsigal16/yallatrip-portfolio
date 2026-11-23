-- =====================================================================
-- GoTrip · Phases 12–15 · Creators, marketplace, payments, reviews, admin
-- Money is stored in agorot (1 ₪ = 100) as integers: no rounding errors.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Helpers
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 1. Platform settings (commission rate lives here, not in code)
-- ---------------------------------------------------------------------
create table public.platform_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);
insert into public.platform_settings (key, value) values
  ('commission_rate', '0.20'),       -- platform share of each sale
  ('min_price_agorot', '500'),       -- 5 ₪
  ('max_price_agorot', '50000');     -- 500 ₪
alter table public.platform_settings enable row level security;
create policy settings_read on public.platform_settings for select to anon, authenticated using (true);
revoke insert, update, delete on public.platform_settings from anon, authenticated;

create or replace function public.setting_numeric(p_key text)
returns numeric language sql stable security definer set search_path = public as $$
  select (value #>> '{}')::numeric from public.platform_settings where key = p_key;
$$;

-- ---------------------------------------------------------------------
-- 2. Snapshots: a published route is a frozen private copy of the trip,
--    so later edits to the creator's trip never change what was sold.
--    Snapshot trips are invisible and read-only for everyone through the API.
-- ---------------------------------------------------------------------
alter table public.trips add column is_snapshot boolean not null default false;

drop policy trips_owner_all on public.trips;
create policy trips_owner_all on public.trips for all to authenticated
  using (owner_id = auth.uid() and not is_snapshot)
  with check (owner_id = auth.uid() and not is_snapshot);

create or replace function public.is_trip_owner(p_trip_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.trips where id = p_trip_id and owner_id = auth.uid() and not is_snapshot);
$$;

-- ---------------------------------------------------------------------
-- 3. Creators
-- ---------------------------------------------------------------------
create table public.creators (
  user_id      uuid primary key references public.profiles (id) on delete cascade,
  slug         text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$'),
  display_name text not null check (char_length(display_name) between 2 and 60),
  bio          text check (char_length(bio) <= 1000),
  avatar_url   text check (char_length(avatar_url) <= 500),
  payout_details_set boolean not null default false,  -- bank details are kept by the payment provider, never here
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger creators_updated_at before update on public.creators for each row execute function public.set_updated_at();
alter table public.creators enable row level security;
create policy creators_read on public.creators for select to anon, authenticated using (true);
create policy creators_update_own on public.creators for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke insert, update, delete on public.creators from anon, authenticated;
grant update (display_name, bio, avatar_url) on public.creators to authenticated;

create or replace function public.become_creator(p_slug text, p_display_name text, p_bio text default null)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  insert into public.creators (user_id, slug, display_name, bio) values (uid, lower(p_slug), p_display_name, p_bio);
  update public.profiles set role = 'creator' where id = uid and role = 'user';
end $$;
revoke execute on function public.become_creator(text, text, text) from public, anon;
grant execute on function public.become_creator(text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Published routes
-- ---------------------------------------------------------------------
create type public.route_status as enum ('pending', 'published', 'rejected', 'unpublished');

create table public.published_trips (
  id               uuid primary key default gen_random_uuid(),
  creator_id       uuid not null references public.creators (user_id) on delete cascade,
  source_trip_id   uuid references public.trips (id) on delete set null,
  snapshot_trip_id uuid not null references public.trips (id) on delete restrict,
  title            text not null check (char_length(title) between 3 and 100),
  description      text not null check (char_length(description) between 20 and 3000),
  destination_name text not null,
  days_count       integer not null,
  places_count     integer not null,
  price_agorot     integer not null check (price_agorot >= 0 and price_agorot <= 100000),
  currency         text not null default 'ILS' check (currency = 'ILS'),
  status           public.route_status not null default 'pending',
  review_note      text check (char_length(review_note) <= 500),  -- why it was rejected
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index published_trips_status_idx on public.published_trips (status, published_at desc);
create index published_trips_creator_idx on public.published_trips (creator_id);
create trigger published_trips_updated_at before update on public.published_trips for each row execute function public.set_updated_at();
alter table public.published_trips enable row level security;
create policy routes_read_published on public.published_trips for select to anon, authenticated using (status = 'published');
create policy routes_read_own on public.published_trips for select to authenticated using (creator_id = auth.uid());
create policy routes_admin on public.published_trips for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke insert, update, delete on public.published_trips from anon, authenticated;
grant update on public.published_trips to authenticated; -- admin policy above; creators go through functions

-- Publish: freeze a copy of the trip and send it for review.
create or replace function public.publish_trip(p_trip_id uuid, p_title text, p_description text, p_price_agorot integer)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  t public.trips%rowtype;
  snap uuid;
  rid uuid;
  n_places int;
begin
  if not exists (select 1 from public.creators where user_id = uid) then
    raise exception 'only creators can publish' using errcode = '42501';
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
                                      days_count, places_count, price_agorot)
  values (uid, p_trip_id, snap, p_title, p_description, t.destination_name,
          (select count(*) from public.trip_days where trip_id = snap), n_places, p_price_agorot)
  returning id into rid;
  return rid;
end $$;
revoke execute on function public.publish_trip(uuid, text, text, integer) from public, anon;
grant execute on function public.publish_trip(uuid, text, text, integer) to authenticated;

-- Creator edits text/price (goes back to review), or unpublishes.
create or replace function public.update_my_route(p_route_id uuid, p_title text, p_description text, p_price_agorot integer, p_unpublish boolean default false)
returns public.route_status language plpgsql security definer set search_path = public as $$
declare
  r public.published_trips%rowtype;
  new_status public.route_status;
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
  new_status := 'pending';
  update public.published_trips
     set title = p_title, description = p_description, price_agorot = p_price_agorot, status = new_status, review_note = null
   where id = p_route_id;
  return new_status;
end $$;
revoke execute on function public.update_my_route(uuid, text, text, integer, boolean) from public, anon;
grant execute on function public.update_my_route(uuid, text, text, integer, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Purchases (free "get" counts too: it is what allows a review)
-- ---------------------------------------------------------------------
create table public.purchases (
  id                    uuid primary key default gen_random_uuid(),
  buyer_id              uuid not null references public.profiles (id) on delete cascade,
  published_trip_id     uuid not null references public.published_trips (id) on delete restrict,
  amount_agorot         integer not null check (amount_agorot >= 0),
  commission_agorot     integer not null check (commission_agorot >= 0),
  creator_amount_agorot integer not null check (creator_amount_agorot >= 0),
  commission_rate       numeric(5, 4) not null,
  provider              text not null check (provider in ('free', 'stripe', 'payplus', 'grow', 'manual')),
  provider_ref          text unique,  -- the provider's checkout/payment id: makes webhooks idempotent
  status                text not null default 'paid' check (status in ('paid', 'refunded')),
  copied_trip_id        uuid references public.trips (id) on delete set null,
  created_at            timestamptz not null default now(),
  check (amount_agorot = commission_agorot + creator_amount_agorot)
);
create unique index purchases_one_per_buyer on public.purchases (buyer_id, published_trip_id) where status = 'paid';
alter table public.purchases enable row level security;
create policy purchases_buyer on public.purchases for select to authenticated using (buyer_id = auth.uid());
create policy purchases_creator on public.purchases for select to authenticated
  using (exists (select 1 from public.published_trips r where r.id = published_trip_id and r.creator_id = auth.uid()));
create policy purchases_admin on public.purchases for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.purchases from anon, authenticated;

create or replace function public._grant_route(p_buyer uuid, p_route uuid, p_amount integer, p_provider text, p_ref text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  r public.published_trips%rowtype;
  existing uuid;
  copy_id uuid;
  rate numeric := coalesce(public.setting_numeric('commission_rate'), 0.2);
  fee integer;
begin
  if p_ref is not null then
    select copied_trip_id into existing from public.purchases where provider_ref = p_ref;
    if found then return existing; end if;  -- same webhook twice
  end if;
  select copied_trip_id into existing from public.purchases where buyer_id = p_buyer and published_trip_id = p_route and status = 'paid';
  if found then return existing; end if;    -- already owns it

  select * into r from public.published_trips where id = p_route;
  if not found then raise exception 'route not found' using errcode = 'P0002'; end if;
  if p_amount < r.price_agorot then raise exception 'amount below price' using errcode = '22023'; end if;

  copy_id := public.copy_trip_internal(r.snapshot_trip_id, p_buyer, r.title);
  fee := round(p_amount * rate);
  insert into public.purchases (buyer_id, published_trip_id, amount_agorot, commission_agorot, creator_amount_agorot,
                                commission_rate, provider, provider_ref, copied_trip_id)
  values (p_buyer, p_route, p_amount, fee, p_amount - fee, rate, p_provider, p_ref, copy_id);
  return copy_id;
end $$;
revoke execute on function public._grant_route(uuid, uuid, integer, text, text) from public, anon, authenticated;

-- Free routes: the signed-in user gets a copy right away.
create or replace function public.acquire_free_route(p_route uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare r public.published_trips%rowtype;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select * into r from public.published_trips where id = p_route and status = 'published';
  if not found then raise exception 'route not found' using errcode = 'P0002'; end if;
  if r.price_agorot <> 0 then raise exception 'this route is not free' using errcode = '42501'; end if;
  return public._grant_route(auth.uid(), p_route, 0, 'free', null);
end $$;
revoke execute on function public.acquire_free_route(uuid) from public, anon;
grant execute on function public.acquire_free_route(uuid) to authenticated;

-- Paid routes: called only by our server after the payment provider confirms (webhook).
create or replace function public.record_paid_purchase(p_buyer uuid, p_route uuid, p_amount integer, p_provider text, p_ref text)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  if p_ref is null then raise exception 'provider reference required' using errcode = '22023'; end if;
  return public._grant_route(p_buyer, p_route, p_amount, p_provider, p_ref);
end $$;
revoke execute on function public.record_paid_purchase(uuid, uuid, integer, text, text) from public, anon, authenticated;
grant execute on function public.record_paid_purchase(uuid, uuid, integer, text, text) to service_role;

-- ---------------------------------------------------------------------
-- 6. Payouts to creators (recorded by an admin after paying them)
-- ---------------------------------------------------------------------
create table public.payouts (
  id            uuid primary key default gen_random_uuid(),
  creator_id    uuid not null references public.creators (user_id) on delete restrict,
  amount_agorot integer not null check (amount_agorot > 0),
  reference     text check (char_length(reference) <= 200),
  paid_at       timestamptz not null default now(),
  recorded_by   uuid references public.profiles (id) on delete set null
);
alter table public.payouts enable row level security;
create policy payouts_own on public.payouts for select to authenticated using (creator_id = auth.uid() or public.is_admin());
revoke insert, update, delete on public.payouts from anon, authenticated;

create or replace view public.creator_balances with (security_invoker = true) as
select c.user_id as creator_id, c.display_name, c.slug,
       coalesce((select sum(p.creator_amount_agorot) from public.purchases p join public.published_trips r on r.id = p.published_trip_id
                  where r.creator_id = c.user_id and p.status = 'paid'), 0)::integer as earned_agorot,
       coalesce((select sum(amount_agorot) from public.payouts po where po.creator_id = c.user_id), 0)::integer as paid_out_agorot,
       coalesce((select count(*) from public.purchases p join public.published_trips r on r.id = p.published_trip_id
                  where r.creator_id = c.user_id and p.status = 'paid' and p.amount_agorot > 0), 0)::integer as sales_count
  from public.creators c
 where c.user_id = auth.uid() or public.is_admin();
grant select on public.creator_balances to authenticated;

-- ---------------------------------------------------------------------
-- 7. Reviews: only from someone who got the route; one per purchase
-- ---------------------------------------------------------------------
create table public.reviews (
  id                uuid primary key default gen_random_uuid(),
  purchase_id       uuid not null unique references public.purchases (id) on delete cascade,
  published_trip_id uuid not null references public.published_trips (id) on delete cascade,
  author_id         uuid not null references public.profiles (id) on delete cascade,
  rating            smallint not null check (rating between 1 and 5),
  body              text check (char_length(body) <= 2000),
  status            text not null default 'visible' check (status in ('visible', 'hidden')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index reviews_route_idx on public.reviews (published_trip_id, created_at desc);
create trigger reviews_updated_at before update on public.reviews for each row execute function public.set_updated_at();
alter table public.reviews enable row level security;
create policy reviews_read on public.reviews for select to anon, authenticated using (status = 'visible' or author_id = auth.uid() or public.is_admin());
create policy reviews_delete_own on public.reviews for delete to authenticated using (author_id = auth.uid());
create policy reviews_admin on public.reviews for update to authenticated using (public.is_admin()) with check (public.is_admin());
revoke insert, update on public.reviews from anon, authenticated;
grant update (status) on public.reviews to authenticated;

create or replace function public.submit_review(p_route uuid, p_rating integer, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  pid uuid;
  rid uuid;
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if exists (select 1 from public.published_trips where id = p_route and creator_id = uid) then
    raise exception 'creators cannot review their own route' using errcode = '42501';
  end if;
  select id into pid from public.purchases where buyer_id = uid and published_trip_id = p_route and status = 'paid';
  if pid is null then raise exception 'only people who got the route can review it' using errcode = '42501'; end if;
  insert into public.reviews (purchase_id, published_trip_id, author_id, rating, body)
  values (pid, p_route, uid, p_rating, nullif(trim(p_body), ''))
  on conflict (purchase_id) do update set rating = excluded.rating, body = excluded.body
  returning id into rid;
  return rid;
end $$;
revoke execute on function public.submit_review(uuid, integer, text) from public, anon;
grant execute on function public.submit_review(uuid, integer, text) to authenticated;

-- ---------------------------------------------------------------------
-- 8. Reports (flag a route, review or creator)
-- ---------------------------------------------------------------------
create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('route', 'review', 'creator')),
  target_id   uuid not null,
  reason      text not null check (char_length(reason) between 5 and 1000),
  status      text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at  timestamptz not null default now()
);
alter table public.reports enable row level security;
create policy reports_insert_own on public.reports for insert to authenticated with check (reporter_id = auth.uid() and status = 'open');
create policy reports_read on public.reports for select to authenticated using (reporter_id = auth.uid() or public.is_admin());
create policy reports_admin on public.reports for update to authenticated using (public.is_admin()) with check (public.is_admin());
revoke delete on public.reports from anon, authenticated;

-- ---------------------------------------------------------------------
-- 9. Public catalogue: published routes with creator, rating and popularity
-- ---------------------------------------------------------------------
create or replace view public.routes_catalog as
select r.id, r.title, r.description, r.destination_name, r.days_count, r.places_count, r.price_agorot, r.currency,
       r.published_at, c.slug as creator_slug, c.display_name as creator_name, c.avatar_url as creator_avatar,
       coalesce(rv.avg_rating, 0)::numeric(3, 2) as rating_avg, coalesce(rv.cnt, 0)::integer as rating_count,
       coalesce(pu.cnt, 0)::integer as acquisitions
  from public.published_trips r
  join public.creators c on c.user_id = r.creator_id
  left join (select published_trip_id, avg(rating) as avg_rating, count(*) as cnt from public.reviews where status = 'visible' group by 1) rv
         on rv.published_trip_id = r.id
  left join (select published_trip_id, count(*) as cnt from public.purchases where status = 'paid' group by 1) pu
         on pu.published_trip_id = r.id
 where r.status = 'published';
grant select on public.routes_catalog to anon, authenticated;

create or replace view public.reviews_public as
select rv.id, rv.published_trip_id, rv.rating, rv.body, rv.created_at, coalesce(split_part(p.display_name, ' ', 1), 'מטייל/ת') as author_first_name
  from public.reviews rv join public.profiles p on p.id = rv.author_id
 where rv.status = 'visible';
grant select on public.reviews_public to anon, authenticated;

-- A route's preview for its store page: day names and counts for every day,
-- full stops (names + categories, no notes) for day 1 only. Buyers see everything in their copy.
create or replace function public.route_preview(p_route uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'days', coalesce((
      select jsonb_agg(jsonb_build_object(
        'day_index', d.day_index, 'title', d.title,
        'stop_count', (select count(*) from public.trip_places tp where tp.trip_day_id = d.id),
        'categories', (select coalesce(jsonb_agg(distinct c.key), '[]'::jsonb)
                         from public.trip_places tp join public.saved_places sp on sp.id = tp.saved_place_id
                         left join public.categories c on c.id = sp.category_id where tp.trip_day_id = d.id and c.key is not null),
        'stops', case when d.day_index = 1 then coalesce((
          select jsonb_agg(jsonb_build_object('label', sp.label, 'category_key', c.key) order by tp.position)
            from public.trip_places tp join public.saved_places sp on sp.id = tp.saved_place_id
            left join public.categories c on c.id = sp.category_id where tp.trip_day_id = d.id), '[]'::jsonb) else null end)
        order by d.day_index)
      from public.trip_days d where d.trip_id = r.snapshot_trip_id), '[]'::jsonb))
  from public.published_trips r
  where r.id = p_route and (r.status = 'published' or r.creator_id = auth.uid() or public.is_admin());
$$;
grant execute on function public.route_preview(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 10. Admin tools (Phase 15). Every one checks is_admin() itself.
-- ---------------------------------------------------------------------
create or replace function public.admin_set_route_status(p_route uuid, p_status public.route_status, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  update public.published_trips
     set status = p_status, review_note = p_note,
         published_at = case when p_status = 'published' then coalesce(published_at, now()) else published_at end
   where id = p_route;
end $$;

create or replace function public.admin_set_role(p_user uuid, p_role public.user_role)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  if p_user = auth.uid() and p_role <> 'admin' then raise exception 'you cannot remove your own admin role' using errcode = '42501'; end if;
  update public.profiles set role = p_role where id = p_user;
end $$;

create or replace function public.admin_set_setting(p_key text, p_value jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  if p_key = 'commission_rate' and ((p_value #>> '{}')::numeric < 0 or (p_value #>> '{}')::numeric > 0.5) then
    raise exception 'commission must be between 0 and 0.5' using errcode = '22023';
  end if;
  update public.platform_settings set value = p_value, updated_at = now(), updated_by = auth.uid() where key = p_key;
  if not found then raise exception 'unknown setting' using errcode = 'P0002'; end if;
end $$;

create or replace function public.admin_record_payout(p_creator uuid, p_amount integer, p_reference text)
returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid; bal integer;
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  select earned_agorot - paid_out_agorot into bal from public.creator_balances where creator_id = p_creator;
  if bal is null or p_amount > bal then raise exception 'payout larger than the balance' using errcode = '22023'; end if;
  insert into public.payouts (creator_id, amount_agorot, reference, recorded_by) values (p_creator, p_amount, p_reference, auth.uid())
  returning id into pid;
  return pid;
end $$;

create or replace function public.admin_resolve_report(p_report uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  if p_status not in ('resolved', 'dismissed') then raise exception 'bad status' using errcode = '22023'; end if;
  update public.reports set status = p_status, resolved_by = auth.uid(), resolved_at = now() where id = p_report;
end $$;

create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  return jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'users_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'trips', (select count(*) from public.trips where not is_snapshot),
    'saved_places', (select count(*) from public.saved_places sp join public.trips t on t.id = sp.trip_id where not t.is_snapshot),
    'creators', (select count(*) from public.creators),
    'routes_published', (select count(*) from public.published_trips where status = 'published'),
    'routes_pending', (select count(*) from public.published_trips where status = 'pending'),
    'sales', (select count(*) from public.purchases where status = 'paid' and amount_agorot > 0),
    'revenue_agorot', (select coalesce(sum(amount_agorot), 0) from public.purchases where status = 'paid'),
    'commission_agorot', (select coalesce(sum(commission_agorot), 0) from public.purchases where status = 'paid'),
    'reports_open', (select count(*) from public.reports where status = 'open'));
end $$;

create or replace function public.admin_list_users(p_search text default null, p_limit integer default 50)
returns table (id uuid, email text, display_name text, role public.user_role, created_at timestamptz, trips bigint)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  return query
    select p.id, u.email::text, p.display_name, p.role, p.created_at,
           (select count(*) from public.trips t where t.owner_id = p.id and not t.is_snapshot)
      from public.profiles p join auth.users u on u.id = p.id
     where p_search is null or u.email ilike '%' || p_search || '%' or p.display_name ilike '%' || p_search || '%'
     order by p.created_at desc
     limit least(greatest(p_limit, 1), 200);
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'admin_set_route_status(uuid, public.route_status, text)', 'admin_set_role(uuid, public.user_role)',
    'admin_set_setting(text, jsonb)', 'admin_record_payout(uuid, integer, text)', 'admin_resolve_report(uuid, text)',
    'admin_stats()', 'admin_list_users(text, integer)']
  loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- The first admin is set by hand, once, in the SQL editor:
--   update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');
