-- Duplicate a trip into a new trip of the caller: places, days, stops, times, notes, destinations.
-- Not copied: people, chat, album, reviews, visited marks, sharing settings.
-- Optional new start date: all dates (trip, days, destination legs) move by the same number of days.
create or replace function public.duplicate_trip(p_trip uuid, p_title text default null, p_start date default null)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  uid uuid := auth.uid();
  src public.trips%rowtype;
  v_new uuid;
  v_title text;
  shift int := 0;
  n_days int;
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select * into src from public.trips where id = p_trip;
  if not found or src.is_snapshot or not public.can_edit_trip(p_trip) then
    raise exception 'trip not found' using errcode = 'P0002';
  end if;

  v_title := left(coalesce(nullif(btrim(p_title), ''), src.title || ' – עותק'), 120);
  v_new := public.copy_trip_internal(p_trip, uid, v_title);

  update public.trips
     set with_kids = src.with_kids,
         destinations = src.destinations
   where id = v_new;

  if p_start is not null then
    if src.start_date is not null then
      shift := p_start - src.start_date;
      update public.trips
         set start_date = p_start,
             end_date = src.end_date + shift,
             destinations = case
               when jsonb_typeof(src.destinations) = 'array' then (
                 select coalesce(jsonb_agg(
                   case when (leg ? 'start') and (leg ? 'end')
                          and (leg->>'start') ~ '^\d{4}-\d{2}-\d{2}$' and (leg->>'end') ~ '^\d{4}-\d{2}-\d{2}$'
                        then leg || jsonb_build_object('start', to_char((leg->>'start')::date + shift, 'YYYY-MM-DD'),
                                                       'end', to_char((leg->>'end')::date + shift, 'YYYY-MM-DD'))
                        else leg end
                   order by ord), '[]'::jsonb)
                 from jsonb_array_elements(src.destinations) with ordinality as e(leg, ord))
               else src.destinations end
       where id = v_new;
    else
      select count(*) into n_days from public.trip_days where trip_id = v_new;
      if n_days > 0 then
        update public.trips set start_date = p_start, end_date = p_start + (n_days - 1) where id = v_new;
      end if;
    end if;
  end if;

  return v_new;
end $$;

revoke all on function public.duplicate_trip(uuid, text, date) from public, anon;
grant execute on function public.duplicate_trip(uuid, text, date) to authenticated;
