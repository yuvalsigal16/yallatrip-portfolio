-- "I was here" on the Today screen belongs to one line of the day, not to the place:
-- a hotel that appears three times in a day is ticked one line at a time.
alter table public.trip_places add column if not exists done_at timestamptz;

-- Ticks made so far were kept on the place. Carry each over to its first line in every day that has already come.
update public.trip_places tp set done_at = now()
  from public.saved_places sp, public.trip_days d
 where sp.id = tp.saved_place_id and d.id = tp.trip_day_id
   and sp.status = 'visited' and d.date is not null and d.date <= current_date
   and tp.id = (select t2.id from public.trip_places t2
                 where t2.trip_day_id = tp.trip_day_id and t2.saved_place_id = tp.saved_place_id
                 order by t2.position, t2.created_at limit 1);
