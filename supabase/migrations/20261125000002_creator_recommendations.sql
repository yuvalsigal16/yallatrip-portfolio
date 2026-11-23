-- Approved content creators recommend single places (a restaurant, a hotel, an attraction), free for everyone
-- to see: on the place's card and first in "✨ מה יש בסביבה". The place comes from the site's existing search;
-- its name and position are kept here, so showing a recommendation never calls Google.
create table if not exists public.place_recommendations (
  id              uuid primary key default gen_random_uuid(),
  creator_id      uuid not null references public.creators (user_id) on delete cascade,
  google_place_id text not null check (char_length(google_place_id) between 10 and 300),
  name            text not null check (char_length(name) between 1 and 200),
  lat             double precision not null check (lat between -90 and 90),
  lng             double precision not null check (lng between -180 and 180),
  category        text not null check (category in ('food', 'sleep', 'see', 'other')),
  body            text not null check (char_length(body) between 5 and 500),
  hidden          boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (creator_id, google_place_id)
);
create index if not exists place_recommendations_place_idx on public.place_recommendations (google_place_id) where not hidden;
create index if not exists place_recommendations_where_idx on public.place_recommendations (lat, lng) where not hidden;
create trigger place_recommendations_updated_at before update on public.place_recommendations
  for each row execute function public.set_updated_at();

-- An approved creator (or the admin) with a creator page.
create or replace function public.is_creator()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('creator', 'admin'));
$$;
revoke all on function public.is_creator() from public;
grant execute on function public.is_creator() to anon, authenticated;

-- Only the admin hides or shows a recommendation: anyone else's change keeps it as it was.
create or replace function public.place_recommendations_keep_hidden()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then new.hidden := old.hidden; end if;
  return new;
end $$;
create trigger place_recommendations_keep_hidden before update on public.place_recommendations
  for each row execute function public.place_recommendations_keep_hidden();

alter table public.place_recommendations enable row level security;
-- Everyone (signed in or not) sees the ones that aren't hidden; creators also see their own, the admin sees all.
create policy recs_read on public.place_recommendations for select to anon, authenticated
  using (not hidden or creator_id = auth.uid() or public.is_admin());
create policy recs_insert_own on public.place_recommendations for insert to authenticated
  with check (creator_id = auth.uid() and not hidden and public.is_creator());
create policy recs_update_own on public.place_recommendations for update to authenticated
  using (creator_id = auth.uid() or public.is_admin()) with check (creator_id = auth.uid() or public.is_admin());
create policy recs_delete_own on public.place_recommendations for delete to authenticated
  using (creator_id = auth.uid());
revoke all on public.place_recommendations from anon;
grant select on public.place_recommendations to anon;

-- "דיווח" on a recommendation goes to the existing reports on the admin page.
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('route', 'review', 'creator', 'feedback', 'recommendation'));
