-- Phases 12–15 tests: creators, publishing, buying, reviews, payouts, reports, admin.
\set ON_ERROR_STOP on
\set QUIET on
\set M '15151515-1515-1515-1515-151515151515'
\set N '16161616-1616-1616-1616-161616161616'
\set O '17171717-1717-1717-1717-171717171717'
\set P '18181818-1818-1818-1818-181818181818'

insert into auth.users (id, email, raw_user_meta_data) values
  (:'M', 'creator@example.com', '{"full_name":"נועה ברק"}'), (:'N', 'buyer@example.com', '{"full_name":"דנה כהן"}'),
  (:'O', 'admin@example.com', '{}'), (:'P', 'other@example.com', '{}');
update public.profiles set role = 'admin' where id = :'O';
insert into public.places (id, google_place_id, lat, lng) values
  ('bbbbbbbb-0000-0000-0000-0000000000d1', 'ChIJmarket_place_d1', 41.90, 12.47),
  ('bbbbbbbb-0000-0000-0000-0000000000d2', 'ChIJmarket_place_d2', 41.89, 12.49),
  ('bbbbbbbb-0000-0000-0000-0000000000d3', 'ChIJmarket_place_d3', 41.91, 12.48);

-- ---------- becoming a creator, building a trip ----------
select set_config('request.jwt.claim.sub', :'M', false);
set role authenticated;
select tests.fails($$select public.publish_trip('00000000-0000-0000-0000-000000000000', 'x', 'y', 0)$$, 'regular users cannot publish');
select tests.fails($$select public.become_creator('noa-rome', 'x', null)$$, 'a creator page needs the admin''s approval first');
select public.request_influencer('https://example.com/noa');
reset role;
select set_config('request.jwt.claim.sub', :'O', false);
set role authenticated;
select public.admin_decide_influencer(:'M', true);
reset role;
select set_config('request.jwt.claim.sub', :'M', false);
set role authenticated;
select tests.ok((select role = 'creator' from public.profiles where id = :'M'), 'the admin''s approval makes them a creator');
select public.become_creator('noa-rome', 'נועה מטיילת', 'אוהב את רומא');
select tests.fails($$select public.become_creator('Bad Slug!', 'x', null)$$, 'creator links are checked');

insert into public.trips (id, owner_id, title, destination_name, start_date, end_date)
values ('aaaaaaaa-0000-0000-0000-0000000000d1', :'M', 'רומא ב-2 ימים', 'רומא', '2026-10-10', '2026-10-11');
insert into public.saved_places (id, trip_id, place_id, label, personal_note) values
  ('cccccccc-0000-0000-0000-0000000000d1', 'aaaaaaaa-0000-0000-0000-0000000000d1', 'bbbbbbbb-0000-0000-0000-0000000000d1', 'פנתיאון', 'פרטי'),
  ('cccccccc-0000-0000-0000-0000000000d2', 'aaaaaaaa-0000-0000-0000-0000000000d1', 'bbbbbbbb-0000-0000-0000-0000000000d2', 'קולוסיאום', null),
  ('cccccccc-0000-0000-0000-0000000000d3', 'aaaaaaaa-0000-0000-0000-0000000000d1', 'bbbbbbbb-0000-0000-0000-0000000000d3', 'נבונה', null);
select id as md1 from public.trip_days where trip_id = 'aaaaaaaa-0000-0000-0000-0000000000d1' and day_index = 1 \gset
select id as md2 from public.trip_days where trip_id = 'aaaaaaaa-0000-0000-0000-0000000000d1' and day_index = 2 \gset
select public.add_stop_to_day(:'md1', 'cccccccc-0000-0000-0000-0000000000d1');
select public.add_stop_to_day(:'md1', 'cccccccc-0000-0000-0000-0000000000d3');
select tests.fails($$select public.publish_trip('aaaaaaaa-0000-0000-0000-0000000000d1', 'רומא ב-2 ימים', 'מסלול מלא לשני ימים ברומא', 4900)$$,
                   'a route needs at least 3 stops');
select public.add_stop_to_day(:'md2', 'cccccccc-0000-0000-0000-0000000000d2');
select tests.fails($$select public.publish_trip('aaaaaaaa-0000-0000-0000-0000000000d1', 'רומא', 'מסלול מלא לשני ימים ברומא', 100)$$,
                   'a price below the minimum is refused');

select public.publish_trip('aaaaaaaa-0000-0000-0000-0000000000d1', 'רומא ב-2 ימים', 'מסלול מלא לשני ימים ברומא, עם כל הטיפים', 4900) as route \gset
select tests.ok((select status = 'published' and places_count = 3 and days_count = 2 from public.published_trips where id = :'route'),
                'an approved creator''s route goes straight to the store');
select tests.ok((select count(*) = 1 from public.trips), 'the frozen snapshot does not show in the creator''s trips');

-- editing the source trip does not change what is sold
update public.saved_places set label = 'שונה' where id = 'cccccccc-0000-0000-0000-0000000000d1';
reset role;
select tests.ok((select count(*) = 1 from public.saved_places sp join public.published_trips r on r.snapshot_trip_id = sp.trip_id
                  where r.id = :'route' and sp.label = 'פנתיאון'), 'the snapshot keeps the original content');
select tests.ok((select bool_and(personal_note is null) from public.saved_places sp join public.published_trips r on r.snapshot_trip_id = sp.trip_id
                  where r.id = :'route'), 'private notes never enter a published route');

-- ---------- the store ----------
select set_config('request.jwt.claim.sub', :'N', false);
set role authenticated;
select tests.fails($$select public.admin_set_route_status('$$ || :'route' || $$', 'published')$$, 'only admins change a route''s status');
reset role;
select set_config('request.jwt.claim.sub', :'O', false);
set role authenticated;
select public.admin_set_route_status(:'route', 'published');
reset role;
set role anon;
select tests.ok((select count(*) = 1 and min(creator_name) = 'נועה מטיילת' from public.routes_catalog), 'the route is in the store');
select tests.ok((select jsonb_array_length(public.route_preview(:'route') -> 'days' -> 0 -> 'stops') = 2
                   and (public.route_preview(:'route') -> 'days' -> 1 -> 'stops') = 'null'::jsonb), 'preview: day 1 in full, other days as counts');
reset role;

-- ---------- buying ----------
select set_config('request.jwt.claim.sub', :'N', false);
set role authenticated;
select tests.fails($$select public.acquire_free_route('$$ || :'route' || $$')$$, 'a paid route cannot be taken for free');
select tests.fails($$select public.record_paid_purchase('16161616-1616-1616-1616-161616161616', '$$ || :'route' || $$', 4900, 'stripe', 'cs_fake')$$,
                   'a user cannot record their own payment');
select tests.fails($$select public.submit_review('$$ || :'route' || $$', 5, 'מעולה')$$, 'no review before getting the route');
reset role;

set role service_role;
select tests.fails($$select public.record_paid_purchase('16161616-1616-1616-1616-161616161616', '$$ || :'route' || $$', 1000, 'stripe', 'cs_low')$$,
                   'paying less than the price is refused');
select public.record_paid_purchase(:'N', :'route', 4900, 'stripe', 'cs_test_1') as copy1 \gset
select public.record_paid_purchase(:'N', :'route', 4900, 'stripe', 'cs_test_1') as copy2 \gset
select tests.ok(:'copy1' = :'copy2', 'the same payment notification twice gives one purchase');
select tests.ok((select count(*) = 1 and min(commission_agorot) = 980 and min(creator_amount_agorot) = 3920 from public.purchases where buyer_id = :'N'),
                '20% commission from the settings: 9.80 ₪ platform, 39.20 ₪ creator');
reset role;

select set_config('request.jwt.claim.sub', :'N', false);
set role authenticated;
select tests.ok((select count(*) = 3 from public.trip_places where trip_id = :'copy1'), 'the buyer gets a full copy with all stops');
select tests.ok((select owner_id = :'N' and not is_snapshot from public.trips where id = :'copy1'), 'the copy is the buyer''s own trip');
select public.submit_review(:'route', 4, 'טוב מאוד');
select public.submit_review(:'route', 5, 'מעולה! חסך לי שעות');
select tests.ok((select count(*) = 1 and min(rating) = 5 from public.reviews where author_id = :'N'), 'one review per purchase; editing replaces it');
select tests.fails($$select public.submit_review('$$ || :'route' || $$', 9, 'x')$$, 'ratings are 1–5');
select tests.ok((select count(*) = 0 from public.creator_balances), 'a buyer cannot see the creator''s earnings');
reset role;

select set_config('request.jwt.claim.sub', :'M', false);
set role authenticated;
select tests.fails($$select public.submit_review('$$ || :'route' || $$', 5, 'אני הכי טוב')$$, 'creators cannot review their own route');
select tests.ok((select earned_agorot = 3920 and sales_count = 1 from public.creator_balances), 'the creator sees their earnings');
select tests.ok((select count(*) = 1 from public.purchases), 'the creator sees the sale');
reset role;

set role anon;
select tests.ok((select rating_avg = 5 and rating_count = 1 and acquisitions = 1 from public.routes_catalog where id = :'route'),
                'the store shows rating and popularity');
select tests.ok((select author_first_name = 'דנה' from public.reviews_public where published_trip_id = :'route'),
                'reviews show only the first name');
reset role;

-- ---------- free route ----------
select set_config('request.jwt.claim.sub', :'M', false);
set role authenticated;
select public.publish_trip('aaaaaaaa-0000-0000-0000-0000000000d1', 'רומא חינם', 'גרסה חינמית של המסלול לשני ימים', 0) as free_route \gset
reset role;
select set_config('request.jwt.claim.sub', :'O', false);
set role authenticated;
select public.admin_set_route_status(:'free_route', 'published');
reset role;
select set_config('request.jwt.claim.sub', :'P', false);
set role authenticated;
select public.acquire_free_route(:'free_route') as pcopy \gset
select tests.ok((select count(*) = 3 from public.trip_places where trip_id = :'pcopy'), 'a free route is copied right away');
select tests.ok((select public.acquire_free_route(:'free_route') = :'pcopy'::uuid), 'getting it twice returns the same copy');
select public.submit_review(:'free_route', 4, null);
select tests.ok((select count(*) = 1 from public.reviews where author_id = :'P'), 'free routes can be reviewed too');
insert into public.reports (reporter_id, target_type, target_id, reason) values (:'P', 'route', :'route', 'המסלול לא עדכני');
select tests.fails($$insert into public.reports (reporter_id, target_type, target_id, reason)
                    values ('16161616-1616-1616-1616-161616161616', 'route', gen_random_uuid(), 'בשם מישהו אחר')$$,
                   'you cannot report in someone else''s name');
reset role;

-- ---------- creator edits ----------
select set_config('request.jwt.claim.sub', :'N', false);
set role authenticated;
select tests.fails($$select public.update_my_route('$$ || :'route' || $$', 'x', 'y', 0)$$, 'only the creator edits a route');
select tests.ok((select count(*) = 0 from public.reports), 'users see only their own reports');
reset role;
select set_config('request.jwt.claim.sub', :'M', false);
set role authenticated;
select tests.ok((select public.update_my_route(:'route', 'רומא ב-2 ימים', 'מסלול מלא לשני ימים ברומא, מעודכן לסתיו', 5900) = 'published'),
                'editing a published route keeps it in the store');
reset role;

-- ---------- admin ----------
select set_config('request.jwt.claim.sub', :'O', false);
set role authenticated;
select tests.ok((select (public.admin_stats() ->> 'reports_open')::int = 1), 'admin stats');
select tests.ok((select count(*) >= 4 from public.admin_list_users(null, 50)) and (select count(*) = 1 from public.admin_list_users('buyer', 50)),
                'admin can list and search users');
select public.admin_resolve_report((select id from public.reports limit 1), 'resolved');
select tests.fails($$select public.admin_record_payout('15151515-1515-1515-1515-151515151515', 5000, 'too much')$$, 'a payout above the balance is refused');
select public.admin_record_payout(:'M', 3000, 'העברה בנקאית 1');
select tests.ok((select paid_out_agorot = 3000 and earned_agorot = 3920 from public.creator_balances where creator_id = :'M'), 'payouts reduce the balance');
select tests.fails($$select public.admin_set_setting('commission_rate', '0.6')$$, 'commission above 50% is refused');
select public.admin_set_setting('commission_rate', '0.15');
update public.reviews set status = 'hidden' where author_id = :'P';
select tests.fails($$select public.admin_set_role('17171717-1717-1717-1717-171717171717', 'user')$$, 'an admin cannot remove their own admin role');
select public.admin_set_role(:'P', 'creator');
reset role;
select tests.ok((select (value #>> '{}')::numeric = 0.15 from public.platform_settings where key = 'commission_rate'), 'commission is a setting, not code');
set role anon;
select tests.ok((select count(*) = 0 from public.reviews_public where published_trip_id = :'free_route'), 'a hidden review disappears from the store');
reset role;

select set_config('request.jwt.claim.sub', :'N', false);
set role authenticated;
select tests.fails($$select public.admin_stats()$$, 'regular users cannot see admin stats');
select tests.fails($$select * from public.admin_list_users(null, 10)$$, 'regular users cannot list users');
select tests.fails($$select public.admin_set_setting('commission_rate', '0')$$, 'regular users cannot change the commission');
reset role;

\warn 'ALL MARKETPLACE TESTS PASSED'
