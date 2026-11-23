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
