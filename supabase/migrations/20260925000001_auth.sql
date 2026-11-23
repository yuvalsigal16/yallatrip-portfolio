-- =====================================================================
-- GoTrip · Phase 4 · Sign-in support
-- Onboarding state, onboarding answers, and self-service account deletion.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Onboarding state on the profile
-- ---------------------------------------------------------------------
alter table public.profiles add column onboarding_completed_at timestamptz;
grant update (onboarding_completed_at) on public.profiles to authenticated;

-- Only known travel styles are stored (the list matches src/lib/auth/rules.ts).
alter table public.user_preferences
  add constraint travel_styles_known check (
    travel_styles <@ array['food', 'attractions', 'shopping', 'nature', 'nightlife', 'culture', 'relax', 'family']::text[]
  );

-- ---------------------------------------------------------------------
-- 2. Finish onboarding in one step: save answers (if any) and mark done.
--    Runs as the user, so RLS still applies.
-- ---------------------------------------------------------------------
create or replace function public.complete_onboarding(
  p_travel_styles text[] default null,
  p_budget        public.budget_level default null,
  p_transport     public.transport_mode[] default null
) returns void language plpgsql security invoker set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  if p_travel_styles is not null or p_budget is not null or p_transport is not null then
    insert into public.user_preferences (user_id, travel_styles, budget_level, default_transport)
    values (uid, coalesce(p_travel_styles, '{}'), p_budget, coalesce(p_transport, '{walk,transit}'))
    on conflict (user_id) do update set
      travel_styles     = excluded.travel_styles,
      budget_level      = excluded.budget_level,
      default_transport = excluded.default_transport;
  end if;

  update public.profiles set onboarding_completed_at = now()
   where id = uid and onboarding_completed_at is null;
end $$;
revoke execute on function public.complete_onboarding(text[], public.budget_level, public.transport_mode[]) from public, anon;
grant execute on function public.complete_onboarding(text[], public.budget_level, public.transport_mode[]) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Delete my account: removes the sign-in and, by cascade,
--    the profile, preferences, trips and everything under them.
-- ---------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  delete from auth.users where id = uid;
end $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
