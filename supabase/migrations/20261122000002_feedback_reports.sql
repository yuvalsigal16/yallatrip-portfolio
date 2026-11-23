-- "דיווח על בעיה או רעיון": a message from a signed-in user to the site's team, kept with the reports
-- (it shows on the admin page beside them). It is about the site, not about a route, review or creator,
-- so it has no target. Nothing existing changes: every report so far has a target, and still must.
alter table public.reports alter column target_id drop not null;
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('route', 'review', 'creator', 'feedback'));
alter table public.reports drop constraint if exists reports_target_present;
alter table public.reports add constraint reports_target_present
  check ((target_type = 'feedback') = (target_id is null));
