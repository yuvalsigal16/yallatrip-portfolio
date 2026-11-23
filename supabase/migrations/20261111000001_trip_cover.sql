-- A trip's cover photo, uploaded by its owner (instead of asking Google for a destination photo).
-- The file lives in the public trip-photos bucket under <trip id>/cover/.
alter table public.trips add column if not exists cover_url text;
