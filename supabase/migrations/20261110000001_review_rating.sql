-- Stars (1-5) beside the recommendation; shown only to signed-in GoTrip travellers.
alter table public.saved_places
  add column if not exists rating smallint check (rating between 1 and 5);
-- place_reviews() now returns `rating` and also lists rating-only reviews (applied in the project).
