-- Two more place categories (owner request): nature and airport.
insert into public.categories (key, name_he, name_en, icon, color, sort_order) values
  ('nature',  'טבע',       'Nature',  'mountain', '#2E6B3A', 13),
  ('airport', 'נמל תעופה', 'Airport', 'plane',    '#3B5B8C', 14)
on conflict (key) do nothing;
