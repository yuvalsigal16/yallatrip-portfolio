'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { consumePlaceLookup, consumeQuota, HttpError } from '@/lib/api/guard';
import { placeDetails } from '@/lib/google/places';
import { GENERIC_ERROR } from '@/lib/auth/errors';
import type { FormState } from '@/lib/auth/rules';
import { isGooglePlaceId, isSessionToken, isUuid } from '@/lib/validation';
import { isRecCategory, type CreatorRec } from '@/lib/recommendations';

const s = (fd: FormData, k: string) => (typeof fd.get(k) === 'string' ? (fd.get(k) as string) : '');

/**
 * "+ המלצה על מקום" (and editing one): an approved creator recommends a single place. A new place is looked up
 * once with the site's existing place details ("basic", as when saving a place), and its name and position are
 * kept with the recommendation, so showing it later never calls Google.
 */
export async function saveRecommendation(_p: FormState, fd: FormData): Promise<FormState> {
  const id = s(fd, 'id');
  const category = s(fd, 'category');
  const body = s(fd, 'body').trim();
  if (!isRecCategory(category)) return { error: 'בחרו סוג מקום' };
  if (body.length < 5 || body.length > 500) return { fieldErrors: { body: 'כתבו משפט או שניים (5–500 תווים)' }, values: { body } };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: GENERIC_ERROR };

  if (id) {
    if (!isUuid(id)) return { error: GENERIC_ERROR };
    const { error } = await supabase.from('place_recommendations').update({ category, body }).eq('id', id).eq('creator_id', auth.user.id);
    if (error) return { error: GENERIC_ERROR, values: { body } };
    revalidatePath('/creator');
    return { success: 'ההמלצה עודכנה' };
  }

  const placeId = s(fd, 'placeId');
  const token = s(fd, 'sessionToken');
  if (!isGooglePlaceId(placeId)) return { error: 'חפשו ובחרו מקום' };
  let place;
  try {
    await consumeQuota(supabase, 'details');
    await consumePlaceLookup(supabase);
    place = await placeDetails({ placeId, level: 'basic', sessionToken: isSessionToken(token) ? token : undefined });
  } catch (e) {
    return { error: e instanceof HttpError ? e.message : 'החיפוש לא זמין כרגע. נסו שוב בעוד רגע.', values: { body } };
  }
  if (!place?.location) return { error: 'לא מצאנו את המקום. נסו לחפש שוב.', values: { body } };
  const { error } = await supabase.from('place_recommendations').insert({
    creator_id: auth.user.id, google_place_id: place.googlePlaceId, name: (place.name ?? '').slice(0, 200) || 'מקום',
    lat: place.location.lat, lng: place.location.lng, category, body,
  });
  if (error) {
    if (error.code === '23505') return { error: 'כבר המלצת על המקום הזה. אפשר לערוך את ההמלצה ברשימה.', values: { body } };
    console.error('[saveRecommendation]', error.message);
    return { error: GENERIC_ERROR, values: { body } };
  }
  revalidatePath('/creator');
  return { success: `ההמלצה על ${place.name ?? 'המקום'} פורסמה` };
}

export async function deleteRecommendation(_p: FormState, fd: FormData): Promise<FormState> {
  const id = s(fd, 'id');
  if (!isUuid(id)) return { error: GENERIC_ERROR };
  const supabase = await createClient();
  const { error } = await supabase.from('place_recommendations').delete().eq('id', id);
  if (error) return { error: GENERIC_ERROR };
  revalidatePath('/creator');
  return { success: 'ההמלצה נמחקה' };
}

/** The admin hides a recommendation from everyone (or shows it again). Checked again in the database. */
export async function adminSetRecommendationHidden(_p: FormState, fd: FormData): Promise<FormState> {
  const id = s(fd, 'id');
  if (!isUuid(id)) return { error: GENERIC_ERROR };
  const hidden = s(fd, 'hidden') === 'true';
  const supabase = await createClient();
  const { error } = await supabase.from('place_recommendations').update({ hidden }).eq('id', id);
  if (error) return { error: GENERIC_ERROR };
  revalidatePath('/admin');
  return { success: hidden ? 'ההמלצה הוסתרה' : 'ההמלצה מוצגת שוב' };
}

type Row = { id: string; google_place_id: string; name: string; lat: number; lng: number; category: string; body: string; creators: { display_name: string; slug: string } | null };
const COLS = 'id, google_place_id, name, lat, lng, category, body, creators(display_name, slug)';
const toRec = (r: Row): CreatorRec => ({
  id: r.id, googlePlaceId: r.google_place_id, name: r.name, lat: r.lat, lng: r.lng,
  category: isRecCategory(r.category) ? r.category : 'other', body: r.body,
  creator: r.creators?.display_name ?? 'יוצר/ת', slug: r.creators?.slug ?? null,
});

/** On a place's card: what creators wrote about it. Free for everyone, from our own table (no Google call). */
export async function recommendationsFor(googlePlaceId: string): Promise<CreatorRec[]> {
  if (!isGooglePlaceId(googlePlaceId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from('place_recommendations').select(COLS).eq('google_place_id', googlePlaceId).eq('hidden', false).limit(10);
  if (error) return [];
  return ((data ?? []) as unknown as Row[]).map(toRec);
}

/** "✨ מה יש בסביבה": creators' recommendations around a place, closest first. */
export async function recommendationsNear(input: { lat: number; lng: number; radius: number; categories: string[] }): Promise<CreatorRec[]> {
  const { lat, lng, radius, categories } = input ?? {};
  if (![lat, lng, radius].every((n) => typeof n === 'number' && Number.isFinite(n)) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return [];
  const r = Math.min(Math.max(radius, 100), 5000);
  const dLat = r / 111_320;
  const dLng = r / (111_320 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  const supabase = await createClient();
  let q = supabase.from('place_recommendations').select(COLS).eq('hidden', false)
    .gte('lat', lat - dLat).lte('lat', lat + dLat).gte('lng', lng - dLng).lte('lng', lng + dLng).limit(30);
  const cats = (categories ?? []).filter(isRecCategory);
  if (cats.length) q = q.in('category', cats);
  const { data, error } = await q;
  if (error) return [];
  return ((data ?? []) as unknown as Row[]).map(toRec)
    .map((x) => ({ ...x, distanceMeters: Math.round(distance(lat, lng, x.lat, x.lng)) }))
    .filter((x) => x.distanceMeters <= r)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}

function distance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6_371_000, toRad = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(toRad(lat2 - lat1) / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lng2 - lng1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
