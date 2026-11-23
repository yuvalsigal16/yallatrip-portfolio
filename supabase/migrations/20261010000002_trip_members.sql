-- Recovered from the live project (migration "trip_members", 2026-09-28), which was applied there but never saved here.
-- Shared trips: the owner invites a user by name; once they accept, both edit the same trip.
create table if not exists public.trip_members (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  invited_by uuid references public.profiles(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (trip_id, user_id)
);
create index if not exists trip_members_user_idx on public.trip_members(user_id);
alter table public.trip_members enable row level security;

-- Owner (not a store snapshot) or a member who accepted.
create or replace function public.can_edit_trip(p_trip_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.trips where id = p_trip_id and owner_id = auth.uid() and not is_snapshot)
      or exists (select 1 from public.trip_members m join public.trips t on t.id = m.trip_id
                  where m.trip_id = p_trip_id and m.user_id = auth.uid() and m.status = 'accepted' and not t.is_snapshot);
$$;
revoke execute on function public.can_edit_trip(uuid) from public, anon;
grant execute on function public.can_edit_trip(uuid) to authenticated;

create policy trip_members_read on public.trip_members for select
  using (user_id = auth.uid() or public.can_edit_trip(trip_id));

-- Members see and edit the trip itself (owner, visibility and link stay the owner's).
create policy trips_member_read on public.trips for select
  using (exists (select 1 from public.trip_members m where m.trip_id = id and m.user_id = auth.uid()));
create policy trips_member_update on public.trips for update
  using (public.can_edit_trip(id) and owner_id <> auth.uid())
  with check (public.can_edit_trip(id));

create or replace function public.trips_guard_member_update()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and auth.uid() <> old.owner_id then
    new.owner_id := old.owner_id;
    new.visibility := old.visibility;
    new.share_token := old.share_token;
    new.is_snapshot := old.is_snapshot;
  end if;
  return new;
end $$;
drop trigger if exists trips_guard_member_update on public.trips;
create trigger trips_guard_member_update before update on public.trips
  for each row execute function public.trips_guard_member_update();

-- Everything inside the trip: owner or accepted member.
drop policy if exists saved_places_owner on public.saved_places;
create policy saved_places_owner on public.saved_places for all using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));
drop policy if exists trip_days_owner on public.trip_days;
create policy trip_days_owner on public.trip_days for all using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));
drop policy if exists trip_places_owner on public.trip_places;
create policy trip_places_owner on public.trip_places for all using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));
drop policy if exists rec_events_owner on public.recommendation_events;
create policy rec_events_owner on public.recommendation_events for all using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));

create or replace function public.owns_trip_folder(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when (storage.foldername(p_name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.can_edit_trip(((storage.foldername(p_name))[1])::uuid)
    else false end;
$$;

-- Live sync: any change inside a trip touches trips.updated_at; the page listens to that one row.
create or replace function public.touch_trip()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.trips set updated_at = now()
   where id = coalesce(case when tg_op = 'DELETE' then old.trip_id else new.trip_id end, old.trip_id);
  return null;
end $$;
revoke execute on function public.touch_trip() from public, anon, authenticated;
drop trigger if exists saved_places_touch_trip on public.saved_places;
create trigger saved_places_touch_trip after insert or update or delete on public.saved_places for each row execute function public.touch_trip();
drop trigger if exists trip_places_touch_trip on public.trip_places;
create trigger trip_places_touch_trip after insert or update or delete on public.trip_places for each row execute function public.touch_trip();
drop trigger if exists trip_days_touch_trip on public.trip_days;
create trigger trip_days_touch_trip after update on public.trip_days for each row execute function public.touch_trip();

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trips') then
    alter publication supabase_realtime add table public.trips;
  end if;
end $$;

-- Find people by name to invite (onboarded users only; never yourself).
create or replace function public.search_users(p_q text)
returns table (id uuid, display_name text, avatar_url text)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.avatar_url from public.profiles p
   where auth.uid() is not null and p.id <> auth.uid() and p.onboarding_completed_at is not null
     and length(trim(coalesce(p_q, ''))) >= 2
     and p.display_name ilike '%' || replace(replace(trim(p_q), '%', ''), '_', '') || '%'
   order by p.display_name limit 8;
$$;

create or replace function public.invite_to_trip(p_trip_id uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.trips where id = p_trip_id and owner_id = auth.uid() and not is_snapshot) then
    raise exception 'only the trip owner can invite' using errcode = '42501';
  end if;
  if p_user = auth.uid() or not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'user not found' using errcode = 'P0002';
  end if;
  if (select count(*) from public.trip_members where trip_id = p_trip_id) >= 10 then
    raise exception 'too many members' using errcode = '22023';
  end if;
  insert into public.trip_members (trip_id, user_id, invited_by) values (p_trip_id, p_user, auth.uid())
  on conflict (trip_id, user_id) do nothing;
  -- A shared trip stays private between its people.
  update public.trips set visibility = 'private' where id = p_trip_id and visibility <> 'private';
end $$;

create or replace function public.respond_to_trip_invite(p_trip_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_accept then
    update public.trip_members set status = 'accepted', responded_at = now()
     where trip_id = p_trip_id and user_id = auth.uid() and status = 'pending';
    if not found then raise exception 'invite not found' using errcode = 'P0002'; end if;
  else
    delete from public.trip_members where trip_id = p_trip_id and user_id = auth.uid();
  end if;
end $$;

-- The owner removes someone (or cancels an invite); a member leaves with their own id.
create or replace function public.remove_trip_member(p_trip_id uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user <> auth.uid() and not exists (select 1 from public.trips where id = p_trip_id and owner_id = auth.uid()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  delete from public.trip_members where trip_id = p_trip_id and user_id = p_user;
end $$;

-- People on a trip (owner first), for its owner and members.
create or replace function public.trip_people(p_trip_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.can_edit_trip(p_trip_id) then '[]'::jsonb else (
    select coalesce(jsonb_agg(x order by x.is_owner desc, x.name), '[]'::jsonb) from (
      select t.owner_id as id, pr.display_name as name, pr.avatar_url as avatar, true as is_owner, 'accepted' as status
        from public.trips t join public.profiles pr on pr.id = t.owner_id where t.id = p_trip_id
      union all
      select m.user_id, pr.display_name, pr.avatar_url, false, m.status
        from public.trip_members m join public.profiles pr on pr.id = m.user_id where m.trip_id = p_trip_id
    ) x) end;
$$;

-- Invitations waiting for me.
create or replace function public.my_trip_invites()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'trip_id', t.id, 'title', t.title, 'destination', t.destination_name,
    'start_date', t.start_date, 'end_date', t.end_date,
    'from_name', pr.display_name, 'from_avatar', pr.avatar_url) order by m.created_at desc), '[]'::jsonb)
  from public.trip_members m join public.trips t on t.id = m.trip_id
  left join public.profiles pr on pr.id = coalesce(m.invited_by, t.owner_id)
  where m.user_id = auth.uid() and m.status = 'pending';
$$;

revoke execute on function public.search_users(text), public.invite_to_trip(uuid, uuid), public.respond_to_trip_invite(uuid, boolean),
  public.remove_trip_member(uuid, uuid), public.trip_people(uuid), public.my_trip_invites() from public, anon;
grant execute on function public.search_users(text), public.invite_to_trip(uuid, uuid), public.respond_to_trip_invite(uuid, boolean),
  public.remove_trip_member(uuid, uuid), public.trip_people(uuid), public.my_trip_invites() to authenticated;
revoke execute on function public.trips_guard_member_update() from public, anon, authenticated;

-- A shared trip never goes to the store or becomes public.
create or replace function public.trips_keep_shared_private()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.visibility <> 'private' and exists (select 1 from public.trip_members where trip_id = new.id) then
    new.visibility := 'private';
  end if;
  return new;
end $$;
revoke execute on function public.trips_keep_shared_private() from public, anon, authenticated;
drop trigger if exists trips_keep_shared_private on public.trips;
create trigger trips_keep_shared_private before update of visibility on public.trips
  for each row execute function public.trips_keep_shared_private();
