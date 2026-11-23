-- The traveller's short first guide on the trip map ("start") is remembered like the other guides.
create or replace function public.mark_tour(p_key text)
returns void language sql security definer set search_path to 'public' as $$
  update public.profiles set tours_seen = array_append(tours_seen, p_key)
  where id = auth.uid() and p_key in ('home','new','start','trip','days','saved','place') and not (p_key = any(tours_seen));
$$;
