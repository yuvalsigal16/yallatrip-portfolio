-- Supermarket category (owner's request): groceries, convenience stores.
insert into public.categories (key, name_he, name_en, icon, color, sort_order) values
  ('supermarket', 'סופר מרקט', 'Supermarket', 'cart', '#087F5B', 16)
on conflict (key) do nothing;
