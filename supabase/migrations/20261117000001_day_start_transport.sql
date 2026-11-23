-- How the traveller gets from the day's starting point to its first stop (walk / car / transit), when they chose.
alter table public.trip_days add column if not exists start_transport public.transport_mode;
