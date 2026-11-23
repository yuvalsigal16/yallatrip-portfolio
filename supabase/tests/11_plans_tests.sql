-- "מנויים פעילים": off by default, only the admin switches it, and nobody gives themselves a plan.
\set ON_ERROR_STOP on
\set QUIET on
\set U '23232323-2323-2323-2323-232323232323'
\set A '24242424-2424-2424-2424-242424242424'

insert into auth.users (id, email, raw_user_meta_data) values (:'U', 'plan-user@example.com', '{}'), (:'A', 'plan-admin@example.com', '{}');
update public.profiles set role = 'admin' where id = :'A';

set role anon;
select tests.ok((select not public.subscriptions_active()), 'subscriptions start off');
reset role;

select set_config('request.jwt.claim.sub', :'U', false);
set role authenticated;
select tests.fails($$select public.admin_set_subscriptions_active(true)$$, 'a user cannot turn subscriptions on');
select tests.fails($$select count(*) from public.app_settings$$, 'users cannot read the settings table directly');
select tests.fails($$insert into public.subscriptions (user_id, kind, ends_on) values ('23232323-2323-2323-2323-232323232323', 'year', '2099-01-01')$$,
                   'nobody gives themselves a plan');
select tests.ok((select not public.has_plan(null)), 'without a plan, has_plan is false');
reset role;

select set_config('request.jwt.claim.sub', :'A', false);
set role authenticated;
select public.admin_set_subscriptions_active(true);
select tests.ok((select public.subscriptions_active()), 'the admin turns subscriptions on');
select public.admin_set_subscriptions_active(false);
select tests.ok((select not public.subscriptions_active()), 'and off again');
reset role;

-- a yearly plan (added by the server) counts for every trip
insert into public.subscriptions (user_id, kind, ends_on) values (:'U', 'year', current_date + 30);
select set_config('request.jwt.claim.sub', :'U', false);
set role authenticated;
select tests.ok((select public.has_plan(gen_random_uuid())), 'a yearly plan opens every trip');
select tests.ok((select count(*) = 1 from public.subscriptions), 'a user sees their own plan');
reset role;
select set_config('request.jwt.claim.sub', :'A', false);
set role authenticated;
select tests.ok((select not public.has_plan(null)), 'someone else''s plan is not yours');
reset role;

\warn 'ALL PLANS TESTS PASSED'
