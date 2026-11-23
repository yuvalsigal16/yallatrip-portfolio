-- Deleting a user from the Auth dashboard cascades into trip_places; this trigger then ran as the auth role,
-- which has no rights on public.saved_places, and the whole deletion failed.
alter function public.sync_saved_place_status() security definer set search_path = public;
