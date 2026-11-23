-- A trip can pass through several countries and cities: an ordered list of
-- { name, start, end } kept on the trip itself (display only for now).
alter table public.trips
  add column if not exists destinations jsonb not null default '[]'::jsonb;
alter table public.trips
  add constraint trips_destinations_shape
  check (jsonb_typeof(destinations) = 'array' and jsonb_array_length(destinations) <= 40);
