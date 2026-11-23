-- Links on the creator's public page (Instagram, Facebook, TikTok, YouTube, website) that show they really are a creator.
alter table public.creators add column if not exists links jsonb not null default '{}'::jsonb;
alter table public.creators drop constraint if exists creators_links_object;
alter table public.creators add constraint creators_links_object check (jsonb_typeof(links) = 'object' and length(links::text) <= 2000);
grant update (links) on public.creators to authenticated;
