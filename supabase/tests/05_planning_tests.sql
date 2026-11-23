-- Phases 7–9 tests: visited, adding stops, reordering and moving between days.
\set ON_ERROR_STOP on
\set QUIET on
\set I '99999999-9999-9999-9999-999999999999'
\set J '12121212-1212-1212-1212-121212121212'

insert into auth.users (id, email) values (:'I', 'i@example.com'), (:'J', 'j@example.com');
insert into public.places (id, google_place_id, lat, lng) values
  ('bbbbbbbb-0000-0000-0000-0000000000a1', 'ChIJplan_place_a1', 41.90, 12.47),
  ('bbbbbbbb-0000-0000-0000-0000000000a2', 'ChIJplan_place_a2', 41.89, 12.49),
  ('bbbbbbbb-0000-0000-0000-0000000000a3', 'ChIJplan_place_a3', 41.91, 12.48);

select set_config('request.jwt.claim.sub', :'I', false);
set role authenticated;
insert into public.trips (id, owner_id, title, destination_name, start_date, end_date)
values ('aaaaaaaa-0000-0000-0000-0000000000a1', :'I', 'רומא', 'רומא', '2026-10-10', '2026-10-12'),
       ('aaaaaaaa-0000-0000-0000-0000000000a2', :'I', 'אחר', 'אחר', '2026-11-01', '2026-11-01');
insert into public.saved_places (id, trip_id, place_id, label) values
  ('cccccccc-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'bbbbbbbb-0000-0000-0000-0000000000a1', 'A'),
  ('cccccccc-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'bbbbbbbb-0000-0000-0000-0000000000a2', 'B'),
  ('cccccccc-0000-0000-0000-0000000000a3', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'bbbbbbbb-0000-0000-0000-0000000000a3', 'C'),
  ('cccccccc-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-0000000000a2', 'bbbbbbbb-0000-0000-0000-0000000000a1', 'X');

select id as d1 from public.trip_days where trip_id = 'aaaaaaaa-0000-0000-0000-0000000000a1' and day_index = 1 \gset
select id as d2 from public.trip_days where trip_id = 'aaaaaaaa-0000-0000-0000-0000000000a1' and day_index = 2 \gset
select id as other_day from public.trip_days where trip_id = 'aaaaaaaa-0000-0000-0000-0000000000a2' \gset

-- ---------- visited ----------
select tests.ok((select public.set_place_visited('cccccccc-0000-0000-0000-0000000000a3', true) = 'visited'), 'mark as visited');
select tests.ok((select public.set_place_visited('cccccccc-0000-0000-0000-0000000000a3', false) = 'saved'), 'unmark: not on a day -> saved');

-- ---------- add stops ----------
select public.add_stop_to_day(:'d1', 'cccccccc-0000-0000-0000-0000000000a1') as s1 \gset
select public.add_stop_to_day(:'d1', 'cccccccc-0000-0000-0000-0000000000a2') as s2 \gset
select public.add_stop_to_day(:'d1', 'cccccccc-0000-0000-0000-0000000000a3') as s3 \gset
select tests.ok((select array_agg(saved_place_id order by position) = array[
                   'cccccccc-0000-0000-0000-0000000000a1','cccccccc-0000-0000-0000-0000000000a2','cccccccc-0000-0000-0000-0000000000a3']::uuid[]
                 from public.trip_places where trip_day_id = :'d1'), 'stops are added at the end, in order');
select tests.ok((select public.set_place_visited('cccccccc-0000-0000-0000-0000000000a1', false) = 'planned'),
                'unmark visited while on a day -> planned');
select tests.fails($$select public.add_stop_to_day('$$ || :'other_day' || $$', 'cccccccc-0000-0000-0000-0000000000a1')$$,
                   'a place cannot be added to a day of another trip');

-- ---------- reorder ----------
select public.set_day_order(:'d1', array[:'s3', :'s1', :'s2']::uuid[]);
select tests.ok((select array_agg(id order by position) = array[:'s3', :'s1', :'s2']::uuid[]
                 from public.trip_places where trip_day_id = :'d1'), 'reorder a day');
select tests.fails($$select public.set_day_order('$$ || :'d1' || $$', array['$$ || :'s3' || $$', '$$ || :'s1' || $$']::uuid[])$$,
                   'a reorder that forgets a stop is refused');
select tests.fails($$select public.set_day_order('$$ || :'d1' || $$', array['$$ || :'s3' || $$','$$ || :'s3' || $$','$$ || :'s1' || $$','$$ || :'s2' || $$']::uuid[])$$,
                   'duplicate stops are refused');

-- ---------- move between days ----------
select public.set_day_order(:'d2', array[:'s1']::uuid[]);
select tests.ok((select trip_day_id = :'d2' from public.trip_places where id = :'s1'), 'move a stop to another day');
select tests.ok((select count(*) = 2 from public.trip_places where trip_day_id = :'d1'), 'the old day keeps the rest');
select public.add_stop_to_day(:'other_day', 'cccccccc-0000-0000-0000-0000000000b1') as foreign_stop \gset
select tests.fails($$select public.set_day_order('$$ || :'d2' || $$', array['$$ || :'s1' || $$', '$$ || :'foreign_stop' || $$']::uuid[])$$,
                   'a stop from another trip cannot be moved in');

-- ---------- times and notes ----------
update public.trip_places set planned_time = '09:30', duration_min = 90, note = 'להגיע מוקדם' where id = :'s3';
select tests.ok((select planned_time = '09:30' and duration_min = 90 from public.trip_places where id = :'s3'), 'set time, duration and note');
update public.trip_days set start_time = '08:30', title = 'מרכז העיר' where id = :'d1';
select tests.ok((select title = 'מרכז העיר' from public.trip_days where id = :'d1'), 'name a day');
reset role;

-- ---------- another user ----------
select set_config('request.jwt.claim.sub', :'J', false);
set role authenticated;
select tests.fails($$select public.set_day_order('$$ || :'d1' || $$', '{}'::uuid[])$$, 'another user cannot reorder I''s day');
select tests.fails($$select public.add_stop_to_day('$$ || :'d1' || $$', 'cccccccc-0000-0000-0000-0000000000a1')$$,
                   'another user cannot add stops to I''s day');
select tests.fails($$select public.set_place_visited('cccccccc-0000-0000-0000-0000000000a1', true)$$,
                   'another user cannot mark I''s places');
reset role;

\warn 'ALL PLANNING TESTS PASSED'
