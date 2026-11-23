'use server';

import { mayUsePlanTools } from '@/lib/plans-access';
import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { consumeMonthly, consumePlaceLookup, consumeQuota, HttpError } from '@/lib/api/guard';
import { placeDetails, placesAround } from '@/lib/google/places';
import { GENERIC_ERROR } from '@/lib/auth/errors';
import { guessCategory, isCategoryKey, type CategoryKey } from '@/lib/places/categories';
import type { MapPlace } from '@/lib/places/queries';
import { isGooglePlaceId, isSessionToken, isUuid } from '@/lib/validation';
import { googleErrorMessage } from '@/lib/google/client';

// Actions the map calls directly from the browser. Each one checks its input,
// checks that the trip belongs to the signed-in user (RLS), and returns a plain result.

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

const fail = (error: string): ActionResult<never> => ({ ok: false, error });

async function ownTrip(supabase: SupabaseClient, tripId: string) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase.from('trips').select('id, hotel_saved_place_id').eq('id', tripId).maybeSingle();
  return (data as unknown as { id: string; hotel_saved_place_id: string | null } | null) ?? null;
}

async function categoryId(supabase: SupabaseClient, key: CategoryKey): Promise<number | null> {
  const { data } = await supabase.from('categories').select('id').eq('key', key).maybeSingle();
  return (data as unknown as { id: number } | null)?.id ?? null;
}

// ---------- save a place to the trip ----------
export async function savePlaceToTrip(input: {
  tripId: string; googlePlaceId: string; categoryKey?: string; sessionToken?: string;
}): Promise<ActionResult<MapPlace>> {
  const { tripId, googlePlaceId, categoryKey, sessionToken } = input ?? {};
  if (!isUuid(tripId) || !isGooglePlaceId(googlePlaceId)) return fail('בקשה לא תקינה');
  if (categoryKey !== undefined && !isCategoryKey(categoryKey)) return fail('קטגוריה לא מוכרת');

  const supabase = await createClient();
  const trip = await ownTrip(supabase, tripId);
  if (!trip) return fail('הטיול לא נמצא');

  // Look the place up ourselves: the location on the map comes from Google, not from the browser.
  let place;
  try {
    await consumeQuota(supabase, 'details');
    await consumePlaceLookup(supabase);
    place = await placeDetails({
      placeId: googlePlaceId, level: 'basic',
      sessionToken: isSessionToken(sessionToken) ? sessionToken : undefined,
    });
  } catch (e) {
    if (e instanceof HttpError) return fail(e.message);
    console.error('[savePlace] google', e);
    return fail(googleErrorMessage(e)?.message ?? 'שירות המפות לא זמין כרגע, נסו שוב בעוד רגע');
  }
  if (!place?.location) return fail('לא הצלחנו למצוא את המיקום של המקום הזה');

  const { data: pid, error: upsertError } = await createAdminClient().rpc('upsert_place', {
    p_google_place_id: place.googlePlaceId,
    p_lat: place.location.lat,
    p_lng: place.location.lng,
    p_primary_type: place.primaryType,
  });
  if (upsertError || typeof pid !== 'string') {
    console.error('[savePlace] upsert', upsertError?.message);
    return fail(GENERIC_ERROR);
  }

  const key: CategoryKey = (categoryKey as CategoryKey | undefined) ?? guessCategory(place.primaryType);
  const label = (place.name ?? 'מקום').slice(0, 200);
  const { data: row, error } = await supabase
    .from('saved_places')
    .insert({ trip_id: tripId, place_id: pid, category_id: await categoryId(supabase, key), label, is_must: key === 'must' })
    .select('id, status, is_must')
    .single();

  if (error) {
    // Already saved in this trip: return the existing one instead of an error.
    if ((error as { code?: string }).code === '23505') {
      const { data: existing } = await supabase
        .from('saved_places_on_map')
        .select('id, label, category_key, is_must, status, personal_note')
        .eq('trip_id', tripId).eq('google_place_id', place.googlePlaceId).maybeSingle();
      const ex = existing as Record<string, unknown> | null;
      if (ex) {
        return { ok: true, data: {
          id: ex.id as string, googlePlaceId: place.googlePlaceId, lat: place.location.lat, lng: place.location.lng,
          label: ex.label as string, categoryKey: (ex.category_key as string | null) ?? null,
          isMust: Boolean(ex.is_must), status: ex.status as MapPlace['status'], note: (ex.personal_note as string | null) ?? null,
        } };
      }
    }
    console.error('[savePlace] insert', error.message);
    return fail(GENERIC_ERROR);
  }

  const saved = row as { id: string; status: MapPlace['status']; is_must: boolean };

  // The first place saved as a hotel becomes the trip's hotel.
  if (key === 'hotel' && !trip.hotel_saved_place_id) {
    await supabase.from('trips').update({ hotel_saved_place_id: saved.id }).eq('id', tripId);
  }

  revalidatePath(`/trips/${tripId}`);
  return {
    ok: true,
    data: {
      id: saved.id, googlePlaceId: place.googlePlaceId, lat: place.location.lat, lng: place.location.lng,
      label, categoryKey: key, isMust: saved.is_must, status: saved.status, note: null,
    },
  };
}

// ---------- "I'm here": the places around the traveler right now ----------
export type HerePlace = { googlePlaceId: string; name: string; address: string | null; distance: number | null; primaryType: string | null };

export async function placesHere(input: { tripId: string; lat: number; lng: number }): Promise<ActionResult<HerePlace[]>> {
  const { tripId, lat, lng } = input ?? {};
  if (!isUuid(tripId) || typeof lat !== 'number' || typeof lng !== 'number'
    || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return fail('בקשה לא תקינה');
  const supabase = await createClient();
  if (!(await ownTrip(supabase, tripId))) return fail('הטיול לא נמצא');
  if (!(await mayUsePlanTools(supabase, tripId))) return fail('זה חלק מהמנוי');
  try {
    await consumeQuota(supabase, 'nearby');
    await consumeMonthly('nearby_enterprise');
    // Close first; if nothing is that close (GPS drift indoors), look a little wider.
    let found = await placesAround({ lat, lng }, 80);
    if (found.length < 3) {
      await consumeMonthly('nearby_enterprise');
      found = await placesAround({ lat, lng }, 250);
    }
    return {
      ok: true,
      data: found.slice(0, 8).map((p) => ({
        googlePlaceId: p.googlePlaceId, name: p.name ?? 'מקום', address: p.address,
        distance: p.distanceMeters === null ? null : Math.round(p.distanceMeters), primaryType: p.primaryType,
      })),
    };
  } catch (e) {
    if (e instanceof HttpError) return fail(e.message);
    console.error('[placesHere]', e);
    return fail(googleErrorMessage(e)?.message ?? 'שירות המפות לא זמין כרגע, נסו שוב בעוד רגע');
  }
}

// ---------- remove from the trip ----------
export async function removeSavedPlace(input: { tripId: string; savedPlaceId: string }): Promise<ActionResult> {
  const { tripId, savedPlaceId } = input ?? {};
  if (!isUuid(tripId) || !isUuid(savedPlaceId)) return fail('בקשה לא תקינה');
  const supabase = await createClient();
  if (!(await ownTrip(supabase, tripId))) return fail('הטיול לא נמצא');

  const { data, error } = await supabase
    .from('saved_places').delete().eq('id', savedPlaceId).eq('trip_id', tripId).select('id');
  if (error || !Array.isArray(data) || data.length === 0) return fail(GENERIC_ERROR);
  revalidatePath(`/trips/${tripId}`);
  return { ok: true, data: null };
}

// ---------- change category ----------
export async function setPlaceCategory(input: {
  tripId: string; savedPlaceId: string; categoryKey: string;
}): Promise<ActionResult> {
  const { tripId, savedPlaceId, categoryKey } = input ?? {};
  if (!isUuid(tripId) || !isUuid(savedPlaceId) || !isCategoryKey(categoryKey)) return fail('בקשה לא תקינה');
  const supabase = await createClient();
  if (!(await ownTrip(supabase, tripId))) return fail('הטיול לא נמצא');

  const patch: Record<string, unknown> = { category_id: await categoryId(supabase, categoryKey) };
  if (categoryKey === 'must') patch.is_must = true;
  const { data, error } = await supabase
    .from('saved_places').update(patch).eq('id', savedPlaceId).eq('trip_id', tripId).select('id');
  if (error || !Array.isArray(data) || data.length === 0) return fail(GENERIC_ERROR);
  revalidatePath(`/trips/${tripId}`);
  return { ok: true, data: null };
}

// ---------- the trip's hotel ----------
export async function setTripHotel(input: { tripId: string; savedPlaceId: string | null }): Promise<ActionResult> {
  const { tripId, savedPlaceId } = input ?? {};
  if (!isUuid(tripId) || (savedPlaceId !== null && !isUuid(savedPlaceId))) return fail('בקשה לא תקינה');
  const supabase = await createClient();
  if (!(await ownTrip(supabase, tripId))) return fail('הטיול לא נמצא');

  // The database only accepts a hotel that is saved in this same trip.
  const { error } = await supabase.from('trips').update({ hotel_saved_place_id: savedPlaceId }).eq('id', tripId);
  if (error) return fail(GENERIC_ERROR);
  revalidatePath(`/trips/${tripId}`);
  return { ok: true, data: null };
}
