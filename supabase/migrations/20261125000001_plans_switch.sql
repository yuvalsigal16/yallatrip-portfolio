-- "מנויים פעילים": one switch on the admin page. Off (the default): the plan tools (what now, rainy day,
-- I'm here, the trip story) are open to everyone. On (only once card payments exist): only for travellers
-- with a plan. Nothing here charges anyone; card payments stay off.

-- Site-wide settings, one row per setting. Nobody reads or writes the table directly.
create table if not exists public.app_settings (
  key        text primary key check (key in ('subscriptions_active')),
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);
alter table public.app_settings enable row level security;
revoke all on table public.app_settings from public, anon, authenticated;
insert into public.app_settings (key, value) values ('subscriptions_active', 'false') on conflict (key) do nothing;

-- Is the switch on? Anyone may ask (the answer decides what the screens show).
create or replace function public.subscriptions_active()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select value = 'true'::jsonb from public.app_settings where key = 'subscriptions_active'), false);
$$;
revoke all on function public.subscriptions_active() from public;
grant execute on function public.subscriptions_active() to anon, authenticated;

-- Only the admin turns it on or off.
create or replace function public.admin_set_subscriptions_active(p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  insert into public.app_settings (key, value, updated_at, updated_by)
  values ('subscriptions_active', to_jsonb(coalesce(p_on, false)), now(), auth.uid())
  on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = auth.uid();
end $$;
revoke all on function public.admin_set_subscriptions_active(boolean) from public, anon;
grant execute on function public.admin_set_subscriptions_active(boolean) to authenticated;

-- Who has a plan: a trip pass (for one trip, until it ends) or a yearly plan. Empty for now: rows will be
-- added only by the server once card payments exist, never by users themselves. Each user sees only their own.
create table if not exists public.subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('trip', 'year')),
  trip_id    uuid references public.trips (id) on delete cascade,
  starts_on  date not null default current_date,
  ends_on    date not null,
  created_at timestamptz not null default now(),
  check ((kind = 'trip') = (trip_id is not null))
);
create index if not exists subscriptions_user_idx on public.subscriptions (user_id, ends_on);
alter table public.subscriptions enable row level security;
create policy subscriptions_own on public.subscriptions for select to authenticated using (user_id = auth.uid() or public.is_admin());
revoke insert, update, delete on public.subscriptions from anon, authenticated;

-- Does the signed-in traveller have a plan for this trip (or a yearly one)? Without a trip: any plan that is still on.
create or replace function public.has_plan(p_trip uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.subscriptions
     where user_id = auth.uid() and ends_on >= current_date and starts_on <= current_date
       and (kind = 'year' or p_trip is null or trip_id = p_trip)
  );
$$;
revoke all on function public.has_plan(uuid) from public, anon;
grant execute on function public.has_plan(uuid) to authenticated;
