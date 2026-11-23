-- "דיווח על בעיה או רעיון": a signed-in user sends one; only they and the admin can read it.
\set ON_ERROR_STOP on
\set QUIET on
\set U '21212121-2121-2121-2121-212121212121'
\set V '22222222-2121-2121-2121-212121212121'

insert into auth.users (id, email, raw_user_meta_data) values (:'U', 'fb1@example.com', '{}'), (:'V', 'fb2@example.com', '{}');
select set_config('request.jwt.claim.sub', :'U', false);
set role authenticated;
insert into public.reports (reporter_id, target_type, reason) values (:'U', 'feedback', 'המפה נטענת לאט');
select tests.ok((select count(*) = 1 from public.reports where target_type = 'feedback'), 'a user sends a message and sees it');
select tests.fails($$insert into public.reports (reporter_id, target_type, reason) values ('21212121-2121-2121-2121-212121212121', 'route', 'מסלול בלי יעד')$$,
                   'a report on a route still needs the route');
select tests.fails($$insert into public.reports (reporter_id, target_type, target_id, reason) values ('21212121-2121-2121-2121-212121212121', 'feedback', gen_random_uuid(), 'רעיון עם יעד')$$,
                   'a message about the site has no target');
select tests.fails($$insert into public.reports (reporter_id, target_type, reason) values ('22222222-2121-2121-2121-212121212121', 'feedback', 'בשם מישהו אחר')$$,
                   'nobody sends in someone else''s name');
reset role;

select set_config('request.jwt.claim.sub', :'V', false);
set role authenticated;
select tests.ok((select count(*) = 0 from public.reports), 'another user cannot read it');
reset role;
set role anon;
select tests.fails($$insert into public.reports (reporter_id, target_type, reason) values ('21212121-2121-2121-2121-212121212121', 'feedback', 'אורח/ת')$$,
                   'a visitor who is not signed in cannot send');
reset role;

\warn 'ALL FEEDBACK TESTS PASSED'
