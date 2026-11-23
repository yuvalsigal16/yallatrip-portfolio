-- "ישראלים ממליצים": places GoTrip travellers rated well, near a point (aggregates only). Applied in the project.
create or replace function public.israeli_picks(p_lat double precision, p_lng double precision, p_km double precision default 80)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(z order by z.cnt desc, z.avg desc nulls last), '[]'::jsonb) from (
    select v.gid, v.lat, v.lng, v.name, round(avg(v.rating)::numeric, 1) as avg, count(*) as cnt
      from (
        select distinct on (pl.google_place_id, t.owner_id)
               pl.google_place_id as gid, pl.lat, pl.lng, sp.label as name, sp.rating
          from public.saved_places sp
          join public.places pl on pl.id = sp.place_id
          join public.trips t on t.id = sp.trip_id
         where auth.uid() is not null and not t.is_snapshot
           and (sp.rating is not null or nullif(trim(coalesce(sp.review, '')), '') is not null)
           and pl.lat between p_lat - least(p_km, 300) / 111.0 and p_lat + least(p_km, 300) / 111.0
           and pl.lng between p_lng - least(p_km, 300) / (111.0 * greatest(cos(radians(p_lat)), 0.2))
                          and p_lng + least(p_km, 300) / (111.0 * greatest(cos(radians(p_lat)), 0.2))
         order by pl.google_place_id, t.owner_id, sp.updated_at desc
      ) v
     group by v.gid, v.lat, v.lng, v.name
    having coalesce(avg(v.rating), 5) >= 4
     limit 80
  ) z;
$$;
revoke all on function public.israeli_picks(double precision, double precision, double precision) from public, anon;
grant execute on function public.israeli_picks(double precision, double precision, double precision) to authenticated;
