-- =====================================================================
-- GoTrip · Hardening after the Supabase security advisor (2026-09-24)
-- =====================================================================

-- 1. Fixed search_path on the trigger helpers.
alter function public.set_updated_at() set search_path = public;
alter function public.trips_share_token() set search_path = public;
alter function public.sync_trip_days() set search_path = public;
alter function public.sync_saved_place_status() set search_path = public;

-- 2. Internal helpers are not part of the API.
--    handle_new_user runs only as the sign-up trigger; setting_numeric only inside other functions.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.setting_numeric(text) from public, anon, authenticated;
--    is_trip_owner is used only by policies for signed-in users.
revoke execute on function public.is_trip_owner(uuid) from public, anon;
grant execute on function public.is_trip_owner(uuid) to authenticated;

-- Kept on purpose (the advisor lists them as warnings):
--  * is_admin, is_trip_public: used inside row-level policies that anonymous visitors also hit.
--  * The app's RPC functions (publish_trip, clone_shared_trip, admin_* ...): each checks who is calling.
--  * routes_catalog and reviews_public views: public store pages; they expose only published routes,
--    counts and a reviewer's first name.
