'use server';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { consumeQuota, HttpError } from '@/lib/api/guard';
import { GENERIC_ERROR } from '@/lib/auth/errors';
import { isTimeHHMM, isUuid } from '@/lib/validation';
import { algorithmPlan, buildPrompt, validateAiPlan, type PlanResult } from '@/lib/planning/ai';
import type { PlaceStatus } from '@/types/database';
import { getTripPlan, type PlanDay } from '@/lib/planning/queries';
import { getMapPlaces, type MapPlace } from '@/lib/places/queries';
import { publicEnv } from '@/lib/env';

// Planning actions called from the trip screen. RLS makes sure each one
// only touches the signed-in user's own trips; the checks here keep input clean.

export type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };
const fail = (error: string): Result<never> => ({ ok: false, error });
const bad = () => fail('בקשה לא תקינה');

async function client(tripId: string): Promise<SupabaseClient | null> {
  if (!isUuid(tripId)) return null;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  return auth.user ? supabase : null;
}
const done = (tripId: string) => revalidatePath(`/trips/${tripId}`);

// ---------- saved places (Phase 7) ----------
export async function updateSavedPlace(input: {
  tripId: string; savedPlaceId: string; label?: string; note?: string | null; isMust?: boolean;
}): Promise<Result> {
  const { tripId, savedPlaceId, label, note, isMust } = input ?? {};
  const supabase = await client(tripId);
  if (!supabase || !isUuid(savedPlaceId)) return bad();
  const patch: Record<string, unknown> = {};
  if (label !== undefined) {
    const l = String(label).trim();
    if (!l || l.length > 200) return fail('שם צריך להיות באורך 1–200 תווים');
    patch.label = l;
  }
  if (note !== undefined) {
    const n = note === null ? null : String(note).trim();
    if (n && n.length > 2000) return fail('ההערה ארוכה מדי (עד 2,000 תווים)');
    patch.personal_note = n || null;
  }
  if (isMust !== undefined) patch.is_must = Boolean(isMust);
  if (!Object.keys(patch).length) return bad();
  const { data, error } = await supabase.from('saved_places').update(patch).eq('id', savedPlaceId).eq('trip_id', tripId).select('id');
  if (error || !Array.isArray(data) || !data.length) return fail(GENERIC_ERROR);
  done(tripId);
  return { ok: true, data: null };
}

export async function setVisited(input: { tripId: string; savedPlaceId: string; visited: boolean }): Promise<Result<PlaceStatus>> {
  const { tripId, savedPlaceId, visited } = input ?? {};
  const supabase = await client(tripId);
  if (!supabase || !isUuid(savedPlaceId)) return bad();
  const { data, error } = await supabase.rpc('set_place_visited', { p_saved_place_id: savedPlaceId, p_visited: Boolean(visited) });
  if (error) return fail(GENERIC_ERROR);
  done(tripId);
  return { ok: true, data: data as unknown as PlaceStatus };
}

/**
 * "I was here" for one line of a day. The place itself counts as visited while any of its lines is ticked.
 */
export async function setStopDone(input: { tripId: string; stopId: string; done: boolean }): Promise<Result> {
  const { tripId, stopId, done: isDone } = input ?? {};
  const supabase = await client(tripId);
  if (!supabase || !isUuid(stopId) || typeof isDone !== 'boolean') return bad();
  const { data, error } = await supabase.from('trip_places')
    .update({ done_at: isDone ? new Date().toISOString() : null }).eq('id', stopId).eq('trip_id', tripId).select('saved_place_id');
  const savedPlaceId = (data as { saved_place_id: string }[] | null)?.[0]?.saved_place_id;
  if (error || !savedPlaceId) return fail(GENERIC_ERROR);
  let visited = isDone;
  if (!isDone) {
    const { count } = await supabase.from('trip_places').select('id', { count: 'exact', head: true })
      .eq('trip_id', tripId).eq('saved_place_id', savedPlaceId).not('done_at', 'is', null);
    visited = (count ?? 0) > 0;
  }
  await supabase.rpc('set_place_visited', { p_saved_place_id: savedPlaceId, p_visited: visited });
  done(tripId);
  return { ok: true, data: null };
}

// ---------- my recommendation for a place: text + my own photos (shown when the trip is shared) ----------
export type Review = { review: string; photos: string[]; rating: number | null };
const MAX_REVIEW_PHOTOS = 8;

const photoPrefix = (tripId: string) => `${publicEnv().supabaseUrl}/storage/v1/object/public/trip-photos/${tripId}/`;

export async function getReview(input: { tripId: string; savedPlaceId: string }): Promise<Result<Review>> {
  const { tripId, savedPlaceId } = input ?? {};
  const supabase = await client(tripId);
  if (!supabase || !isUuid(savedPlaceId)) return bad();
  const { data, error } = await supabase.from('saved_places').select('review, review_photos, rating')
    .eq('id', savedPlaceId).eq('trip_id', tripId).maybeSingle();
  if (error || !data) return fail(GENERIC_ERROR);
  const row = data as unknown as { review: string | null; review_photos: string[] | null; rating: number | null };
  return { ok: true, data: { review: row.review ?? '', photos: row.review_photos ?? [], rating: row.rating ?? null } };
}

export async function saveReview(input: { tripId: string; savedPlaceId: string; review: string; photos: string[]; rating?: number | null }): Promise<Result> {
  const { tripId, savedPlaceId } = input ?? {};
  const supabase = await client(tripId);
  if (!supabase || !isUuid(savedPlaceId)) return bad();
  const review = String(input.review ?? '').trim();
  if (review.length > 2000) return fail('ההמלצה ארוכה מדי (עד 2,000 תווים)');
  const photos = Array.isArray(input.photos) ? input.photos.filter((u): u is string => typeof u === 'string') : [];
  if (photos.length > MAX_REVIEW_PHOTOS) return fail(`אפשר עד ${MAX_REVIEW_PHOTOS} תמונות למקום`);
  // Only photos uploaded into this trip's own folder.
  const prefix = photoPrefix(tripId);
  if (photos.some((u) => !u.startsWith(prefix) || u.length > 400 || /\.\.|[?#]/.test(u.slice(prefix.length)))) return bad();

  const r = input.rating;
  if (r !== undefined && r !== null && !(Number.isInteger(r) && r >= 1 && r <= 5)) return bad();

  const before = await getReview({ tripId, savedPlaceId });
  const { data, error } = await supabase.from('saved_places')
    .update({ review: review || null, review_photos: photos, ...(r !== undefined ? { rating: r } : {}) })
    .eq('id', savedPlaceId).eq('trip_id', tripId).select('id');
  if (error || !Array.isArray(data) || !data.length) return fail(GENERIC_ERROR);

  // Photos taken out of the recommendation are deleted from storage too.
  if (before.ok) {
    const gone = before.data.photos.filter((u) => !photos.includes(u) && u.startsWith(prefix))
      .map((u) => `${tripId}/${u.slice(prefix.length)}`);
    if (gone.length) await supabase.storage.from('trip-photos').remove(gone);
  }
  done(tripId);
  return { ok: true, data: null };
}

// ---------- days and stops (Phase 8) ----------
export async function addStop(input: { tripId: string; dayId: string; savedPlaceId: string }): Promise<Result<string>> {
  const { tripId, dayId, savedPlaceId } = input ?? {};
  const supabase = await client(tripId);
  if (!supabase || !isUuid(dayId) || !isUuid(savedPlaceId)) return bad();
  const { data, error } = await supabase.rpc('add_stop_to_day', { p_day_id: dayId, p_saved_place_id: savedPlaceId });
  if (error || typeof data !== 'string') return fail(GENERIC_ERROR);
  done(tripId);
  return { ok: true, data };
}

export async function setDayOrder(input: { tripId: string; dayId: string; stopIds: string[] }): Promise<Result> {
  const { tripId, dayId, stopIds } = input ?? {};
  const supabase = await client(tripId);
  if (!supabase || !isUuid(dayId) || !Array.isArray(stopIds) || stopIds.length > 500 || !stopIds.every(isUuid)) return bad();
  const { error } = await supabase.rpc('set_day_order', { p_day_id: dayId, p_stop_ids: stopIds });
  if (error) {
    console.error('[setDayOrder]', error.message);
    return fail('הסדר לא נשמר. רעננו את הדף ונסו שוב');
  }
  done(tripId);
  return { ok: true, data: null };
}

export async function removeStop(input: { tripId: string; stopId: string }): Promise<Result> {
  const { tripId, stopId } = input ?? {};
  const supabase = await client(tripId);
  if (!supabase || !isUuid(stopId)) return bad();
  const { data, error } = await supabase.from('trip_places').delete().eq('id', stopId).eq('trip_id', tripId).select('saved_place_id, note');
  if (error || !Array.isArray(data) || !data.length) return fail(GENERIC_ERROR);
  // The stop's note stays with the place (in "מה שמרתי"), so taking it out of a day loses nothing.
  const { saved_place_id: spId, note } = data[0] as { saved_place_id: string; note: string | null };
  const kept = note?.trim();
  if (kept) {
    const { data: sp } = await supabase.from('saved_places').select('personal_note').eq('id', spId).eq('trip_id', tripId).maybeSingle();
    const cur = ((sp as { personal_note: string | null } | null)?.personal_note ?? '').trim();
    if (!cur.includes(kept)) {
      await supabase.from('saved_places').update({ personal_note: (cur ? `${cur}\n${kept}` : kept).slice(0, 2000) })
        .eq('id', spId).eq('trip_id', tripId);
    }
  }
  done(tripId);
  return { ok: true, data: null };
}

// ---------- "this or that": a second place kept beside a stop until the traveller decides ----------
export async function addAlt(input: { tripId: string; stopId: string; savedPlaceId: string }): Promise<Result> {
  const { tripId, stopId, savedPlaceId } = input ?? {};
  const supabase = await client(tripId);
  if (!supabase || !isUuid(stopId) || !isUuid(savedPlaceId)) return bad();
  const [{ data: stop }, { data: place }, { count }] = await Promise.all([
    supabase.from('trip_places').select('saved_place_id').eq('id', stopId).eq('trip_id', tripId).maybeSingle(),
    supabase.from('saved_places').select('id').eq('id', savedPlaceId).eq('trip_id', tripId).maybeSingle(),
    supabase.from('trip_place_alts').select('id', { count: 'exact', head: true }).eq('stop_id', stopId),
  ]);
  if (!stop || !place || (stop as { saved_place_id: string }).saved_place_id === savedPlaceId) return bad();
  if ((count ?? 0) >= 3) return fail('אפשר עד 3 חלופות לאותה תחנה');
  const { error } = await supabase.from('trip_place_alts').insert({ trip_id: tripId, stop_id: stopId, saved_place_id: savedPlaceId });
  if (error) return fail(error.code === '23505' ? 'המקום הזה כבר חלופה כאן' : GENERIC_ERROR);
  done(tripId);
  return { ok: true, data: null };
}

export async function removeAlt(input: { tripId: string; altId: string }): Promise<Result> {
  const { tripId, altId } = input ?? {};
  const supabase = await client(tripId);
  if (!supabase || !isUuid(altId)) return bad();
  const { error } = await supabase.from('trip_place_alts').delete().eq('id', altId).eq('trip_id', tripId);
  if (error) return fail(GENERIC_ERROR);
  done(tripId);
  return { ok: true, data: null };
}

/** The decision: `altId` takes the stop's place in the day (null = staying with the stop as it is). The others leave the day and stay saved. */
export async function chooseAlt(input: { tripId: string; stopId: string; altId: string | null }): Promise<Result> {
  const { tripId, stopId, altId } = input ?? {};
  const supabase = await client(tripId);
  if (!supabase || !isUuid(stopId) || (altId !== null && !isUuid(altId))) return bad();
  if (altId) {
    const { data: alt } = await supabase.from('trip_place_alts').select('saved_place_id').eq('id', altId).eq('stop_id', stopId).eq('trip_id', tripId).maybeSingle();
    const savedPlaceId = (alt as { saved_place_id: string } | null)?.saved_place_id;
    if (!savedPlaceId) return bad();
    // The stay length was the other place's, so it goes back to the default for the new one.
    const { data, error } = await supabase.from('trip_places').update({ saved_place_id: savedPlaceId, duration_min: null })
      .eq('id', stopId).eq('trip_id', tripId).select('id');
    if (error || !data?.length) return fail(GENERIC_ERROR);
  }
  const { error } = await supabase.from('trip_place_alts').delete().eq('stop_id', stopId).eq('trip_id', tripId);
  if (error) return fail(GENERIC_ERROR);
  done(tripId);
  return { ok: true, data: null };
}

export async function updateStop(input: {
  tripId: string; stopId: string; plannedTime?: string | null; durationMin?: number | null; note?: string | null;
  transportToNext?: 'walk' | 'drive' | 'transit' | null;
}): Promise<Result> {
  const { tripId, stopId, plannedTime, durationMin, note, transportToNext } = input ?? {};
  const supabase = await client(tripId);
  if (!supabase || !isUuid(stopId)) return bad();
  const patch: Record<string, unknown> = {};
  if (plannedTime !== undefined) {
    if (plannedTime !== null && !isTimeHHMM(plannedTime)) return fail('שעה לא תקינה');
    patch.planned_time = plannedTime;
  }
  if (durationMin !== undefined) {
    if (durationMin !== null && (!Number.isInteger(durationMin) || durationMin < 0 || durationMin > 1440)) return fail('משך לא תקין');
    patch.duration_min = durationMin;
  }
  if (note !== undefined) {
    const n = note === null ? null : String(note).trim();
    if (n && n.length > 2000) return fail('ההערה ארוכה מדי');
    patch.note = n || null;
  }
  if (transportToNext !== undefined) {
    if (transportToNext !== null && transportToNext !== 'walk' && transportToNext !== 'drive' && transportToNext !== 'transit') return bad();
    patch.transport_to_next = transportToNext === 'drive' ? 'car' : transportToNext;
  }
  if (!Object.keys(patch).length) return bad();
  const { data, error } = await supabase.from('trip_places').update(patch).eq('id', stopId).eq('trip_id', tripId).select('id');
  if (error || !Array.isArray(data) || !data.length) return fail(GENERIC_ERROR);
  done(tripId);
  return { ok: true, data: null };
}

/** Saves the times from "automatic times" in one go. */
export async function applyTimes(input: { tripId: string; times: { stopId: string; time: string }[] }): Promise<Result> {
  const { tripId, times } = input ?? {};
  const supabase = await client(tripId);
  if (!supabase || !Array.isArray(times) || times.length > 100) return bad();
  if (!times.every((t) => isUuid(t?.stopId) && isTimeHHMM(t?.time))) return bad();
  for (const t of times) {
    const { error } = await supabase.from('trip_places').update({ planned_time: t.time }).eq('id', t.stopId).eq('trip_id', tripId);
    if (error) return fail(GENERIC_ERROR);
  }
  done(tripId);
  return { ok: true, data: null };
}

export async function updateDay(input: {
  tripId: string; dayId: string; title?: string | null; startTime?: string | null; startPlaceId?: string | null; notes?: string | null;
  startTransport?: 'walk' | 'drive' | 'transit' | null;
}): Promise<Result> {
  const { tripId, dayId, title, startTime, startPlaceId, notes, startTransport } = input ?? {};
  const supabase = await client(tripId);
  if (!supabase || !isUuid(dayId)) return bad();
  const patch: Record<string, unknown> = {};
  if (title !== undefined) {
    const t = title === null ? null : String(title).trim();
    if (t && t.length > 120) return fail('השם ארוך מדי');
    patch.title = t || null;
  }
  if (startTime !== undefined) {
    if (startTime !== null && !isTimeHHMM(startTime)) return fail('שעה לא תקינה');
    patch.start_time = startTime;
  }
  if (notes !== undefined) {
    const n = notes === null ? null : String(notes).trim();
    if (n && n.length > 2000) return fail('ההערה ארוכה מדי');
    patch.notes = n || null;
  }
  if (startPlaceId !== undefined) {
    // The database only accepts a place saved in this same trip.
    if (startPlaceId !== null && !isUuid(startPlaceId)) return bad();
    patch.start_saved_place_id = startPlaceId;
  }
  if (startTransport !== undefined) {
    if (startTransport !== null && startTransport !== 'walk' && startTransport !== 'drive' && startTransport !== 'transit') return bad();
    patch.start_transport = startTransport === 'drive' ? 'car' : startTransport;
  }
  if (!Object.keys(patch).length) return bad();
  const { data, error } = await supabase.from('trip_days').update(patch).eq('id', dayId).eq('trip_id', tripId).select('id');
  if (error || !Array.isArray(data) || !data.length) return fail(GENERIC_ERROR);
  done(tripId);
  return { ok: true, data: null };
}

// ---------- automatic split into days (Phase 10) ----------
/**
 * Suggests which unscheduled places go on which day. With ANTHROPIC_API_KEY set, asks Claude
 * (validated: only known ids, each once); otherwise, or if the answer is unusable, the
 * geographic algorithm answers. Nothing is saved until the user applies the suggestion.
 */
export async function suggestDayPlan(input: { tripId: string; useAi: boolean }): Promise<Result<PlanResult>> {
  const { tripId, useAi } = input ?? {};
  const supabase = await client(tripId);
  if (!supabase) return bad();

  const [{ data: trip }, { data: saved }, { data: days }] = await Promise.all([
    supabase.from('trips').select('destination_name, travel_styles').eq('id', tripId).maybeSingle(),
    supabase.from('saved_places_on_map').select('id, label, category_key, lat, lng, status').eq('trip_id', tripId),
    supabase.from('trip_days').select('day_index, date, trip_places(saved_place_id)').eq('trip_id', tripId).order('day_index', { ascending: true }),
  ]);
  if (!trip || !Array.isArray(days) || !days.length) return fail('צריך תאריכים לטיול כדי לחלק לימים');

  const rows = (saved ?? []) as unknown as { id: string; label: string; category_key: string | null; lat: number; lng: number; status: string }[];
  const scheduled = new Set(
    (days as { trip_places: { saved_place_id: string }[] }[]).flatMap((d) => d.trip_places.map((t) => t.saved_place_id)),
  );
  const labelOf = new Map(rows.map((r) => [r.id, r.label]));
  const places = rows
    .filter((r) => !scheduled.has(r.id) && r.category_key !== 'hotel')
    .map((r) => ({ id: r.id, name: r.label, category: r.category_key, lat: r.lat, lng: r.lng }));
  if (!places.length) return fail('כל המקומות כבר משובצים בימים');

  const planDays = (days as { day_index: number; date: string | null; trip_places: { saved_place_id: string }[] }[]).map((d) => ({
    index: d.day_index, date: d.date, existing: d.trip_places.map((t) => labelOf.get(t.saved_place_id) ?? ''),
  }));

  const t = trip as { destination_name: string; travel_styles: string[] };
  const key = process.env.ANTHROPIC_API_KEY;
  if (useAi && key) {
    try {
      await consumeQuota(supabase, 'ai');
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
          max_tokens: 2000,
          messages: [{ role: 'user', content: buildPrompt(places, planDays, t.travel_styles, t.destination_name) }],
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (res.ok) {
        const body = (await res.json()) as { content?: { type: string; text?: string }[] };
        const text = (body.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('');
        const plan = validateAiPlan(text, places, planDays);
        if (plan) return { ok: true, data: plan };
      } else {
        console.error('[ai plan]', res.status, (await res.text()).slice(0, 300));
      }
    } catch (e) {
      if (e instanceof HttpError) return fail(e.message);
      console.error('[ai plan]', e);
    }
  }
  return { ok: true, data: algorithmPlan(places, planDays) };
}

/** Applies a suggestion: each place goes to the end of its day. */
export async function applyDayPlan(input: { tripId: string; assignments: { dayId: string; savedPlaceIds: string[] }[] }): Promise<Result<number>> {
  const { tripId, assignments } = input ?? {};
  const supabase = await client(tripId);
  if (!supabase || !Array.isArray(assignments) || assignments.length > 400) return bad();
  let added = 0;
  for (const a of assignments) {
    if (!isUuid(a?.dayId) || !Array.isArray(a.savedPlaceIds) || !a.savedPlaceIds.every(isUuid)) return bad();
    for (const sp of a.savedPlaceIds) {
      const { error } = await supabase.rpc('add_stop_to_day', { p_day_id: a.dayId, p_saved_place_id: sp });
      if (error) return fail(`${added ? `שובצו ${added} מקומות, ואז ` : ''}משהו השתבש. רעננו את הדף`);
      added++;
    }
  }
  done(tripId);
  return { ok: true, data: added };
}

// ---------- "near here" log (Phase 10) ----------
export async function logRecommendation(input: {
  tripId: string; anchorSavedPlaceId: string | null; googlePlaceId: string; categoryKey: string; action: 'shown' | 'added' | 'dismissed';
}): Promise<void> {
  const { tripId, anchorSavedPlaceId, googlePlaceId, categoryKey, action } = input ?? {};
  const supabase = await client(tripId);
  if (!supabase || (anchorSavedPlaceId !== null && !isUuid(anchorSavedPlaceId))) return;
  if (!['shown', 'added', 'dismissed'].includes(action) || typeof googlePlaceId !== 'string' || googlePlaceId.length > 300) return;
  await supabase.from('recommendation_events').insert({
    trip_id: tripId, anchor_saved_place_id: anchorSavedPlaceId, google_place_id: googlePlaceId,
    category_key: String(categoryKey).slice(0, 30), action,
  });
}

/** Fresh copy of the days and places, after bulk changes. */
export async function loadPlan(input: { tripId: string }): Promise<Result<{ days: PlanDay[]; places: MapPlace[] }>> {
  const supabase = await client(input?.tripId);
  if (!supabase) return bad();
  try {
    const [days, places] = await Promise.all([getTripPlan(supabase, input.tripId), getMapPlaces(supabase, input.tripId)]);
    return { ok: true, data: { days, places } };
  } catch {
    return fail(GENERIC_ERROR);
  }
}

// ---------- what other YallaTrip travelers wrote about a place (shown on its card) ----------
export type TravelerReview = { name: string | null; avatar: string | null; review: string | null; rating: number | null; photos: string[]; updated_at: string; mine: boolean };

export async function getPlaceReviews(input: { googlePlaceId: string }): Promise<Result<TravelerReview[]>> {
  const id = input?.googlePlaceId;
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{10,300}$/.test(id)) return bad();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('place_reviews', { p_google_place_id: id });
  if (error) return fail(GENERIC_ERROR);
  const own = `${publicEnv().supabaseUrl}/storage/v1/object/public/trip-photos/`;
  const list = (Array.isArray(data) ? data : []) as TravelerReview[];
  return { ok: true, data: list.map((r) => ({ ...r, photos: (r.photos ?? []).filter((u) => u.startsWith(own)) })) };
}
