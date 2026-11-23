-- Each day can start from a chosen saved place (hotel, airport, a friend's flat...).
-- The day's route and travel times are then measured from there.
alter table public.trip_days
  add column start_saved_place_id uuid;

alter table public.trip_days
  add constraint trip_days_start_fk foreign key (start_saved_place_id, trip_id)
  references public.saved_places (id, trip_id) on delete set null (start_saved_place_id);

create index trip_days_start_idx on public.trip_days (start_saved_place_id) where start_saved_place_id is not null;
