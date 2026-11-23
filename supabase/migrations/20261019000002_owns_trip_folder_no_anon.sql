-- Only signed-in users' storage rules use this check.
revoke execute on function public.owns_trip_folder(text) from public, anon;
grant execute on function public.owns_trip_folder(text) to authenticated;
