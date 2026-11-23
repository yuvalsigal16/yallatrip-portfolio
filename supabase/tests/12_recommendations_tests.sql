-- Creators' place recommendations: only approved creators write, everyone reads, only the admin hides.
\set ON_ERROR_STOP on
\set QUIET on
\set C '25252525-2525-2525-2525-252525252525'
\set U '26262626-2626-2626-2626-262626262626'
\set A '27272727-2727-2727-2727-272727272727'

insert into auth.users (id, email, raw_user_meta_data) values
  (:'C', 'rec-creator@example.com', '{}'), (:'U', 'rec-user@example.com', '{}'), (:'A', 'rec-admin@example.com', '{}');
update public.profiles set role = 'creator' where id = :'C';
update public.profiles set role = 'admin' where id = :'A';
insert into public.creators (user_id, slug, display_name) values (:'C', 'rec-creator', 'נועה מטיילת');

select set_config('request.jwt.claim.sub', :'C', false);
set role authenticated;
insert into public.place_recommendations (creator_id, google_place_id, name, lat, lng, category, body)
values (:'C', 'ChIJrec_place_000001', 'רוסקיולי', 41.8936, 12.4736, 'food', 'הקרבונרה הכי טובה ברומא');
select tests.ok((select count(*) = 1 from public.place_recommendations), 'an approved creator recommends a place');
update public.place_recommendations set body = 'הקרבונרה והבורטה', hidden = true where creator_id = :'C';
select tests.ok((select body = 'הקרבונרה והבורטה' and not hidden from public.place_recommendations), 'the creator edits it, but cannot hide or unhide');
reset role;

select set_config('request.jwt.claim.sub', :'U', false);
set role authenticated;
select tests.fails($$insert into public.place_recommendations (creator_id, google_place_id, name, lat, lng, category, body)
  values ('26262626-2626-2626-2626-262626262626', 'ChIJrec_place_000002', 'x', 1, 1, 'food', 'מקום טוב')$$, 'a regular user cannot recommend');
update public.place_recommendations set body = 'נפרץ' ;
select tests.ok((select body = 'הקרבונרה והבורטה' from public.place_recommendations), 'nobody edits someone else''s recommendation');
insert into public.reports (reporter_id, target_type, target_id, reason)
values (:'U', 'recommendation', (select id from public.place_recommendations limit 1), 'המקום סגור');
select tests.ok(true, 'a recommendation can be reported');
reset role;

set role anon;
select tests.ok((select count(*) = 1 from public.place_recommendations), 'visitors see recommendations');
reset role;

select set_config('request.jwt.claim.sub', :'A', false);
set role authenticated;
update public.place_recommendations set hidden = true;
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select tests.ok((select count(*) = 0 from public.place_recommendations), 'the admin hides it from everyone');
reset role;
select set_config('request.jwt.claim.sub', :'C', false);
set role authenticated;
select tests.ok((select count(*) = 1 and bool_and(hidden) from public.place_recommendations), 'the creator still sees it, marked hidden');
reset role;

\warn 'ALL RECOMMENDATION TESTS PASSED'
