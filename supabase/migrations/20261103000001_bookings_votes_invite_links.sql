-- Bookings & documents, partner votes on saved places, and invite links for a trip.
-- Everything is readable and writable only by the people planning the trip (can_edit_trip).

-- ---------- bookings ----------
create table if not exists public.trip_bookings (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  kind text not null default 'other' check (kind in ('flight','hotel','car','train','ticket','restaurant','other')),
  title text not null check (char_length(title) between 1 and 120),
  confirmation text check (confirmation is null or char_length(confirmation) <= 80),
  starts_on date,
  start_time time,
  ends_on date,
  note text check (note is null or char_length(note) <= 1000),
  file_path text check (file_path is null or char_length(file_path) <= 200),
  file_name text check (file_name is null or char_length(file_name) <= 120),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists trip_bookings_trip_idx on public.trip_bookings (trip_id, starts_on);
alter table public.trip_bookings enable row level security;
create policy trip_bookings_all on public.trip_bookings for all to authenticated
  using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));
revoke all on public.trip_bookings from anon;
create trigger trip_bookings_touch after insert or update or delete on public.trip_bookings
  for each row execute function public.touch_trip();

-- private bucket for the attached files (PDF or picture, up to 10 MB), in the trip's own folder
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trip-docs', 'trip-docs', false, 10485760, array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy trip_docs_select on storage.objects for select to authenticated
  using (bucket_id = 'trip-docs' and public.owns_trip_folder(name));
create policy trip_docs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'trip-docs' and public.owns_trip_folder(name));
create policy trip_docs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'trip-docs' and public.owns_trip_folder(name));

-- ---------- votes on saved places ----------
create table if not exists public.trip_place_votes (
  trip_id uuid not null references public.trips(id) on delete cascade,
  saved_place_id uuid not null references public.saved_places(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (saved_place_id, user_id)
);
create index if not exists trip_place_votes_trip_idx on public.trip_place_votes (trip_id);
alter table public.trip_place_votes enable row level security;
create policy trip_place_votes_read on public.trip_place_votes for select to authenticated
  using (public.can_edit_trip(trip_id));
create policy trip_place_votes_write on public.trip_place_votes for insert to authenticated
  with check (public.can_edit_trip(trip_id) and user_id = auth.uid());
create policy trip_place_votes_update on public.trip_place_votes for update to authenticated
  using (user_id = auth.uid() and public.can_edit_trip(trip_id)) with check (user_id = auth.uid() and public.can_edit_trip(trip_id));
create policy trip_place_votes_delete on public.trip_place_votes for delete to authenticated
  using (user_id = auth.uid());
revoke all on public.trip_place_votes from anon;

-- ---------- invite links ----------
create table if not exists public.trip_invite_links (
  token text primary key default encode(extensions.gen_random_bytes(18), 'hex'),
  trip_id uuid not null references public.trips(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  expires_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now()
);
create index if not exists trip_invite_links_trip_idx on public.trip_invite_links (trip_id);
alter table public.trip_invite_links enable row level security;
-- no direct access: only through the functions below
revoke all on public.trip_invite_links from anon, authenticated;

/** The owner's invite link for a trip (a fresh one each time; older ones stop working). */
create or replace function public.create_trip_invite_link(p_trip uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_token text;
begin
  if not exists (select 1 from public.trips where id = p_trip and owner_id = auth.uid() and not is_snapshot) then
    raise exception 'only the trip owner can invite' using errcode = '42501';
  end if;
  update public.trip_invite_links set expires_at = now() where trip_id = p_trip and expires_at > now();
  insert into public.trip_invite_links (trip_id, created_by) values (p_trip, auth.uid()) returning token into v_token;
  return v_token;
end $$;

/** What a link leads to, for the page that asks "join this trip?". */
create or replace function public.peek_trip_invite_link(p_token text)
returns table (trip_id uuid, title text, owner_name text) language sql stable security definer set search_path = public as $$
  select t.id, t.title, p.display_name
  from public.trip_invite_links l join public.trips t on t.id = l.trip_id left join public.profiles p on p.id = t.owner_id
  where l.token = p_token and l.expires_at > now() and not t.is_snapshot and auth.uid() is not null;
$$;

/** Joins the signed-in user to the trip the link belongs to. Returns the trip id. */
create or replace function public.join_trip_by_link(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_trip uuid; v_owner uuid;
begin
  if auth.uid() is null then raise exception 'sign in first' using errcode = '42501'; end if;
  select l.trip_id, t.owner_id into v_trip, v_owner
  from public.trip_invite_links l join public.trips t on t.id = l.trip_id
  where l.token = p_token and l.expires_at > now() and not t.is_snapshot;
  if v_trip is null then raise exception 'link not valid' using errcode = 'P0002'; end if;
  if v_owner = auth.uid() then return v_trip; end if;
  if not exists (select 1 from public.trip_members where trip_id = v_trip and user_id = auth.uid())
     and (select count(*) from public.trip_members where trip_id = v_trip) >= 10 then
    raise exception 'too many members' using errcode = '22023';
  end if;
  insert into public.trip_members (trip_id, user_id, invited_by, status, responded_at)
  values (v_trip, auth.uid(), v_owner, 'accepted', now())
  on conflict (trip_id, user_id) do update set status = 'accepted', responded_at = now();
  -- A shared trip stays private between its people.
  update public.trips set visibility = 'private' where id = v_trip and visibility <> 'private';
  return v_trip;
end $$;

revoke all on function public.create_trip_invite_link(uuid) from public, anon;
revoke all on function public.peek_trip_invite_link(text) from public, anon;
revoke all on function public.join_trip_by_link(text) from public, anon;
grant execute on function public.create_trip_invite_link(uuid) to authenticated;
grant execute on function public.peek_trip_invite_link(text) to authenticated;
grant execute on function public.join_trip_by_link(text) to authenticated;
