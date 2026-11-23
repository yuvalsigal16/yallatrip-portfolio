'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/validation';
import { GENERIC_ERROR } from '@/lib/auth/errors';
import { legsFromJson, type TripLeg } from '@/lib/trips/rules';
import { tradeNight } from '@/lib/trips/chapters';

// The trip photo album: photos taken on the trip, filed by date (and so by destination).

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };
export type AlbumUpload = { path: string; takenAt: string; lat: number | null; lng: number | null };

/** Album photos live in the private "trip-album" bucket, in the trip's own folder; shown through signed links. */
const ALBUM_BUCKET = 'trip-album';
const isAlbumPath = (tripId: string, p: unknown): p is string =>
  typeof p === 'string' && p.startsWith(`${tripId}/`) && /^[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,120}$/.test(p);

export async function addAlbumPhotos(input: { tripId: string; photos: AlbumUpload[] }): Promise<Result<number>> {
  const { tripId, photos } = input ?? {};
  if (!isUuid(tripId) || !Array.isArray(photos) || photos.length === 0 || photos.length > 40) return { ok: false, error: 'בקשה לא תקינה' };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: 'צריך להתחבר' };
  const rows = photos
    .filter((p) => isAlbumPath(tripId, p?.path) && !Number.isNaN(Date.parse(p.takenAt)))
    .map((p) => ({
      trip_id: tripId, user_id: auth.user!.id, url: p.path, taken_at: new Date(p.takenAt).toISOString(),
      lat: typeof p.lat === 'number' && Math.abs(p.lat) <= 90 ? p.lat : null,
      lng: typeof p.lng === 'number' && Math.abs(p.lng) <= 180 ? p.lng : null,
    }));
  if (!rows.length) return { ok: false, error: 'בקשה לא תקינה' };
  const { error } = await supabase.from('trip_album').insert(rows);
  if (error) return { ok: false, error: GENERIC_ERROR };
  revalidatePath(`/trips/${tripId}/album`);
  return { ok: true, data: rows.length };
}

/** Remove a photo from the album (form on the album page). */
export async function deleteAlbumPhoto(fd: FormData): Promise<void> {
  const tripId = fd.get('tripId');
  const id = fd.get('id');
  if (typeof tripId !== 'string' || typeof id !== 'string' || !isUuid(tripId) || !isUuid(id)) return;
  const supabase = await createClient();
  const { data } = await supabase.from('trip_album').delete().eq('id', id).eq('trip_id', tripId).select('url').maybeSingle();
  const path = (data as { url: string } | null)?.url;
  if (isAlbumPath(tripId, path)) await supabase.storage.from(ALBUM_BUCKET).remove([path]);
  revalidatePath(`/trips/${tripId}/album`);
}

/** Trip with children or not (drives the recommendations). */
export async function setTripKids(input: { tripId: string; value: boolean }): Promise<Result> {
  const { tripId, value } = input ?? {};
  if (!isUuid(tripId) || typeof value !== 'boolean') return { ok: false, error: 'בקשה לא תקינה' };
  const supabase = await createClient();
  const { error } = await supabase.from('trips').update({ with_kids: value }).eq('id', tripId);
  if (error) return { ok: false, error: GENERIC_ERROR };
  return { ok: true, data: null };
}

/** The traveller keeps Shabbat: the plan shows when Shabbat and festivals start and end. */
export async function setTripShabbat(input: { tripId: string; value: boolean }): Promise<Result> {
  const { tripId, value } = input ?? {};
  if (!isUuid(tripId) || typeof value !== 'boolean') return { ok: false, error: 'בקשה לא תקינה' };
  const supabase = await createClient();
  const { error } = await supabase.from('trips').update({ keeps_shabbat: value }).eq('id', tripId);
  if (error) return { ok: false, error: GENERIC_ERROR };
  revalidatePath(`/trips/${tripId}/today`);
  return { ok: true, data: null };
}

/** How full the days should be (relaxed / normal / full). */
export async function setTripPace(input: { tripId: string; pace: string }): Promise<Result> {
  const { tripId, pace } = input ?? {};
  if (!isUuid(tripId) || !['relaxed', 'normal', 'full'].includes(pace)) return { ok: false, error: 'בקשה לא תקינה' };
  const supabase = await createClient();
  const { error } = await supabase.from('trips').update({ pace }).eq('id', tripId);
  if (error) return { ok: false, error: GENERIC_ERROR };
  return { ok: true, data: null };
}

/** A newly saved place goes straight into the best day (on), or waits in the saved list (off). */
export async function setTripAutoAssign(input: { tripId: string; value: boolean }): Promise<Result> {
  const { tripId, value } = input ?? {};
  if (!isUuid(tripId) || typeof value !== 'boolean') return { ok: false, error: 'בקשה לא תקינה' };
  const supabase = await createClient();
  const { error } = await supabase.from('trips').update({ auto_assign: value }).eq('id', tripId);
  if (error) return { ok: false, error: GENERIC_ERROR };
  return { ok: true, data: null };
}

/**
 * One night more (by 1) or less (-1) in destination `index`, taken from or given to its neighbour
 * (the next one; for the last destination, the one before). The trip's length never changes.
 */
export async function tradeLegNight(input: { tripId: string; index: number; by: 1 | -1 }): Promise<Result<TripLeg[]>> {
  const { tripId, index, by } = input ?? {};
  if (!isUuid(tripId) || !Number.isInteger(index) || (by !== 1 && by !== -1)) return { ok: false, error: 'בקשה לא תקינה' };
  const supabase = await createClient();
  const { data } = await supabase.from('trips').select('destinations').eq('id', tripId).maybeSingle();
  const legs = legsFromJson((data as { destinations?: unknown } | null)?.destinations);
  if (index < 0 || index >= legs.length || legs.length < 2) return { ok: false, error: 'בקשה לא תקינה' };
  const next = index < legs.length - 1 ? tradeNight(legs, index, by) : tradeNight(legs, index - 1, by === 1 ? -1 : 1);
  if (!next) return { ok: false, error: 'כל מקום צריך לפחות לילה אחד' };
  const { error } = await supabase.from('trips').update({ destinations: next }).eq('id', tripId);
  if (error) return { ok: false, error: GENERIC_ERROR };
  revalidatePath(`/trips/${tripId}`);
  return { ok: true, data: next };
}

/** The album's own name ("Rome with the girls"); empty = back to the default. */
export async function setAlbumTitle(input: { tripId: string; title: string }): Promise<Result<string | null>> {
  const { tripId, title } = input ?? {};
  if (!isUuid(tripId) || typeof title !== 'string') return { ok: false, error: 'בקשה לא תקינה' };
  const clean = title.trim().slice(0, 80);
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_album_title', { p_trip: tripId, p_title: clean });
  if (error) return { ok: false, error: GENERIC_ERROR };
  revalidatePath(`/trips/${tripId}/album`);
  return { ok: true, data: clean || null };
}
