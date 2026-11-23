-- Places that "fill my days" put in by itself: swapping one for another removes it again.
alter table public.saved_places add column if not exists auto_added boolean not null default false;
