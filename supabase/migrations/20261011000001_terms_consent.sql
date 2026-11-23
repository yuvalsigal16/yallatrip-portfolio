-- Terms of use + privacy policy: accepted once, when the account is first created.
alter table public.profiles add column if not exists terms_accepted_at timestamptz;

-- Accounts that existed before this change are not asked again.
update public.profiles set terms_accepted_at = coalesce(created_at, now()) where terms_accepted_at is null;

-- The signed-in user accepts (first time only; later calls keep the original time).
create or replace function public.accept_terms()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set terms_accepted_at = now()
  where id = auth.uid() and terms_accepted_at is null;
$$;
revoke all on function public.accept_terms() from public, anon;
grant execute on function public.accept_terms() to authenticated;
