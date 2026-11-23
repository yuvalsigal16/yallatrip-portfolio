-- Place categories. Colors match the design system (Phase 2).
-- Adding a category later = one more row here, no code change.
insert into public.categories (key, name_he, name_en, icon, color, sort_order) values
  ('must',       'מקום חובה',     'Must see',      'star',     '#9A6412', 1),
  ('attraction', 'אטרקציה',       'Attraction',    'landmark', '#0E6B6B', 2),
  ('restaurant', 'מסעדה',         'Restaurant',    'utensils', '#C2481F', 3),
  ('cafe',       'בית קפה',       'Cafe',          'coffee',   '#7A5230', 4),
  ('shopping',   'שופינג',        'Shopping',      'bag',      '#7B4BA6', 5),
  ('nightlife',  'חיי לילה',      'Nightlife',     'moon',     '#2F3E7A', 6),
  ('hotel',      'מלון',          'Hotel',         'bed',      '#17202B', 7),
  ('parking',    'חניה',          'Parking',       'parking',  '#4A5563', 8),
  ('park',       'פארק',          'Park',          'tree',     '#3F7F4A', 9),
  ('beach',      'חוף',           'Beach',         'wave',     '#1D6E99', 10),
  ('culture',    'הופעה / תרבות', 'Show / Culture', 'ticket',  '#A33A6B', 11),
  ('photo',      'מקום צילום',    'Photo spot',    'camera',   '#5E6B22', 12),
  ('nature',     'טבע',           'Nature',        'mountain', '#2E6B3A', 13),
  ('airport',    'נמל תעופה',     'Airport',       'plane',    '#3B5B8C', 14),
  ('transport',  'תחבורה ציבורית', 'Public transport', 'bus',  '#B45309', 15),
  ('supermarket', 'סופר מרקט',    'Supermarket',   'cart',     '#087F5B', 16)
on conflict (key) do nothing;
