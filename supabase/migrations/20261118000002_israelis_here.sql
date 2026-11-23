-- "ישראלים כאן": travellers who chose to be seen by other Israelis in the same country on overlapping dates.
-- Opt-in only; a list of others is shown only to someone who also chose to be seen (no contact without consent).
create table if not exists public.israelis_here (
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  country text not null check (country ~ '^[A-Z]{2}$'),
  starts_on date not null,
  ends_on date not null check (ends_on >= starts_on),
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now(),
  primary key (user_id, trip_id, country)
);
alter table public.israelis_here enable row level security;
create policy israelis_here_own_select on public.israelis_here for select using (user_id = auth.uid());
create policy israelis_here_own_insert on public.israelis_here for insert with check (user_id = auth.uid() and public.can_edit_trip(trip_id));
create policy israelis_here_own_update on public.israelis_here for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy israelis_here_own_delete on public.israelis_here for delete using (user_id = auth.uid());
create index if not exists israelis_here_country on public.israelis_here (country, starts_on, ends_on);

-- How many others will be in the country on these dates, and (only for someone who joined) who they are.
create or replace function public.israelis_here(p_country text, p_from date, p_to date)
returns jsonb language sql stable security definer set search_path = public as $$
  with mine as (
    select exists (select 1 from public.israelis_here h where h.user_id = auth.uid() and h.country = p_country
                    and h.starts_on <= p_to and h.ends_on >= p_from) as joined
  ), others as (
    select h.user_id, min(h.starts_on) as starts_on, max(h.ends_on) as ends_on, max(h.note) as note
      from public.israelis_here h
     where auth.uid() is not null and h.country = p_country and h.user_id <> auth.uid()
       and h.starts_on <= p_to and h.ends_on >= p_from
     group by h.user_id
  )
  select jsonb_build_object(
    'joined', (select joined from mine),
    'count', (select count(*) from others),
    'list', case when (select joined from mine) then coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', coalesce(nullif(split_part(trim(p.display_name), ' ', 1), ''), 'מטייל/ת'),
        'from', o.starts_on, 'to', o.ends_on, 'note', o.note) order by o.starts_on)
        from others o left join public.profiles p on p.id = o.user_id), '[]'::jsonb)
      else '[]'::jsonb end);
$$;
revoke all on function public.israelis_here(text, date, date) from public, anon;
grant execute on function public.israelis_here(text, date, date) to authenticated;
