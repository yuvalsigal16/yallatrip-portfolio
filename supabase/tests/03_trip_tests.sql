-- Phase 5 tests: creating, editing and deleting trips.
\set ON_ERROR_STOP on
\set QUIET on
\set E '55555555-5555-5555-5555-555555555555'
\set F '66666666-6666-6666-6666-666666666666'

insert into auth.users (id, email) values (:'E', 'e@example.com'), (:'F', 'f@example.com');

select set_config('request.jwt.claim.sub', :'E', false);
set role authenticated;

-- create, as the wizard does
insert into public.trips (id, owner_id, title, destination_name, destination_place_id, center_lat, center_lng,
                          start_date, end_date, travelers_count, transport_modes, travel_styles, budget_level)
values ('aaaaaaaa-0000-0000-0000-00000000000e', :'E', 'רומא', 'רומא, איטליה', 'ChIJu46S-ZZhLxMROG5lkwZ3D7k', 41.9028, 12.4964,
        '2026-10-10', '2026-10-15', 2, '{walk,transit}', '{food,attractions,shopping}', 'medium');
select tests.ok((select count(*) = 6 from public.trip_days where trip_id = 'aaaaaaaa-0000-0000-0000-00000000000e'),
                'the wizard''s trip gets its 6 days');
select tests.fails($$insert into public.trips (owner_id, title, destination_name, travel_styles)
                    values ('55555555-5555-5555-5555-555555555555', 'x', 'x', '{skydiving}')$$,
                   'unknown travel style on a trip is refused');
select tests.fails($$insert into public.trips (owner_id, title, destination_name, travelers_count)
                    values ('55555555-5555-5555-5555-555555555555', 'x', 'x', 0)$$,
                   'zero travelers is refused');

-- schedule a stop on day 5, then ask what shortening to 3 days would remove
reset role; -- places are written by the server
insert into public.places (id, google_place_id, lat, lng) values
  ('bbbbbbbb-0000-0000-0000-00000000000e', 'ChIJtest_phase5_colosseum', 41.8902, 12.4922);
set role authenticated;
insert into public.saved_places (id, trip_id, place_id, label)
values ('cccccccc-0000-0000-0000-00000000000e', 'aaaaaaaa-0000-0000-0000-00000000000e', 'bbbbbbbb-0000-0000-0000-00000000000e', 'הקולוסיאום');
insert into public.trip_places (trip_id, trip_day_id, saved_place_id, position)
select trip_id, id, 'cccccccc-0000-0000-0000-00000000000e', 1
  from public.trip_days where trip_id = 'aaaaaaaa-0000-0000-0000-00000000000e' and day_index = 5;
select tests.ok((select public.count_stops_after_day('aaaaaaaa-0000-0000-0000-00000000000e', 3) = 1),
                'shortening to 3 days would unschedule 1 stop');
select tests.ok((select public.count_stops_after_day('aaaaaaaa-0000-0000-0000-00000000000e', 5) = 0),
                'keeping 5 days unschedules nothing');

-- edit details
update public.trips set title = 'רומא עם אמא', travelers_count = 3 where id = 'aaaaaaaa-0000-0000-0000-00000000000e';
select tests.ok((select title = 'רומא עם אמא' and travelers_count = 3 from public.trips
                  where id = 'aaaaaaaa-0000-0000-0000-00000000000e'), 'the owner can edit the trip');

-- remove the dates: days stay (with their stops), just without dates
update public.trips set start_date = null, end_date = null where id = 'aaaaaaaa-0000-0000-0000-00000000000e';
select tests.ok((select count(*) = 6 from public.trip_days where trip_id = 'aaaaaaaa-0000-0000-0000-00000000000e'),
                'removing the dates keeps the days and their stops');
select tests.ok((select count(*) = 0 from public.trip_days
                  where trip_id = 'aaaaaaaa-0000-0000-0000-00000000000e' and date is not null),
                'and the days no longer show old dates');
update public.trips set start_date = '2027-03-01', end_date = '2027-03-06' where id = 'aaaaaaaa-0000-0000-0000-00000000000e';
select tests.ok((select date = '2027-03-05' from public.trip_days
                  where trip_id = 'aaaaaaaa-0000-0000-0000-00000000000e' and day_index = 5),
                'adding dates back re-dates the same days');
select tests.ok((select count(*) = 1 from public.trip_places where trip_id = 'aaaaaaaa-0000-0000-0000-00000000000e'),
                'the stop on day 5 survived the whole round trip');

-- another user
reset role;
select set_config('request.jwt.claim.sub', :'F', false);
set role authenticated;
select tests.ok((select public.count_stops_after_day('aaaaaaaa-0000-0000-0000-00000000000e', 0) = 0),
                'another user cannot count stops in E''s trip');
delete from public.trips where id = 'aaaaaaaa-0000-0000-0000-00000000000e';
reset role;
select tests.ok((select count(*) = 1 from public.trips where id = 'aaaaaaaa-0000-0000-0000-00000000000e'),
                'another user cannot delete E''s trip');

-- delete
select set_config('request.jwt.claim.sub', :'E', false);
set role authenticated;
delete from public.trips where id = 'aaaaaaaa-0000-0000-0000-00000000000e';
reset role;
select tests.ok((select count(*) = 0 from public.trips where id = 'aaaaaaaa-0000-0000-0000-00000000000e'),
                'the owner can delete the trip');
select tests.ok((select count(*) = 0 from public.trip_days where trip_id = 'aaaaaaaa-0000-0000-0000-00000000000e')
                and (select count(*) = 0 from public.saved_places where trip_id = 'aaaaaaaa-0000-0000-0000-00000000000e'),
                'deleting a trip removes its days and saved places');

\warn 'ALL TRIP TESTS PASSED'
