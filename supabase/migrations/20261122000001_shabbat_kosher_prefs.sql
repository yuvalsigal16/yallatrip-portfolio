-- Two yes/no answers from the opening questions (and the profile): keeps Shabbat (new trips start with
-- Shabbat on, and its times show while planning) and keeps kosher (kosher food first on a place card).
alter table public.user_preferences
  add column if not exists keeps_shabbat boolean not null default false,
  add column if not exists keeps_kosher  boolean not null default false;

-- complete_onboarding takes the two answers too. The old three-answer version is replaced, not kept beside
-- it (two versions with optional arguments would make every call ambiguous). Nothing is deleted from any table.
-- An answer left out (null) keeps what was saved before.
drop function if exists public.complete_onboarding(text[], public.budget_level, public.transport_mode[]);
create or replace function public.complete_onboarding(
  p_travel_styles text[] default null,
  p_budget        public.budget_level default null,
  p_transport     public.transport_mode[] default null,
  p_keeps_shabbat boolean default null,
  p_keeps_kosher  boolean default null
) returns void language plpgsql security invoker set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  if p_travel_styles is not null or p_budget is not null or p_transport is not null
     or p_keeps_shabbat is not null or p_keeps_kosher is not null then
    insert into public.user_preferences (user_id, travel_styles, budget_level, default_transport, keeps_shabbat, keeps_kosher)
    values (uid, coalesce(p_travel_styles, '{}'), p_budget, coalesce(p_transport, '{walk,transit}'),
            coalesce(p_keeps_shabbat, false), coalesce(p_keeps_kosher, false))
    on conflict (user_id) do update set
      travel_styles     = coalesce(p_travel_styles, public.user_preferences.travel_styles),
      budget_level      = coalesce(p_budget, public.user_preferences.budget_level),
      default_transport = coalesce(p_transport, public.user_preferences.default_transport),
      keeps_shabbat     = coalesce(p_keeps_shabbat, public.user_preferences.keeps_shabbat),
      keeps_kosher      = coalesce(p_keeps_kosher, public.user_preferences.keeps_kosher);
  end if;

  update public.profiles set onboarding_completed_at = now()
   where id = uid and onboarding_completed_at is null;
end $$;
revoke execute on function public.complete_onboarding(text[], public.budget_level, public.transport_mode[], boolean, boolean) from public, anon;
grant execute on function public.complete_onboarding(text[], public.budget_level, public.transport_mode[], boolean, boolean) to authenticated;
