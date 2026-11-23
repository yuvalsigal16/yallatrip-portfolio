-- A long trip's skeleton: where, roughly how long, and how settled it is. No daily plan needed.
create table public.trip_segments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  position double precision not null default 0,
  name text not null check (char_length(name) between 1 and 120),
  amount smallint check (amount between 1 and 400),
  unit text not null default 'd' check (unit in ('d','w','m')),
  status text not null default 'maybe' check (status in ('maybe','planned','booked')),
  note text check (char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index trip_segments_trip_idx on public.trip_segments (trip_id, position);
alter table public.trip_segments enable row level security;
create policy trip_segments_all on public.trip_segments for all to authenticated
  using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));
revoke all on public.trip_segments from anon;
grant select, insert, update, delete on public.trip_segments to authenticated;
create trigger trip_segments_touch after insert or update or delete on public.trip_segments
  for each row execute function public.touch_trip();

-- The traveller keeps Shabbat: the day plan shows when it starts and ends.
alter table public.trips add column if not exists keeps_shabbat boolean not null default false;
