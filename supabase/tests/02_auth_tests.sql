-- Phase 4 tests: onboarding and account deletion.
\set ON_ERROR_STOP on
\set QUIET on
\set C '33333333-3333-3333-3333-333333333333'
\set D '44444444-4444-4444-4444-444444444444'

insert into auth.users (id, email, raw_user_meta_data) values
  (:'C', 'c@example.com', '{"name":"דנה"}'),
  (:'D', 'd@example.com', '{}');
select tests.ok((select onboarding_completed_at is null from public.profiles where id = :'C'),
                'a new user has not finished onboarding');
select tests.ok((select display_name = 'דנה' from public.profiles where id = :'C'),
                'Google-style "name" metadata fills the display name');

-- ---------- onboarding ----------
select set_config('request.jwt.claim.sub', :'C', false);
set role authenticated;
select public.complete_onboarding(array['food', 'culture'], 'medium', array['walk', 'transit']::public.transport_mode[]);
select tests.ok((select onboarding_completed_at is not null from public.profiles where id = :'C'),
                'finishing onboarding marks the profile');
select tests.ok((select travel_styles = array['food', 'culture'] and budget_level = 'medium'
                   from public.user_preferences where user_id = :'C'),
                'onboarding answers are saved');
select public.complete_onboarding(array['nature'], null, null);
select tests.ok((select travel_styles = array['nature'] from public.user_preferences where user_id = :'C'),
                'answering again updates the answers');
select tests.fails($$select public.complete_onboarding(array['hacking'], null, null)$$,
                   'an unknown travel style is refused');
update public.profiles set onboarding_completed_at = now() where id = :'D';
reset role;
select tests.ok((select onboarding_completed_at is null from public.profiles where id = :'D'),
                'C cannot touch D''s profile');

-- skipping: marks done, saves nothing
select set_config('request.jwt.claim.sub', :'D', false);
set role authenticated;
select public.complete_onboarding();
select tests.ok((select onboarding_completed_at is not null from public.profiles where id = :'D'),
                'skipping onboarding still marks it done');
select tests.ok((select count(*) = 0 from public.user_preferences), 'skipping saves no answers (and D cannot see C''s)');

-- D builds a trip, then deletes the account
insert into public.trips (owner_id, title, destination_name, start_date, end_date)
values (:'D', 'פריז', 'פריז', '2026-12-18', '2026-12-22');
select tests.ok((select count(*) = 5 from public.trip_days), 'D has a 5-day trip');
reset role;

set role anon;
select tests.fails($$select public.delete_my_account()$$, 'a visitor who is not signed in cannot delete anything');
select tests.fails($$select public.complete_onboarding()$$, 'a visitor cannot complete onboarding');
reset role;

select set_config('request.jwt.claim.sub', :'D', false);
set role authenticated;
select public.delete_my_account();
reset role;
select tests.ok((select count(*) = 0 from auth.users where id = :'D'), 'the account is deleted');
select tests.ok((select count(*) = 0 from public.profiles where id = :'D'), 'with its profile');
select tests.ok((select count(*) = 0 from public.trips where owner_id = :'D'), 'and its trips');
select tests.ok((select count(*) = 1 from auth.users where id = :'C'), 'other users are untouched');

\warn 'ALL AUTH TESTS PASSED'
