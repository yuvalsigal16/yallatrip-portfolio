-- Security and logic tests for the Phase 3 schema.
-- Run by scripts/test-db.sh. Every line prints PASS, or the run stops at the first FAIL.
\set ON_ERROR_STOP on
\set QUIET on
\set A '11111111-1111-1111-1111-111111111111'
\set B '22222222-2222-2222-2222-222222222222'

-- ---------- sign-ups ----------
insert into auth.users (id, email, raw_user_meta_data) values
  (:'A', 'a@example.com', '{"full_name":"נועה"}'),
  (:'B', 'b@example.com', '{}');
select tests.ok((select count(*) = 2 from public.profiles), 'sign-up creates a profile row');
select tests.ok((select display_name = 'נועה' from public.profiles where id = :'A'), 'profile takes the name from sign-up');

-- ---------- user A builds a trip ----------
select set_config('request.jwt.claim.sub', :'A', false);
set role authenticated;

insert into public.trips (id, owner_id, title, destination_name, start_date, end_date, travelers_count)
values ('aaaaaaaa-0000-0000-0000-000000000001', :'A', 'רומא', 'רומא, איטליה', '2026-10-10', '2026-10-15', 2);

select tests.ok((select count(*) = 6 from public.trip_days where trip_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
                'a 6-day trip gets 6 days automatically');
select tests.ok((select date = '2026-10-15' from public.trip_days
                  where trip_id = 'aaaaaaaa-0000-0000-0000-000000000001' and day_index = 6),
                'day 6 is dated 15 October');

-- places are written by the server (service role) since Phase 6
reset role;
insert into public.places (id, google_place_id, lat, lng, primary_type) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'ChIJqUCGZ09gLxMRLbCNMGOqyZo', 41.8986, 12.4769, 'tourist_attraction'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'ChIJrRMgU7ZhLxMRxAOFkC7I8Sg', 41.8902, 12.4922, 'tourist_attraction');
set role authenticated;

insert into public.saved_places (id, trip_id, place_id, category_id, label, is_must, personal_note)
values ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
        'bbbbbbbb-0000-0000-0000-000000000001', (select id from public.categories where key = 'attraction'),
        'הפנתיאון', true, 'להגיע לפני התורים'),
       ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001',
        'bbbbbbbb-0000-0000-0000-000000000002', (select id from public.categories where key = 'must'),
        'הקולוסיאום', true, null);

select tests.fails($$insert into public.saved_places (trip_id, place_id, label)
                    values ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'כפול')$$,
                   'the same place cannot be saved twice in one trip');

-- schedule the Pantheon on day 1
insert into public.trip_places (id, trip_id, trip_day_id, saved_place_id, position, planned_time)
select 'dddddddd-0000-0000-0000-000000000001', trip_id, id, 'cccccccc-0000-0000-0000-000000000001', 1, '09:45'
  from public.trip_days where trip_id = 'aaaaaaaa-0000-0000-0000-000000000001' and day_index = 1;
select tests.ok((select status = 'planned' from public.saved_places where id = 'cccccccc-0000-0000-0000-000000000001'),
                'scheduling a place marks it "planned"');

-- the same place can appear on another day too
insert into public.trip_places (trip_id, trip_day_id, saved_place_id, position)
select trip_id, id, 'cccccccc-0000-0000-0000-000000000001', 1
  from public.trip_days where trip_id = 'aaaaaaaa-0000-0000-0000-000000000001' and day_index = 3;
delete from public.trip_places where id = 'dddddddd-0000-0000-0000-000000000001';
select tests.ok((select status = 'planned' from public.saved_places where id = 'cccccccc-0000-0000-0000-000000000001'),
                'still "planned" while it sits on another day');
delete from public.trip_places where saved_place_id = 'cccccccc-0000-0000-0000-000000000001';
select tests.ok((select status = 'saved' from public.saved_places where id = 'cccccccc-0000-0000-0000-000000000001'),
                'removed from every day -> back to "saved"');

-- visited is never overwritten
update public.saved_places set status = 'visited' where id = 'cccccccc-0000-0000-0000-000000000001';
insert into public.trip_places (trip_id, trip_day_id, saved_place_id, position)
select trip_id, id, 'cccccccc-0000-0000-0000-000000000001', 2
  from public.trip_days where trip_id = 'aaaaaaaa-0000-0000-0000-000000000001' and day_index = 2;
select tests.ok((select status = 'visited' from public.saved_places where id = 'cccccccc-0000-0000-0000-000000000001'),
                '"visited" stays "visited" when scheduled');

-- Colosseum on day 5, then shorten the trip to 3 days
insert into public.trip_places (trip_id, trip_day_id, saved_place_id, position)
select trip_id, id, 'cccccccc-0000-0000-0000-000000000002', 1
  from public.trip_days where trip_id = 'aaaaaaaa-0000-0000-0000-000000000001' and day_index = 5;
update public.trips set end_date = '2026-10-12' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select tests.ok((select count(*) = 3 from public.trip_days where trip_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
                'shortening the dates removes the extra days');
select tests.ok((select status = 'saved' from public.saved_places where id = 'cccccccc-0000-0000-0000-000000000002'),
                'a stop on a removed day returns to "saved" (the place is kept)');

-- move the start date: days keep their order and get new dates
update public.trips set start_date = '2026-10-11', end_date = '2026-10-13' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select tests.ok((select date = '2026-10-11' from public.trip_days
                  where trip_id = 'aaaaaaaa-0000-0000-0000-000000000001' and day_index = 1),
                'moving the trip re-dates the days');

-- long trips
update public.trips set end_date = '2027-04-10' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select tests.ok((select count(*) = 182 from public.trip_days where trip_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
                'a half-year trip (182 days) works');
select tests.fails($$update public.trips set end_date = '2028-01-01' where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
                   'a trip longer than one year is refused');
select tests.fails($$insert into public.trips (owner_id, title, destination_name, start_date, end_date)
                    values ('11111111-1111-1111-1111-111111111111', 'x', 'x', '2026-10-10', '2026-10-01')$$,
                   'end date before start date is refused');

-- open dates: no days yet
insert into public.trips (id, owner_id, title, destination_name)
values ('aaaaaaaa-0000-0000-0000-000000000002', :'A', 'ניו יורק', 'ניו יורק');
select tests.ok((select count(*) = 0 from public.trip_days where trip_id = 'aaaaaaaa-0000-0000-0000-000000000002'),
                'a trip without dates starts with no days');

-- cross-trip mix-ups are impossible
insert into public.trip_days (id, trip_id, day_index) values ('eeeeeeee-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 1);
select tests.fails($$insert into public.trip_places (trip_id, trip_day_id, saved_place_id, position)
                    values ('aaaaaaaa-0000-0000-0000-000000000002', 'eeeeeeee-0000-0000-0000-000000000002',
                            'cccccccc-0000-0000-0000-000000000002', 1)$$,
                   'a place from trip 1 cannot be scheduled on a day of trip 2');
select tests.fails($$update public.trips set hotel_saved_place_id = 'cccccccc-0000-0000-0000-000000000002'
                    where id = 'aaaaaaaa-0000-0000-0000-000000000002'$$,
                   'the hotel must be a place saved in the same trip');
update public.trips set hotel_saved_place_id = 'cccccccc-0000-0000-0000-000000000002'
 where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select tests.ok(true, 'the hotel can be a place saved in the same trip');

-- users cannot promote themselves
select tests.fails($$update public.profiles set role = 'admin' where id = '11111111-1111-1111-1111-111111111111'$$,
                   'a user cannot change their own role');
update public.profiles set display_name = 'נועה ב.' where id = :'A';
select tests.ok((select display_name = 'נועה ב.' from public.profiles where id = :'A'), 'a user can edit their display name');
select tests.fails($$update public.places set lat = 0$$, 'users cannot edit the shared places table');

-- ---------- user B tries to reach A's data ----------
reset role;
select set_config('request.jwt.claim.sub', :'B', false);
set role authenticated;

select tests.ok((select count(*) = 0 from public.trips), 'B sees none of A''s trips');
select tests.ok((select count(*) = 0 from public.saved_places), 'B sees none of A''s saved places');
select tests.ok((select count(*) = 0 from public.trip_days), 'B sees none of A''s days');
select tests.ok((select count(*) = 1 from public.profiles), 'B sees only their own profile');
update public.trips set title = 'hacked';
select tests.fails($$insert into public.saved_places (trip_id, place_id, label)
                    values ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'x')$$,
                   'B cannot add places to A''s trip');
select tests.fails($$insert into public.trips (owner_id, title, destination_name)
                    values ('11111111-1111-1111-1111-111111111111', 'x', 'x')$$,
                   'B cannot create a trip in A''s name');
reset role;
select tests.ok((select title = 'רומא' from public.trips where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
                'B''s update of A''s trip changed nothing');

-- ---------- sharing ----------
select set_config('request.jwt.claim.sub', :'A', false);
set role authenticated;
update public.trips set visibility = 'link' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select tests.ok((select share_token ~ '^[0-9a-f]{64}$' from public.trips where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
                'a shareable trip gets a random 64-character token');
reset role;
select set_config('request.jwt.claim.sub', '', false);
select share_token as tok from public.trips where id = 'aaaaaaaa-0000-0000-0000-000000000001' \gset
set role anon;
select tests.ok((select (public.get_shared_trip(:'tok') -> 'trip' ->> 'title') = 'רומא'), 'the share link opens the trip without login');
select tests.ok((select public.get_shared_trip(:'tok')::text not like '%11111111-1111%'), 'the shared view does not reveal the owner');
select tests.ok((select public.get_shared_trip('0000') is null), 'a wrong token returns nothing');
select tests.ok((select count(*) = 0 from public.trips), 'a link-only trip is not listed publicly');
select tests.ok((select count(*) = 16 from public.categories), 'anyone can read the 16 categories');
select tests.ok((select count(*) = 0 from public.places), 'anonymous visitors see nothing in the places table');
reset role;

select set_config('request.jwt.claim.sub', :'A', false);
set role authenticated;
update public.trips set visibility = 'private' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
reset role;
set role anon;
select tests.ok((select public.get_shared_trip(:'tok') is null), 'making the trip private kills the old link');
reset role;

-- public trips are readable by everyone
select set_config('request.jwt.claim.sub', :'A', false);
set role authenticated;
update public.trips set visibility = 'public' where id = 'aaaaaaaa-0000-0000-0000-000000000002';
reset role;
select set_config('request.jwt.claim.sub', :'B', false);
set role authenticated;
select tests.ok((select count(*) = 1 from public.trips), 'B can read a public trip');
update public.trips set title = 'hacked';
reset role;
select tests.ok((select title = 'ניו יורק' from public.trips where id = 'aaaaaaaa-0000-0000-0000-000000000002'),
                'B still cannot edit a public trip');

-- ---------- API quota ----------
select set_config('request.jwt.claim.sub', :'B', false);
set role authenticated;
select tests.ok((select public.consume_api_quota('nearby', 3)), 'call 1 of 3 allowed');
select public.consume_api_quota('nearby', 3);
select tests.ok((select public.consume_api_quota('nearby', 3)), 'call 3 of 3 allowed');
select tests.ok((select not public.consume_api_quota('nearby', 3)), 'call 4 of 3 refused');
select tests.fails($$delete from public.api_usage$$, 'users cannot reset their own quota');
reset role;
set role anon;
select tests.fails($$select public.consume_api_quota('nearby', 3)$$, 'anonymous visitors cannot use the Google proxy');
reset role;

-- ---------- deleting an account removes its data ----------
delete from auth.users where id = :'A';
select tests.ok((select count(*) = 0 from public.trips where owner_id = :'A'), 'deleting an account deletes its trips');
select tests.ok((select count(*) = 0 from public.saved_places), 'and everything under them');
select tests.ok((select count(*) = 2 from public.places), 'the shared places cache is kept');

\warn 'ALL DATABASE TESTS PASSED'
