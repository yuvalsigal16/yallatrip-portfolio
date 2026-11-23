-- GoTrip: full database setup in one file (all migrations in order + categories).
-- Supabase -> SQL Editor -> New query -> paste everything -> Run. Run it once, on a new project.
-- Generated from supabase/migrations/*.sql and supabase/seed.sql; edit those, not this file.

-- ===== supabase/migrations/20260924000001_init.sql =====
-- =====================================================================
-- GoTrip · Phase 3 · Initial schema (MVP)
-- Tables, relationships, Row Level Security, triggers.
-- Phase 2 tables (creators, published trips, purchases, payments,
-- reviews, platform settings) arrive in a later migration.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------
create type public.user_role      as enum ('user', 'creator', 'admin');
create type public.budget_level   as enum ('low', 'medium', 'high');
create type public.transport_mode as enum ('walk', 'transit', 'car', 'taxi');
create type public.place_status   as enum ('saved', 'planned', 'visited');
create type public.trip_visibility as enum ('private', 'link', 'public');
create type public.rec_action     as enum ('shown', 'added', 'dismissed');

-- ---------------------------------------------------------------------
-- 2. Shared helpers
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 3. Users: profile + preferences
--    auth.users is managed by Supabase Auth; profiles extends it.
-- ---------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  avatar_url   text check (char_length(avatar_url) <= 500),
  role         public.user_role not null default 'user',
  locale       text not null default 'he' check (locale in ('he', 'en')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.user_preferences (
  user_id           uuid primary key references public.profiles (id) on delete cascade,
  travel_styles     text[] not null default '{}',
  budget_level      public.budget_level,
  default_transport public.transport_mode[] not null default '{walk,transit}',
  updated_at        timestamptz not null default now()
);
create trigger user_preferences_updated_at before update on public.user_preferences
  for each row execute function public.set_updated_at();

-- A new sign-up gets a profile row automatically.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 4. Categories (seeded; extendable without code changes)
-- ---------------------------------------------------------------------
create table public.categories (
  id         smallint generated always as identity primary key,
  key        text not null unique check (key ~ '^[a-z_]{2,30}$'),
  name_he    text not null,
  name_en    text not null,
  icon       text not null,
  color      text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order smallint not null default 0,
  is_active  boolean not null default true
);

-- ---------------------------------------------------------------------
-- 5. Places: one row per Google place, shared by all trips.
--    We keep only the id, the coordinates and the type. Everything else
--    (address, hours, rating, photos) is fetched live from Google, per
--    its terms. Coordinates are refreshed when synced_at is 30+ days old.
-- ---------------------------------------------------------------------
create table public.places (
  id              uuid primary key default gen_random_uuid(),
  google_place_id text not null unique check (char_length(google_place_id) between 10 and 300),
  lat             double precision not null check (lat between -90 and 90),
  lng             double precision not null check (lng between -180 and 180),
  primary_type    text,
  synced_at       timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 6. Trips
-- ---------------------------------------------------------------------
create table public.trips (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null references public.profiles (id) on delete cascade,
  title                text not null check (char_length(title) between 1 and 120),
  destination_name     text not null check (char_length(destination_name) between 1 and 200),
  destination_place_id text,
  center_lat           double precision check (center_lat between -90 and 90),
  center_lng           double precision check (center_lng between -180 and 180),
  start_date           date,
  end_date             date,
  travelers_count      smallint not null default 1 check (travelers_count between 1 and 50),
  transport_modes      public.transport_mode[] not null default '{walk,transit}',
  travel_styles        text[] not null default '{}',
  budget_level         public.budget_level,
  hotel_saved_place_id uuid,  -- FK added after saved_places exists
  visibility           public.trip_visibility not null default 'private',
  share_token          text unique,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint trip_dates_both_or_none check ((start_date is null) = (end_date is null)),
  constraint trip_dates_order check (end_date >= start_date),
  -- Long trips are welcome (half a year and more); one year is the ceiling.
  constraint trip_max_length check (end_date - start_date <= 365)
);
create index trips_owner_idx on public.trips (owner_id, start_date);
create trigger trips_updated_at before update on public.trips
  for each row execute function public.set_updated_at();

-- Share token: created when the trip becomes shareable, removed when private.
create or replace function public.trips_share_token()
returns trigger language plpgsql as $$
begin
  if new.visibility = 'private' then
    new.share_token := null;
  elsif new.share_token is null then
    new.share_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  end if;
  return new;
end $$;
create trigger trips_share_token before insert or update of visibility on public.trips
  for each row execute function public.trips_share_token();

-- ---------------------------------------------------------------------
-- 7. Trip days
-- ---------------------------------------------------------------------
create table public.trip_days (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips (id) on delete cascade,
  day_index  smallint not null check (day_index >= 1),
  date       date,
  title      text check (char_length(title) <= 120),
  start_time time,
  notes      text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, day_index),
  unique (id, trip_id)            -- target for composite FKs below
);
create trigger trip_days_updated_at before update on public.trip_days
  for each row execute function public.set_updated_at();

-- Keep days in step with the trip's dates: add missing days, re-date
-- existing ones, remove days past the new end (their stops go back to
-- "unscheduled"; the saved places themselves are kept).
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
    return new;  -- open dates: days are managed by hand
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
create trigger trips_sync_days after insert or update of start_date, end_date on public.trips
  for each row execute function public.sync_trip_days();

-- ---------------------------------------------------------------------
-- 8. Saved places ("מה שמרתי")
-- ---------------------------------------------------------------------
create table public.saved_places (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null references public.trips (id) on delete cascade,
  place_id      uuid not null references public.places (id) on delete restrict,
  category_id   smallint references public.categories (id) on delete set null,
  label         text not null check (char_length(label) between 1 and 200),
  is_must       boolean not null default false,
  personal_note text check (char_length(personal_note) <= 2000),
  status        public.place_status not null default 'saved',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (trip_id, place_id),
  unique (id, trip_id)
);
create index saved_places_trip_idx on public.saved_places (trip_id, category_id);
create trigger saved_places_updated_at before update on public.saved_places
  for each row execute function public.set_updated_at();

alter table public.trips
  add constraint trips_hotel_fk foreign key (hotel_saved_place_id, id)
  references public.saved_places (id, trip_id) on delete set null (hotel_saved_place_id);

-- ---------------------------------------------------------------------
-- 9. Trip places: a saved place scheduled on a day.
--    Composite FKs guarantee the day and the place belong to the same trip.
--    position is fractional so a stop can be dropped between two others
--    without renumbering the whole day.
-- ---------------------------------------------------------------------
create table public.trip_places (
  id                uuid primary key default gen_random_uuid(),
  trip_id           uuid not null references public.trips (id) on delete cascade,
  trip_day_id       uuid not null,
  saved_place_id    uuid not null,
  position          double precision not null,
  planned_time      time,
  duration_min      smallint check (duration_min between 0 and 1440),
  transport_to_next public.transport_mode,
  note              text check (char_length(note) <= 2000),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  foreign key (trip_day_id, trip_id)    references public.trip_days (id, trip_id) on delete cascade,
  foreign key (saved_place_id, trip_id) references public.saved_places (id, trip_id) on delete cascade
);
create index trip_places_day_idx on public.trip_places (trip_day_id, position);
create index trip_places_saved_idx on public.trip_places (saved_place_id);
create trigger trip_places_updated_at before update on public.trip_places
  for each row execute function public.set_updated_at();

-- Status follows scheduling: scheduled -> 'planned'; removed from every
-- day -> back to 'saved'. 'visited' is the user's call and is never undone here.
create or replace function public.sync_saved_place_status()
returns trigger language plpgsql as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    update public.saved_places set status = 'planned'
     where id = new.saved_place_id and status = 'saved';
  end if;
  if tg_op in ('DELETE', 'UPDATE') then
    if tg_op = 'DELETE' or old.saved_place_id <> new.saved_place_id then
      update public.saved_places sp set status = 'saved'
       where sp.id = old.saved_place_id and sp.status = 'planned'
         and not exists (select 1 from public.trip_places tp where tp.saved_place_id = sp.id);
    end if;
  end if;
  return null;
end $$;
create trigger trip_places_status after insert or update of saved_place_id or delete on public.trip_places
  for each row execute function public.sync_saved_place_status();

-- ---------------------------------------------------------------------
-- 10. Recommendation log (what was suggested, what was added)
-- ---------------------------------------------------------------------
create table public.recommendation_events (
  id                    bigint generated always as identity primary key,
  trip_id               uuid not null references public.trips (id) on delete cascade,
  anchor_saved_place_id uuid references public.saved_places (id) on delete set null,
  google_place_id       text not null,
  category_key          text,
  action                public.rec_action not null,
  created_at            timestamptz not null default now()
);
create index recommendation_events_trip_idx on public.recommendation_events (trip_id, created_at);

-- ---------------------------------------------------------------------
-- 11. API usage quota (cost control for Google calls)
-- ---------------------------------------------------------------------
create table public.api_usage (
  user_id  uuid not null references public.profiles (id) on delete cascade,
  day      date not null default current_date,
  endpoint text not null,
  count    integer not null default 0,
  primary key (user_id, day, endpoint)
);

-- Adds one call and says whether the user is still under the daily limit.
create or replace function public.consume_api_quota(p_endpoint text, p_daily_limit integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  new_count integer;
begin
  if uid is null then
    return false;
  end if;
  insert into public.api_usage (user_id, day, endpoint, count)
  values (uid, current_date, p_endpoint, 1)
  on conflict (user_id, day, endpoint) do update set count = public.api_usage.count + 1
  returning count into new_count;
  return new_count <= p_daily_limit;
end $$;
revoke execute on function public.consume_api_quota(text, integer) from public, anon;
grant execute on function public.consume_api_quota(text, integer) to authenticated;

-- ---------------------------------------------------------------------
-- 12. Row Level Security
-- ---------------------------------------------------------------------
-- Ownership check that bypasses RLS on trips (avoids policy recursion).
create or replace function public.is_trip_owner(p_trip_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.trips where id = p_trip_id and owner_id = auth.uid());
$$;

create or replace function public.is_trip_public(p_trip_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.trips where id = p_trip_id and visibility = 'public');
$$;

alter table public.profiles              enable row level security;
alter table public.user_preferences      enable row level security;
alter table public.categories            enable row level security;
alter table public.places                enable row level security;
alter table public.trips                 enable row level security;
alter table public.trip_days             enable row level security;
alter table public.saved_places          enable row level security;
alter table public.trip_places           enable row level security;
alter table public.recommendation_events enable row level security;
alter table public.api_usage             enable row level security;

-- profiles: see and edit yourself. The role column is not editable by users.
create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (display_name, avatar_url, locale) on public.profiles to authenticated;

-- preferences: yours only
create policy prefs_all_own on public.user_preferences for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- categories: readable by everyone, written only by admins via the service role
create policy categories_read on public.categories for select to anon, authenticated using (is_active);
revoke insert, update, delete on public.categories from anon, authenticated;

-- places: shared cache; signed-in users read and add, never edit or delete
create policy places_read on public.places for select to authenticated using (true);
create policy places_insert on public.places for insert to authenticated with check (true);
revoke update, delete on public.places from anon, authenticated;

-- trips: the owner does everything; public trips are readable by all
create policy trips_owner_all on public.trips for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy trips_public_read on public.trips for select to anon, authenticated
  using (visibility = 'public');

-- children of a trip: follow the trip
create policy trip_days_owner on public.trip_days for all to authenticated
  using (public.is_trip_owner(trip_id)) with check (public.is_trip_owner(trip_id));
create policy trip_days_public on public.trip_days for select to anon, authenticated
  using (public.is_trip_public(trip_id));

create policy saved_places_owner on public.saved_places for all to authenticated
  using (public.is_trip_owner(trip_id)) with check (public.is_trip_owner(trip_id));
create policy saved_places_public on public.saved_places for select to anon, authenticated
  using (public.is_trip_public(trip_id));

create policy trip_places_owner on public.trip_places for all to authenticated
  using (public.is_trip_owner(trip_id)) with check (public.is_trip_owner(trip_id));
create policy trip_places_public on public.trip_places for select to anon, authenticated
  using (public.is_trip_public(trip_id));

create policy rec_events_owner on public.recommendation_events for all to authenticated
  using (public.is_trip_owner(trip_id)) with check (public.is_trip_owner(trip_id));

-- api usage: read your own; writes only through consume_api_quota()
create policy api_usage_read_own on public.api_usage for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.api_usage from anon, authenticated;

-- ---------------------------------------------------------------------
-- 13. Shared link: read-only view of a trip by its token.
--     Works for 'link' and 'public' trips; never exposes the owner's id.
-- ---------------------------------------------------------------------
create or replace function public.get_shared_trip(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'trip', jsonb_build_object(
      'id', t.id, 'title', t.title, 'destination_name', t.destination_name,
      'start_date', t.start_date, 'end_date', t.end_date,
      'center_lat', t.center_lat, 'center_lng', t.center_lng),
    'days', coalesce((
      select jsonb_agg(jsonb_build_object(
        'day_index', d.day_index, 'date', d.date, 'title', d.title,
        'stops', coalesce((
          select jsonb_agg(jsonb_build_object(
            'position', tp.position, 'planned_time', tp.planned_time, 'note', tp.note,
            'label', sp.label, 'google_place_id', p.google_place_id,
            'lat', p.lat, 'lng', p.lng, 'category_id', sp.category_id)
            order by tp.position)
          from public.trip_places tp
          join public.saved_places sp on sp.id = tp.saved_place_id
          join public.places p on p.id = sp.place_id
          where tp.trip_day_id = d.id), '[]'::jsonb))
        order by d.day_index)
      from public.trip_days d where d.trip_id = t.id), '[]'::jsonb))
  from public.trips t
  where t.share_token = p_token and t.visibility in ('link', 'public');
$$;
revoke execute on function public.get_shared_trip(text) from public;
grant execute on function public.get_shared_trip(text) to anon, authenticated;

-- ===== supabase/migrations/20260925000001_auth.sql =====
-- =====================================================================
-- GoTrip · Phase 4 · Sign-in support
-- Onboarding state, onboarding answers, and self-service account deletion.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Onboarding state on the profile
-- ---------------------------------------------------------------------
alter table public.profiles add column onboarding_completed_at timestamptz;
grant update (onboarding_completed_at) on public.profiles to authenticated;

-- Only known travel styles are stored (the list matches src/lib/auth/rules.ts).
alter table public.user_preferences
  add constraint travel_styles_known check (
    travel_styles <@ array['food', 'attractions', 'shopping', 'nature', 'nightlife', 'culture', 'relax', 'family']::text[]
  );

-- ---------------------------------------------------------------------
-- 2. Finish onboarding in one step: save answers (if any) and mark done.
--    Runs as the user, so RLS still applies.
-- ---------------------------------------------------------------------
create or replace function public.complete_onboarding(
  p_travel_styles text[] default null,
  p_budget        public.budget_level default null,
  p_transport     public.transport_mode[] default null
) returns void language plpgsql security invoker set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  if p_travel_styles is not null or p_budget is not null or p_transport is not null then
    insert into public.user_preferences (user_id, travel_styles, budget_level, default_transport)
    values (uid, coalesce(p_travel_styles, '{}'), p_budget, coalesce(p_transport, '{walk,transit}'))
    on conflict (user_id) do update set
      travel_styles     = excluded.travel_styles,
      budget_level      = excluded.budget_level,
      default_transport = excluded.default_transport;
  end if;

  update public.profiles set onboarding_completed_at = now()
   where id = uid and onboarding_completed_at is null;
end $$;
revoke execute on function public.complete_onboarding(text[], public.budget_level, public.transport_mode[]) from public, anon;
grant execute on function public.complete_onboarding(text[], public.budget_level, public.transport_mode[]) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Delete my account: removes the sign-in and, by cascade,
--    the profile, preferences, trips and everything under them.
-- ---------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  delete from auth.users where id = uid;
end $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ===== supabase/migrations/20260926000001_trips.sql =====
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

-- ===== supabase/migrations/20260927000001_places.sql =====
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

-- ===== supabase/migrations/20260928000001_planning.sql =====
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

-- ===== supabase/migrations/20260929000001_sharing.sql =====
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

-- ===== supabase/migrations/20260930000001_marketplace.sql =====
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

-- ===== supabase/migrations/20261001000001_hardening.sql =====
-- =====================================================================
-- GoTrip · Hardening after the Supabase security advisor (2026-09-24)
-- =====================================================================

-- 1. Fixed search_path on the trigger helpers.
alter function public.set_updated_at() set search_path = public;
alter function public.trips_share_token() set search_path = public;
alter function public.sync_trip_days() set search_path = public;
alter function public.sync_saved_place_status() set search_path = public;

-- 2. Internal helpers are not part of the API.
--    handle_new_user runs only as the sign-up trigger; setting_numeric only inside other functions.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.setting_numeric(text) from public, anon, authenticated;
--    is_trip_owner is used only by policies for signed-in users.
revoke execute on function public.is_trip_owner(uuid) from public, anon;
grant execute on function public.is_trip_owner(uuid) to authenticated;

-- Kept on purpose (the advisor lists them as warnings):
--  * is_admin, is_trip_public: used inside row-level policies that anonymous visitors also hit.
--  * The app's RPC functions (publish_trip, clone_shared_trip, admin_* ...): each checks who is calling.
--  * routes_catalog and reviews_public views: public store pages; they expose only published routes,
--    counts and a reviewer's first name.

-- ===== supabase/seed.sql =====
-- Place categories. Colors match the design system (Phase 2).
-- Adding a category later = one more row here, no code change.
insert into public.categories (key, name_he, name_en, icon, color, sort_order) values
  ('must',       'מקום חובה',     'Must see',      'star',     '#9A6412', 1),
  ('attraction', 'אטרקציה',       'Attraction',    'landmark', '#0E6B6B', 2),
  ('restaurant', 'מסעדה',         'Restaurant',    'utensils', '#C2481F', 3),
  ('cafe',       'בית קפה',       'Cafe',          'coffee',   '#7A5230', 4),
  ('shopping',   'שופינג',        'Shopping',      'bag',      '#7B4BA6', 5),
  ('nightlife',  'חיי לילה',      'Nightlife',     'moon',     '#2F3E7A', 6),
  ('hotel',      'מלון',          'Hotel',         'bed',      '#17202B', 7),
  ('parking',    'חניה',          'Parking',       'parking',  '#4A5563', 8),
  ('park',       'פארק',          'Park',          'tree',     '#3F7F4A', 9),
  ('beach',      'חוף',           'Beach',         'wave',     '#1D6E99', 10),
  ('culture',    'הופעה / תרבות', 'Show / Culture', 'ticket',  '#A33A6B', 11),
  ('photo',      'מקום צילום',    'Photo spot',    'camera',   '#5E6B22', 12)
on conflict (key) do nothing;
