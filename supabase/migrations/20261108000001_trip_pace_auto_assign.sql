-- How full the days should be (null = from the trip's travel styles: "relax" -> relaxed),
-- and whether a newly saved place goes straight into the best day.
alter table public.trips add column if not exists pace text check (pace in ('relaxed', 'normal', 'full'));
alter table public.trips add column if not exists auto_assign boolean not null default true;
