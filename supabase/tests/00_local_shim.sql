-- Local stand-in for what Supabase already provides (roles, auth schema,
-- auth.uid()). Used ONLY by scripts/test-db.sh on a throwaway Postgres.
-- Never run this against the real Supabase project.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text,
  raw_user_meta_data jsonb not null default '{}'
);
-- Same as Supabase: the user id comes from the JWT (PostgREST puts the claims in request.jwt.claims).
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub'
  )::uuid
$$;
-- The role PostgREST logs in as (Supabase has the same one).
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login noinherit;
  end if;
end $$;
grant anon, authenticated, service_role to authenticator;

grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

-- assertion helpers
create schema tests;
grant usage on schema tests to anon, authenticated, service_role;

create function tests.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is true then raise notice 'PASS  %', msg;
  else raise exception 'FAIL  %', msg;
  end if;
end $$;

create function tests.fails(stmt text, msg text) returns void language plpgsql as $$
declare
  failed boolean := false;
  err text;
begin
  begin
    execute stmt;
  exception when others then
    failed := true; err := sqlerrm;
  end;
  if failed then raise notice 'PASS  % (blocked: %)', msg, err;
  else raise exception 'FAIL  % (statement was allowed)', msg;
  end if;
end $$;
grant execute on all functions in schema tests to anon, authenticated, service_role;

-- Storage (photo buckets): the parts of Supabase's storage schema the migrations use.
create schema storage;
create table storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name      text not null,
  owner     uuid
);
alter table storage.objects enable row level security;
-- Same as Supabase: the folders of a path, without the file name ('a/b/c.jpg' -> {a,b}).
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
grant usage on schema storage to anon, authenticated, service_role;
grant all on storage.buckets, storage.objects to anon, authenticated, service_role;

-- Same as Supabase: extensions live in their own schema (gen_random_bytes for invite tokens).
create schema extensions;
create extension pgcrypto with schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;
