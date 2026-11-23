-- Public transport category (train, bus, metro stops found via "near here").
insert into public.categories (key, name_he, name_en, icon, color, sort_order) values
  ('transport', 'תחבורה ציבורית', 'Public transport', 'bus', '#B45309', 15)
on conflict (key) do nothing;
