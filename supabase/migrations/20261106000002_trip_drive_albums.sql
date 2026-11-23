-- The traveller's own album folder in their personal Google Drive (photos go there, not to our storage).
-- We keep only the folder ids, so the next upload lands in the same folders. One per traveller per trip.
create table public.trip_drive_albums (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  folder_id text not null check (char_length(folder_id) between 5 and 200),
  folder_name text not null check (char_length(folder_name) between 1 and 120),
  day_folders jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);
alter table public.trip_drive_albums enable row level security;
create policy trip_drive_albums_own on public.trip_drive_albums for all to authenticated
  using (user_id = (select auth.uid()) and public.can_edit_trip(trip_id))
  with check (user_id = (select auth.uid()) and public.can_edit_trip(trip_id));
revoke all on public.trip_drive_albums from anon;
grant select, insert, update, delete on public.trip_drive_albums to authenticated;
