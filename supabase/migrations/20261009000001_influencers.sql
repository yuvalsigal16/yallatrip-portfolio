-- Paid routes are for travel influencers / bloggers the owner works with.
-- A user asks (at sign-up or from the profile); the admin approves by making them a creator.
alter table public.profiles
  add column if not exists influencer_requested_at timestamptz,
  add column if not exists influencer_link text check (char_length(influencer_link) <= 300);

create or replace function public.request_influencer(p_link text default null)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  update public.profiles
     set influencer_requested_at = coalesce(influencer_requested_at, now()),
         influencer_link = nullif(left(trim(coalesce(p_link, '')), 300), '')
   where id = uid and role = 'user';
end $$;
revoke execute on function public.request_influencer(text) from public, anon;
grant execute on function public.request_influencer(text) to authenticated;

-- Pending requests, for the admin page.
create or replace function public.admin_influencer_requests()
returns table (id uuid, email text, display_name text, link text, requested_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  return query
    select p.id, u.email::text, p.display_name, p.influencer_link, p.influencer_requested_at
      from public.profiles p join auth.users u on u.id = p.id
     where p.role = 'user' and p.influencer_requested_at is not null
     order by p.influencer_requested_at;
end $$;
revoke execute on function public.admin_influencer_requests() from public, anon;
grant execute on function public.admin_influencer_requests() to authenticated;

create or replace function public.admin_decide_influencer(p_user uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  if p_approve then
    update public.profiles set role = 'creator' where id = p_user and role = 'user';
  else
    update public.profiles set influencer_requested_at = null where id = p_user and role = 'user';
  end if;
end $$;
revoke execute on function public.admin_decide_influencer(uuid, boolean) from public, anon;
grant execute on function public.admin_decide_influencer(uuid, boolean) to authenticated;

-- Opening a creator page (and publishing) now needs the admin's approval first.
create or replace function public.become_creator(p_slug text, p_display_name text, p_bio text default null)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles where id = uid and role in ('creator', 'admin')) then
    raise exception 'not approved as a creator' using errcode = '42501';
  end if;
  insert into public.creators (user_id, slug, display_name, bio) values (uid, lower(p_slug), p_display_name, p_bio);
end $$;
revoke execute on function public.become_creator(text, text, text) from public, anon;
grant execute on function public.become_creator(text, text, text) to authenticated;

-- The platform keeps 5% of each sale.
update public.platform_settings set value = '0.05'::jsonb, updated_at = now() where key = 'commission_rate';
