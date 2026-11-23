-- Recovered from the live project (migrations "place_reviews" and "place_reviews_limit", 2026-09-28),
-- which were applied there but never saved here. This is the final (limited) version.
-- Recommendations travelers wrote for a place (text and/or their own photos), shown on the place card to everyone signed in.
-- One per traveler (their latest), first name only. Store snapshots are copies, so they are skipped.
create or replace function public.place_reviews(p_google_place_id text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(y order by y.updated_at desc), '[]'::jsonb) from (
    select * from (
      select distinct on (t.owner_id)
             split_part(coalesce(pr.display_name, ''), ' ', 1) as name,
             pr.avatar_url as avatar,
             nullif(trim(coalesce(sp.review, '')), '') as review,
             coalesce((select array_agg(u) from unnest(sp.review_photos) u where u like 'https://%'), '{}') as photos,
             sp.updated_at,
             (t.owner_id = auth.uid()) as mine
        from public.saved_places sp
        join public.places pl on pl.id = sp.place_id
        join public.trips t on t.id = sp.trip_id
        left join public.profiles pr on pr.id = t.owner_id
       where auth.uid() is not null
         and pl.google_place_id = p_google_place_id
         and not t.is_snapshot
         and (nullif(trim(coalesce(sp.review, '')), '') is not null or coalesce(array_length(sp.review_photos, 1), 0) > 0)
       order by t.owner_id, sp.updated_at desc
    ) x order by x.updated_at desc limit 20
  ) y;
$$;
revoke execute on function public.place_reviews(text) from public, anon;
grant execute on function public.place_reviews(text) to authenticated;
