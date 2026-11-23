-- A name for the trip's photo album (anyone planning the trip can set it).
alter table public.trips add column if not exists album_title text check (album_title is null or char_length(album_title) between 1 and 80);
create or replace function public.set_album_title(p_trip uuid, p_title text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_edit_trip(p_trip) then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.trips set album_title = nullif(btrim(left(coalesce(p_title, ''), 80)), '') where id = p_trip;
end $$;
revoke all on function public.set_album_title(uuid, text) from public, anon;
grant execute on function public.set_album_title(uuid, text) to authenticated;
