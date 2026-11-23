-- Membership rules apply to signed-in people only; for visitors they failed with "permission denied for function can_edit_trip".
alter policy trips_member_read on public.trips to authenticated;
alter policy trips_member_update on public.trips to authenticated;
alter policy trip_members_read on public.trip_members to authenticated;
