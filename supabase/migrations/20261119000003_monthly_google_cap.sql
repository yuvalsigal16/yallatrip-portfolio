-- A monthly ceiling on Google searches for the whole site, one counter per Google price tier, kept below
-- each tier's free monthly cap so these searches never cost money. Only the server (service_role) counts:
-- users cannot call it, so nobody can use up the month for everyone else.
create table if not exists public.api_monthly_usage (
  month date not null,
  sku   text not null check (sku in ('nearby_pro', 'nearby_enterprise', 'text_enterprise')),
  count integer not null default 0 check (count >= 0),
  primary key (month, sku)
);
alter table public.api_monthly_usage enable row level security;
revoke all on table public.api_monthly_usage from public, anon, authenticated;

-- Counts one search of this tier this month (UTC). Returns false, and counts nothing, once the month is at the limit.
create or replace function public.consume_monthly_quota(p_sku text, p_limit integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  m date := date_trunc('month', now() at time zone 'utc')::date;
  n integer;
begin
  if p_limit is null or p_limit < 1 then return false; end if;
  insert into public.api_monthly_usage (month, sku, count) values (m, p_sku, 1)
  on conflict (month, sku) do update set count = public.api_monthly_usage.count + 1
    where public.api_monthly_usage.count < p_limit
  returning count into n;
  return n is not null;
end $$;
revoke all on function public.consume_monthly_quota(text, integer) from public, anon, authenticated;
grant execute on function public.consume_monthly_quota(text, integer) to service_role;
