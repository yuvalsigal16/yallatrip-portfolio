'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { consumePlaceLookup, consumeQuota } from '@/lib/api/guard';
import { findLocation, placeDetails } from '@/lib/google/places';
import { GENERIC_ERROR } from '@/lib/auth/errors';
import { parseYesNo, type FormState } from '@/lib/auth/rules';
import { legsFromJson, parseDate, parseTripForm, toDateString, tripLengthDays, type TripFields, type TripInput } from '@/lib/trips/rules';
import { isUuid } from '@/lib/validation';
import { removeTripFiles } from '@/lib/trips/files';
import { datesFromNights } from '@/lib/trips/chapters';
import { isPace } from '@/lib/planning/pace';

const text = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' ? v : '';
};

function readTripFields(fd: FormData): TripFields {
  return {
    title: fd.get('title'),
    destinationName: fd.get('destinationName'),
    placeId: fd.get('placeId'),
    sessionToken: fd.get('sessionToken'),
    startDate: fd.get('startDate'),
    endDate: fd.get('endDate'),
    noDates: fd.get('noDates'),
    travelers: fd.get('travelers'),
    transport: fd.getAll('transport'),
    styles: fd.getAll('styles'),
    budget: fd.get('budget'),
    legName: fd.getAll('destinationName'),
    legStart: fd.getAll('legStart'),
    legEnd: fd.getAll('legEnd'),
  };
}

/** Values to put back into the form after an error (text fields only). */
function echo(fd: FormData): Record<string, string> {
  // React resets a form after its action runs, so everything the user chose is sent back.
  const keys = ['title', 'destinationName', 'placeId', 'startDate', 'endDate', 'travelers', 'budget', 'noDates', 'shabbat', 'kosher'];
  return {
    ...Object.fromEntries(keys.map((k) => [k, text(fd, k)])),
    styles: fd.getAll('styles').join(','),
    transport: fd.getAll('transport').join(','),
    legs: JSON.stringify(fd.getAll('destinationName').map((n, i) => ({
      name: String(n), start: String(fd.getAll('legStart')[i] ?? ''), end: String(fd.getAll('legEnd')[i] ?? ''),
    }))),
    echoed: '1',
  };
}

async function signedIn(supabase: SupabaseClient) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login?next=/trips');
  return data.user;
}

/**
 * The browser tells us which Google place was chosen, but we look it up
 * ourselves to get its location: coordinates from the browser are never trusted.
 * If Google is unavailable the trip is still created, just without a map center.
 */
async function resolveDestination(supabase: SupabaseClient, input: TripInput) {
  if (!input.placeId) {
    // Typed without choosing from the list: still find it, so the trip has a map center.
    try {
      await consumeQuota(supabase, 'details');
      const loc = await findLocation(input.destinationName);
      if (loc) return { placeId: null, lat: loc.lat, lng: loc.lng };
    } catch (e) {
      console.warn('[resolveDestination:text]', e instanceof Error ? e.message : e);
    }
    return { placeId: null, lat: null, lng: null };
  }
  try {
    await consumeQuota(supabase, 'details');
    await consumePlaceLookup(supabase);
    const place = await placeDetails({ placeId: input.placeId, level: 'basic', sessionToken: input.sessionToken ?? undefined });
    if (place?.location) return { placeId: place.googlePlaceId, lat: place.location.lat, lng: place.location.lng };
  } catch (e) {
    console.warn('[resolveDestination]', e instanceof Error ? e.message : e);
  }
  return { placeId: null, lat: null, lng: null };
}

// ---------- create ----------
/** A traveller who keeps Shabbat (from the opening questions or the profile): every new trip starts with it on. */
/** Kosher is the traveller's own answer (it shapes every place card), so a trip form's answer goes to the profile. */
async function saveKosher(supabase: SupabaseClient, fd: FormData) {
  const kosher = parseYesNo(fd.get('kosher'));
  if (kosher === null) return;
  const { error } = await supabase.rpc('complete_onboarding', { p_keeps_kosher: kosher });
  if (error) console.error('[saveKosher]', error.message);
}

async function keepsShabbat(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase.from('user_preferences').select('keeps_shabbat').eq('user_id', userId).maybeSingle();
  return (data as { keeps_shabbat?: boolean } | null)?.keeps_shabbat === true;
}

export async function createTrip(_prev: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient();
  const user = await signedIn(supabase);

  const parsed = parseTripForm(readTripFields(fd));
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, values: echo(fd) };
  const t = parsed.value;
  const dest = await resolveDestination(supabase, t);

  const { data, error } = await supabase
    .from('trips')
    .insert({
      owner_id: user.id,
      title: t.title,
      destination_name: t.destinationName,
      destination_place_id: dest.placeId,
      center_lat: dest.lat,
      center_lng: dest.lng,
      start_date: t.startDate,
      end_date: t.endDate,
      travelers_count: t.travelers,
      transport_modes: t.transport,
      travel_styles: t.styles,
      budget_level: t.budget,
      keeps_shabbat: await keepsShabbat(supabase, user.id),
      destinations: t.legs,
    })
    .select('id')
    .single();
  if (error || !data) {
    console.error('[createTrip]', error?.message);
    return { error: GENERIC_ERROR, values: echo(fd) };
  }
  revalidatePath('/trips');
  redirect(`/trips/${(data as unknown as { id: string }).id}?created=1`);
}

// ---------- create, the one-screen way ----------
const WHO: Record<string, { travelers: number; kids: boolean }> = {
  solo: { travelers: 1, kids: false }, couple: { travelers: 2, kids: false },
  friends: { travelers: 4, kids: false }, family: { travelers: 4, kids: true },
};

/**
 * The new-trip screen: one place or a route of several (no dates per place: the nights come split,
 * legNights), dates, who is going and the pace. Each place is looked up on the map, so the trip
 * screen can show it and fill its days.
 */
export async function createQuickTrip(_prev: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient();
  const user = await signedIn(supabase);

  const names = fd.getAll('destinationName').map((v) => String(v).trim());
  const placeIds = fd.getAll('placeId').map(String);
  const tokens = fd.getAll('sessionToken').map(String);
  const rows = names.map((name, i) => ({ name, placeId: placeIds[i] ?? '', token: tokens[i] ?? '' })).filter((r) => r.name);
  const noDates = !!fd.get('noDates');
  const start = text(fd, 'startDate'), end = text(fd, 'endDate');

  // Several places with dates: their dates come from the nights per place.
  let legStart: string[] = [], legEnd: string[] = [];
  if (rows.length > 1 && !noDates && parseDate(start) && parseDate(end)) {
    const total = (tripLengthDays(start, end) ?? 1) - 1;
    const nights = fd.getAll('legNights').map((v) => Number(v));
    const ok = nights.length === rows.length && nights.every((n) => Number.isInteger(n) && n >= 1) && nights.reduce((a, b) => a + b, 0) === total;
    if (!ok) return { fieldErrors: { legs: total < rows.length ? 'יש יותר עצירות מלילות בטיול' : 'חלוקת הלילות לא מסתדרת עם התאריכים' } };
    const d = datesFromNights(start, nights);
    legStart = d.map((x) => x.start);
    legEnd = d.map((x) => x.end);
  }
  const who = WHO[text(fd, 'who')] ?? WHO.couple!;
  const parsed = parseTripForm({
    destinationName: rows[0]?.name ?? '', placeId: rows[0]?.placeId, sessionToken: rows[0]?.token,
    startDate: start, endDate: end, noDates: noDates ? 'on' : undefined,
    travelers: String(who.travelers), transport: fd.getAll('transport'), styles: fd.getAll('styles'),
    legName: rows.map((r) => r.name), legStart, legEnd,
  });
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };
  const t = parsed.value;

  // Where each place is (one look-up per place, cheap): the first one is also the trip's centre.
  const where = await Promise.all(rows.map((r) => resolveDestination(supabase, {
    ...t, destinationName: r.name, placeId: r.placeId || null, sessionToken: r.token || null,
  })));
  const legs = t.legs.map((l, i) => ({
    ...l, ...(where[i]?.lat != null && where[i]?.lng != null ? { lat: where[i]!.lat, lng: where[i]!.lng } : {}),
    ...(where[i]?.placeId ? { placeId: where[i]!.placeId } : {}),
  }));
  const pace = text(fd, 'pace');
  const { data, error } = await supabase
    .from('trips')
    .insert({
      owner_id: user.id,
      title: t.title,
      destination_name: t.destinationName,
      destination_place_id: where[0]?.placeId ?? null,
      center_lat: where[0]?.lat ?? null,
      center_lng: where[0]?.lng ?? null,
      start_date: t.startDate,
      end_date: t.endDate,
      travelers_count: t.travelers,
      transport_modes: t.transport,
      travel_styles: t.styles,
      budget_level: t.budget,
      keeps_shabbat: parseYesNo(fd.get('shabbat')) ?? await keepsShabbat(supabase, user.id),
      destinations: legs,
      with_kids: who.kids,
      pace: isPace(pace) ? pace : null,
    })
    .select('id')
    .single();
  if (error || !data) {
    console.error('[createQuickTrip]', error?.message);
    return { error: GENERIC_ERROR };
  }
  await saveKosher(supabase, fd);
  revalidatePath('/trips');
  redirect(`/trips/${(data as unknown as { id: string }).id}?created=1`);
}

// ---------- edit ----------
export async function updateTrip(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = text(fd, 'tripId');
  if (!isUuid(id)) return { error: GENERIC_ERROR };
  const supabase = await createClient();
  await signedIn(supabase);

  const parsed = parseTripForm(readTripFields(fd));
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, values: echo(fd) };
  const t = parsed.value;

  const { data: current } = await supabase
    .from('trips')
    .select('start_date, end_date, destination_name, destination_place_id, center_lat, center_lng, destinations')
    .eq('id', id)
    .maybeSingle();
  if (!current) return { error: 'הטיול לא נמצא' };
  const cur = current as { start_date: string | null; end_date: string | null; destination_name: string; destination_place_id: string | null; center_lat: number | null; center_lng: number | null };

  // Shortening the trip unschedules stops on the removed days: ask first.
  // (Checked against the days that exist, so it also covers dates that were removed and re-added.)
  if (t.startDate && t.endDate && fd.get('confirmShrink') !== '1') {
    const newLength = tripLengthDays(t.startDate, t.endDate)!;
    const { data: stops } = await supabase.rpc('count_stops_after_day', { p_trip_id: id, p_last_day: newLength });
    const n = typeof stops === 'number' ? stops : 0;
    if (n > 0) {
      return {
        warning: `בתאריכים החדשים הטיול יהיה באורך ${newLength} ימים. ${n === 1 ? 'מקום אחד שמשובץ' : `${n} מקומות שמשובצים`} בימים שאחרי ${n === 1 ? 'יחזור' : 'יחזרו'} לרשימת "לא משובצים" (הם לא יימחקו). לשמור בכל זאת?`,
        values: { ...echo(fd), confirmShrink: '1' },
      };
    }
  }

  // New place picked, or the name retyped -> look it up again (a typed name is found by text).
  // Same place but still no map center (an older trip) -> try again as well.
  const pickedNewPlace = t.placeId !== null && t.placeId !== cur.destination_place_id;
  const renamedOnly = t.placeId === null && t.destinationName !== cur.destination_name;
  const noCenter = cur.center_lat === null || cur.center_lng === null;
  const dest = pickedNewPlace || renamedOnly || noCenter
    ? await resolveDestination(supabase, t)
    : { placeId: cur.destination_place_id, lat: cur.center_lat, lng: cur.center_lng };

  const { error } = await supabase
    .from('trips')
    .update({
      title: t.title,
      destination_name: t.destinationName,
      destination_place_id: dest.placeId,
      center_lat: dest.lat,
      center_lng: dest.lng,
      start_date: t.startDate,
      end_date: t.endDate,
      travelers_count: t.travelers,
      transport_modes: t.transport,
      travel_styles: t.styles,
      ...(parseYesNo(fd.get('shabbat')) !== null ? { keeps_shabbat: parseYesNo(fd.get('shabbat')) } : {}),
      // Keep where each place is (by name), so the trip screen still knows it.
      destinations: t.legs.map((l) => {
        const was = legsFromJson((current as { destinations?: unknown } | null)?.destinations).find((x) => x.name === l.name);
        return was?.lat != null ? { ...l, lat: was.lat, lng: was.lng, ...(was.placeId ? { placeId: was.placeId } : {}) } : l;
      }),
    })
    .eq('id', id);
  if (error) {
    console.error('[updateTrip]', error.message);
    return { error: GENERIC_ERROR, values: echo(fd) };
  }
  await saveKosher(supabase, fd);
  revalidatePath('/trips');
  revalidatePath(`/trips/${id}`);
  redirect(`/trips/${id}?saved=1`);
}

// ---------- delete ----------
export async function deleteTrip(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = text(fd, 'tripId');
  if (!isUuid(id)) return { error: GENERIC_ERROR };
  if (fd.get('confirm') !== 'on') return { fieldErrors: { confirm: 'צריך לסמן שבאמת רוצים למחוק' } };

  const supabase = await createClient();
  const user = await signedIn(supabase);
  // Only the owner may delete; their photos go first, while they still have access to the trip.
  const { data: mine } = await supabase.from('trips').select('id').eq('id', id).eq('owner_id', user.id).maybeSingle();
  if (mine) await removeTripFiles(supabase, id);
  const { data, error } = await supabase.from('trips').delete().eq('id', id).select('id');
  if (error || !Array.isArray(data) || data.length === 0) {
    console.error('[deleteTrip]', error?.message ?? 'nothing deleted');
    return { error: GENERIC_ERROR };
  }
  revalidatePath('/trips');
  redirect('/trips?deleted=1');
}

/**
 * Makes a copy of a trip for the signed-in user (owner or partner): places, days, stops and notes.
 * People, chat, album and reviews stay with the original. A new start date moves every date by the same amount.
 */
export async function duplicateTrip(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = text(fd, 'tripId');
  if (!isUuid(id)) return { error: GENERIC_ERROR };
  const title = text(fd, 'title').trim().slice(0, 120);
  const startRaw = text(fd, 'startDate').trim();
  const start = startRaw ? parseDate(startRaw) : null;
  if (startRaw && !start) return { fieldErrors: { startDate: 'תאריך לא תקין' }, values: { title, startDate: startRaw } };

  const supabase = await createClient();
  await signedIn(supabase);
  const { data, error } = await supabase.rpc('duplicate_trip', {
    p_trip: id,
    p_title: title || null,
    p_start: start ? toDateString(start) : null,
  });
  if (error || typeof data !== 'string') {
    console.error('[duplicateTrip]', error?.message ?? 'no id');
    return { error: 'לא הצלחנו לשכפל את הטיול. נסו שוב.', values: { title, startDate: startRaw } };
  }
  revalidatePath('/trips');
  redirect(`/trips/${data}?copied=1`);
}
