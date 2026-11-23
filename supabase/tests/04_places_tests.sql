-- Phase 6 tests: who may write places, and the map view.
\set ON_ERROR_STOP on
\set QUIET on
\set G '77777777-7777-7777-7777-777777777777'
\set H '88888888-8888-8888-8888-888888888888'

insert into auth.users (id, email) values (:'G', 'g@example.com'), (:'H', 'h@example.com');

-- ---------- users cannot write the shared places table ----------
select set_config('request.jwt.claim.sub', :'G', false);
set role authenticated;
select tests.fails($$insert into public.places (google_place_id, lat, lng) values ('ChIJfake_place_id_000', 0, 0)$$,
                   'a user cannot insert a place with made-up coordinates');
select tests.fails($$select public.upsert_place('ChIJfake_place_id_000', 0, 0, null)$$,
                   'a user cannot call the server''s place function');
reset role;

-- ---------- the server can ----------
set role service_role;
select public.upsert_place('ChIJtrevi_fountain_0001', 41.9009, 12.4833, 'tourist_attraction') as pid \gset
select tests.ok(:'pid' is not null, 'the server saves a new place');
select tests.ok((select public.upsert_place('ChIJtrevi_fountain_0001', 1, 1, 'x') = :'pid'::uuid),
                'saving it again returns the same place');
select tests.ok((select lat = 41.9009 from public.places where id = :'pid'),
                'fresh coordinates are not overwritten');
update public.places set synced_at = now() - interval '31 days' where id = :'pid';
select public.upsert_place('ChIJtrevi_fountain_0001', 41.9010, 12.4834, 'tourist_attraction');
select tests.ok((select lat = 41.9010 and synced_at > now() - interval '1 minute' from public.places where id = :'pid'),
                'coordinates older than 30 days are refreshed');
reset role;

-- ---------- saving to a trip + the map view ----------
select set_config('request.jwt.claim.sub', :'G', false);
set role authenticated;
insert into public.trips (id, owner_id, title, destination_name, start_date, end_date)
values ('aaaaaaaa-0000-0000-0000-00000000000a', :'G', 'רומא', 'רומא', '2026-10-10', '2026-10-12');
insert into public.saved_places (id, trip_id, place_id, category_id, label, is_must)
values ('cccccccc-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-00000000000a', :'pid',
        (select id from public.categories where key = 'photo'), 'מזרקת טרווי', false);
select tests.ok((select category_key = 'photo' and lat = 41.9010 and google_place_id = 'ChIJtrevi_fountain_0001'
                   from public.saved_places_on_map where id = 'cccccccc-0000-0000-0000-00000000000a'),
                'the map view gives the pin its coordinates and category');

-- hotel
update public.trips set hotel_saved_place_id = 'cccccccc-0000-0000-0000-00000000000a'
 where id = 'aaaaaaaa-0000-0000-0000-00000000000a';
select tests.ok((select hotel_saved_place_id is not null from public.trips where id = 'aaaaaaaa-0000-0000-0000-00000000000a'),
                'a saved place can be set as the hotel');
delete from public.saved_places where id = 'cccccccc-0000-0000-0000-00000000000a';
select tests.ok((select hotel_saved_place_id is null from public.trips where id = 'aaaaaaaa-0000-0000-0000-00000000000a'),
                'removing the hotel place clears the trip''s hotel, not the trip');
insert into public.saved_places (id, trip_id, place_id, label)
values ('cccccccc-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-00000000000a', :'pid', 'טרווי');
reset role;

select set_config('request.jwt.claim.sub', :'H', false);
set role authenticated;
select tests.ok((select count(*) = 0 from public.saved_places_on_map), 'another user sees no pins of G''s trip');
reset role;

\warn 'ALL PLACES TESTS PASSED'
