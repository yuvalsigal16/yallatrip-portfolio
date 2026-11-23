-- "Keeps Shabbat" and "keeps kosher": saved with the opening answers, changed from the profile, never lost by leaving them out.
\set ON_ERROR_STOP on
\set QUIET on
\set U '20202020-2020-2020-2020-202020202020'

insert into auth.users (id, email, raw_user_meta_data) values (:'U', 'prefs@example.com', '{}');
select set_config('request.jwt.claim.sub', :'U', false);
set role authenticated;

select public.complete_onboarding(p_travel_styles => array['food'], p_transport => array['walk']::public.transport_mode[],
                                  p_keeps_shabbat => true, p_keeps_kosher => false);
select tests.ok((select keeps_shabbat and not keeps_kosher from public.user_preferences where user_id = :'U'), 'the two answers are saved');
select tests.ok((select budget_level is null from public.user_preferences where user_id = :'U'), 'no budget question: the budget stays empty');
select tests.ok((select onboarding_completed_at is not null from public.profiles where id = :'U'), 'onboarding is marked done');

-- the profile changes one answer; what it leaves out stays as it was
select public.complete_onboarding(p_keeps_kosher => true);
select tests.ok((select keeps_shabbat and keeps_kosher and travel_styles = array['food'] from public.user_preferences where user_id = :'U'),
                'changing one answer keeps the others');
select public.complete_onboarding(p_travel_styles => array['culture'], p_budget => 'high', p_transport => array['car']::public.transport_mode[]);
select tests.ok((select keeps_shabbat and keeps_kosher and budget_level = 'high' from public.user_preferences where user_id = :'U'),
                'saving the other answers keeps Shabbat and kosher');
reset role;

set role anon;
select tests.fails($$select public.complete_onboarding(p_keeps_shabbat => true)$$, 'a visitor cannot save answers');
reset role;

\warn 'ALL SHABBAT AND KOSHER TESTS PASSED'
