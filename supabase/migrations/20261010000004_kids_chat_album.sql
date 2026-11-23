-- Recovered from the live project (migration "kids_chat_album", 2026-09-28), which was applied there but never saved here.
-- Trip with children: recommendations lean to kid-friendly places.
alter table public.trips add column if not exists with_kids boolean not null default false;

-- Chat inside a shared trip (only the people on the trip read and write).
create table if not exists public.trip_messages (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists trip_messages_trip_idx on public.trip_messages(trip_id, created_at);
alter table public.trip_messages enable row level security;
create policy trip_messages_read on public.trip_messages for select using (public.can_edit_trip(trip_id));
create policy trip_messages_write on public.trip_messages for insert with check (user_id = auth.uid() and public.can_edit_trip(trip_id));
create policy trip_messages_delete_own on public.trip_messages for delete using (user_id = auth.uid());

-- Photos taken on the trip, kept by destination and date for an album.
create table if not exists public.trip_album (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  url text not null check (url like 'https://%'),
  taken_at timestamptz not null default now(),
  lat double precision,
  lng double precision,
  place_label text,
  created_at timestamptz not null default now()
);
create index if not exists trip_album_trip_idx on public.trip_album(trip_id, taken_at);
alter table public.trip_album enable row level security;
create policy trip_album_read on public.trip_album for select using (public.can_edit_trip(trip_id));
create policy trip_album_write on public.trip_album for insert with check (user_id = auth.uid() and public.can_edit_trip(trip_id));
create policy trip_album_delete_own on public.trip_album for delete using (user_id = auth.uid() or public.is_trip_owner(trip_id));

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trip_messages') then
    alter publication supabase_realtime add table public.trip_messages;
  end if;
end $$;
