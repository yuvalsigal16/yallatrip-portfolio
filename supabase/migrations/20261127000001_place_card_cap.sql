-- A monthly ceiling on place cards too (rule 9), kept below Google's free monthly use so it costs nothing:
-- full cards (Place Details Enterprise, 1,000 free), name and position (Place Details Pro, 5,000 free) and
-- the card's photo (1,000 free). Travellers with a plan are not held by these (checked by the server).
-- Nothing is deleted: the counter table just learns three more kinds.
alter table public.api_monthly_usage drop constraint if exists api_monthly_usage_sku_check;
alter table public.api_monthly_usage add constraint api_monthly_usage_sku_check
  check (sku in ('nearby_pro', 'nearby_enterprise', 'text_enterprise', 'details_enterprise', 'details_pro', 'photos'));

-- The admin page shows how much of this month is used.
create or replace function public.admin_monthly_usage()
returns table (sku text, used integer) language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  return query select u.sku, u.count from public.api_monthly_usage u
   where u.month = date_trunc('month', now() at time zone 'utc')::date;
end $$;
revoke all on function public.admin_monthly_usage() from public, anon;
grant execute on function public.admin_monthly_usage() to authenticated;
