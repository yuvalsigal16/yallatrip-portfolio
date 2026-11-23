-- Phase 11 tests: the shared view and copying a shared trip.
\set ON_ERROR_STOP on
\set QUIET on
\set K '13131313-1313-1313-1313-131313131313'
\set L '14141414-1414-1414-1414-141414141414'

insert into auth.users (id, email) values (:'K', 'k@example.com'), (:'L', 'l@example.com');
insert into public.places (id, google_place_id, lat, lng) values
  ('bbbbbbbb-0000-0000-0000-0000000000c1', 'ChIJshare_place_c1', 41.90, 12.47),
  ('bbbbbbbb-0000-0000-0000-0000000000c2', 'ChIJshare_place_c2', 41.89, 12.49);

select set_config('request.jwt.claim.sub', :'K', false);
set role authenticated;
insert into public.trips (id, owner_id, title, destination_name, start_date, end_date)
values ('aaaaaaaa-0000-0000-0000-0000000000c1', :'K', 'רומא של K', 'רומא', '2026-10-10', '2026-10-11');
insert into public.saved_places (id, trip_id, place_id, category_id, label, personal_note) values
  ('cccccccc-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-0000000000c1', 'bbbbbbbb-0000-0000-0000-0000000000c1',
   (select id from public.categories where key = 'hotel'), 'המלון', 'קוד הכניסה 4321'),
  ('cccccccc-0000-0000-0000-0000000000c2', 'aaaaaaaa-0000-0000-0000-0000000000c1', 'bbbbbbbb-0000-0000-0000-0000000000c2',
   (select id from public.categories where key = 'must'), 'קולוסיאום', 'סוד');
update public.trips set hotel_saved_place_id = 'cccccccc-0000-0000-0000-0000000000c1' where id = 'aaaaaaaa-0000-0000-0000-0000000000c1';
select id as kd2 from public.trip_days where trip_id = 'aaaaaaaa-0000-0000-0000-0000000000c1' and day_index = 2 \gset
select public.add_stop_to_day(:'kd2', 'cccccccc-0000-0000-0000-0000000000c2') as ks \gset
update public.trip_places set planned_time = '09:00', note = 'כרטיסים מראש' where id = :'ks';
update public.trip_days set title = 'רומא העתיקה' where id = :'kd2';

-- private: nothing to copy
select tests.ok((select share_token is null from public.trips where id = 'aaaaaaaa-0000-0000-0000-0000000000c1'), 'a private trip has no share link');
update public.trips set visibility = 'link' where id = 'aaaaaaaa-0000-0000-0000-0000000000c1';
select share_token as tok from public.trips where id = 'aaaaaaaa-0000-0000-0000-0000000000c1' \gset
reset role;

-- ---------- the shared view ----------
set role anon;
select public.get_shared_trip(:'tok') as shared \gset
select tests.ok((select (:'shared'::jsonb -> 'days' -> 1 -> 'stops' -> 0 ->> 'category_key') = 'must'), 'shared view: stops carry their category');
select tests.ok((select (:'shared'::jsonb -> 'days' -> 1 ->> 'title') = 'רומא העתיקה'), 'shared view: day names');
select tests.ok((select (:'shared'::jsonb -> 'hotel' ->> 'label') = 'המלון'), 'shared view: the hotel');
select tests.ok((select :'shared' not like '%4321%' and :'shared' not like '%סוד%'), 'shared view: private notes never appear');
select tests.fails($$select public.clone_shared_trip('$$ || :'tok' || $$')$$, 'a visitor must sign in to copy');
reset role;

-- ---------- copy ----------
select set_config('request.jwt.claim.sub', :'L', false);
set role authenticated;
select public.clone_shared_trip(:'tok') as copy_id \gset
select tests.ok((select owner_id = :'L' and title = 'רומא של K' and visibility = 'private' from public.trips where id = :'copy_id'),
                'the copy belongs to L, is private, and keeps its name');
select tests.ok((select count(*) = 2 from public.trip_days where trip_id = :'copy_id'), 'the copy has the same days');
select tests.ok((select title = 'רומא העתיקה' from public.trip_days where trip_id = :'copy_id' and day_index = 2), 'day names are copied');
select tests.ok((select count(*) = 2 from public.saved_places where trip_id = :'copy_id'), 'saved places are copied');
select tests.ok((select bool_and(personal_note is null) from public.saved_places where trip_id = :'copy_id'), 'private notes are NOT copied');
select tests.ok((select tp.planned_time = '09:00' and tp.note = 'כרטיסים מראש' and d.day_index = 2
                   from public.trip_places tp join public.trip_days d on d.id = tp.trip_day_id where tp.trip_id = :'copy_id'),
                'stops keep their day, time and note');
select tests.ok((select sp.label = 'המלון' from public.trips t join public.saved_places sp on sp.id = t.hotel_saved_place_id where t.id = :'copy_id'),
                'the hotel points to the copy''s own place');
select tests.ok((select status = 'planned' from public.saved_places where trip_id = :'copy_id' and label = 'קולוסיאום'), 'statuses are rebuilt');
update public.trip_places set note = 'שלי' where trip_id = :'copy_id';
reset role;
select tests.ok((select note = 'כרטיסים מראש' from public.trip_places where id = :'ks'), 'editing the copy does not touch the original');
select set_config('request.jwt.claim.sub', :'L', false);
set role authenticated;
select tests.fails($$select public.copy_trip_internal('aaaaaaaa-0000-0000-0000-0000000000c1', '14141414-1414-1414-1414-141414141414', 'x')$$,
                   'users cannot call the internal copy function directly (it could copy private trips)');
select tests.fails($$select public.clone_shared_trip('not-a-real-token')$$, 'a wrong link copies nothing');
reset role;

\warn 'ALL SHARING TESTS PASSED'
