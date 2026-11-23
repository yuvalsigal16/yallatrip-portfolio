-- The monthly ceiling on Google searches: counted only by the server, and it stops at the limit.
\set ON_ERROR_STOP on
\set QUIET on
\set U '19191919-1919-1919-1919-191919191919'

insert into auth.users (id, email, raw_user_meta_data) values (:'U', 'cap@example.com', '{}');

-- a signed-in user can neither count nor read the counters
select set_config('request.jwt.claim.sub', :'U', false);
set role authenticated;
select tests.fails($$select public.consume_monthly_quota('nearby_pro', 1000000)$$, 'users cannot count searches themselves');
select tests.fails($$select count(*) from public.api_monthly_usage$$, 'users cannot read the monthly counters');
reset role;
set role anon;
select tests.fails($$select public.consume_monthly_quota('nearby_pro', 1000000)$$, 'visitors cannot count searches');
reset role;

-- the server counts, up to the limit and no further
set role service_role;
select tests.ok((select public.consume_monthly_quota('nearby_pro', 2)), 'first search of the month is allowed');
select tests.ok((select public.consume_monthly_quota('nearby_pro', 2)), 'second search is allowed (limit 2)');
select tests.ok((select not public.consume_monthly_quota('nearby_pro', 2)), 'third search is refused at the limit');
select tests.ok((select count = 2 from public.api_monthly_usage where sku = 'nearby_pro'), 'a refused search is not counted');
select tests.ok((select public.consume_monthly_quota('text_enterprise', 2)), 'each price tier has its own counter');
select tests.ok((select public.consume_monthly_quota('details_enterprise', 2)), 'full place cards have their own counter');
select tests.ok((select public.consume_monthly_quota('photos', 2)), 'so do the cards'' photos');
select tests.fails($$select public.consume_monthly_quota('directions', 2)$$, 'only known price tiers');
reset role;

-- only the admin reads how much of the month is used
\set A '28282828-2828-2828-2828-282828282828'
insert into auth.users (id, email, raw_user_meta_data) values (:'A', 'cap-admin@example.com', '{}');
update public.profiles set role = 'admin' where id = :'A';
select set_config('request.jwt.claim.sub', :'U', false);
set role authenticated;
select tests.fails($$select * from public.admin_monthly_usage()$$, 'a user cannot read the month''s use');
reset role;
select set_config('request.jwt.claim.sub', :'A', false);
set role authenticated;
select tests.ok((select used = 2 from public.admin_monthly_usage() where sku = 'nearby_pro'), 'the admin sees the month''s use');
reset role;

\warn 'ALL MONTHLY CAP TESTS PASSED'
