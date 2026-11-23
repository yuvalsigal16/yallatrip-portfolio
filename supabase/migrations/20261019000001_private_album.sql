-- Trip album photos are private: a bucket of their own that only the trip's planners can read,
-- shown through short-lived signed links. (trip-photos stays public for traveler reviews.)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trip-album', 'trip-album', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy trip_album_select on storage.objects for select to authenticated
  using (bucket_id = 'trip-album' and public.owns_trip_folder(name));
create policy trip_album_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'trip-album' and public.owns_trip_folder(name));
create policy trip_album_delete on storage.objects for delete to authenticated
  using (bucket_id = 'trip-album' and public.owns_trip_folder(name));

-- A row now holds the photo's path in that bucket ("<trip id>/<file>"), inside its own trip's folder.
alter table public.trip_album drop constraint if exists trip_album_url_check;
alter table public.trip_album add constraint trip_album_url_check
  check (url ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}$' and split_part(url, '/', 1) = trip_id::text);
