// Server-side validation of everything the browser sends.
// Each parser returns either { ok: true, value } or { ok: false, error } in Hebrew.

import { isLatLng, type LatLng } from '@/lib/geo';
import { isNearbyCategory, type NearbyCategory } from '@/lib/categories';
import { isAroundKind, type AroundKind } from '@/lib/places/around';

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T>(value: T): Parsed<T> => ({ ok: true, value });
const fail = <T>(error: string): Parsed<T> => ({ ok: false, error });

const obj = (v: unknown): Record<string, unknown> | null =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

export function isGooglePlaceId(v: unknown): v is string {
  return typeof v === 'string' && /^[A-Za-z0-9_-]{10,300}$/.test(v);
}

export function isSessionToken(v: unknown): v is string {
  return typeof v === 'string' && /^[A-Za-z0-9-]{8,100}$/.test(v);
}

// ---------- autocomplete ----------
export type AutocompleteInput = { input: string; sessionToken: string; bias?: LatLng };

export function parseAutocomplete(body: unknown): Parsed<AutocompleteInput> {
  const b = obj(body);
  if (!b) return fail('בקשה לא תקינה');
  const input = typeof b.input === 'string' ? b.input.trim() : '';
  if (input.length < 1 || input.length > 120) return fail('טקסט החיפוש צריך להיות באורך 1–120 תווים');
  if (!isSessionToken(b.sessionToken)) return fail('חסר מזהה סשן לחיפוש');
  if (b.bias !== undefined && !isLatLng(b.bias)) return fail('מיקום לא תקין');
  return ok({ input, sessionToken: b.sessionToken, bias: b.bias as LatLng | undefined });
}

// ---------- place details ----------
export type DetailLevel = 'basic' | 'card';
export type DetailsInput = { placeId: string; level: DetailLevel; sessionToken?: string };

export function parseDetails(placeId: unknown, level: unknown, sessionToken: unknown): Parsed<DetailsInput> {
  if (!isGooglePlaceId(placeId)) return fail('מזהה מקום לא תקין');
  const lv = level ?? 'card';
  if (lv !== 'basic' && lv !== 'card') return fail('רמת פירוט לא תקינה');
  if (sessionToken != null && !isSessionToken(sessionToken)) return fail('מזהה סשן לא תקין');
  return ok({ placeId, level: lv, sessionToken: (sessionToken as string | null) ?? undefined });
}

// ---------- nearby ----------
export type NearbyInput = { center: LatLng; category: NearbyCategory; radius: number };

export type AroundInput = { center: LatLng; kind: AroundKind };

export function parseAround(body: unknown): Parsed<AroundInput> {
  const b = obj(body);
  if (!b) return fail('בקשה לא תקינה');
  const center = { lat: b.lat, lng: b.lng };
  if (!isLatLng(center)) return fail('מיקום לא תקין');
  if (!isAroundKind(b.kind)) return fail('קטגוריה לא מוכרת');
  return ok({ center, kind: b.kind });
}

export function parseNearby(body: unknown): Parsed<NearbyInput> {
  const b = obj(body);
  if (!b) return fail('בקשה לא תקינה');
  const center = { lat: b.lat, lng: b.lng };
  if (!isLatLng(center)) return fail('מיקום לא תקין');
  if (!isNearbyCategory(b.category)) return fail('קטגוריה לא מוכרת');
  const radius = b.radius ?? 500;
  if (typeof radius !== 'number' || !Number.isInteger(radius) || radius < 100 || radius > 2000) {
    return fail('רדיוס צריך להיות בין 100 ל-2,000 מטר');
  }
  return ok({ center, category: b.category, radius });
}

// ---------- route matrix ----------
export type TravelMode = 'walk' | 'transit' | 'drive';
export type MatrixInput = { origins: LatLng[]; destinations: LatLng[]; mode: TravelMode };

export const MATRIX_MAX_POINTS = 10;
export const MATRIX_MAX_ELEMENTS = 100;

export function parseMatrix(body: unknown): Parsed<MatrixInput> {
  const b = obj(body);
  if (!b) return fail('בקשה לא תקינה');
  const { origins, destinations, mode } = b;
  const validList = (l: unknown): l is LatLng[] =>
    Array.isArray(l) && l.length >= 1 && l.length <= MATRIX_MAX_POINTS && l.every(isLatLng);
  if (!validList(origins) || !validList(destinations)) {
    return fail(`צריך בין 1 ל-${MATRIX_MAX_POINTS} נקודות מוצא ויעד`);
  }
  if (origins.length * destinations.length > MATRIX_MAX_ELEMENTS) return fail('יותר מדי צירופים בבקשה אחת');
  if (mode !== 'walk' && mode !== 'transit' && mode !== 'drive') return fail('אמצעי תחבורה לא מוכר');
  return ok({ origins, destinations, mode });
}

// ---------- photo ----------
export function isPhotoName(v: unknown): v is string {
  // Google photo resource names look like "places/<placeId>/photos/<photoId>"
  return typeof v === 'string' && v.length <= 1000 && /^places\/[A-Za-z0-9_-]{10,300}\/photos\/[A-Za-z0-9_-]{10,800}$/.test(v);
}

// ---------- ids ----------
export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

// ---------- a day's route ----------
export type DayRouteInput = { points: LatLng[]; mode: TravelMode };
export const DAY_ROUTE_MAX_POINTS = 27; // Google: origin + destination + 25 waypoints

export function parseDayRoute(body: unknown): Parsed<DayRouteInput> {
  const b = obj(body);
  if (!b) return fail('בקשה לא תקינה');
  const { points, mode } = b;
  if (!Array.isArray(points) || points.length < 2 || points.length > DAY_ROUTE_MAX_POINTS || !points.every(isLatLng)) {
    return fail(`צריך בין 2 ל-${DAY_ROUTE_MAX_POINTS} תחנות`);
  }
  if (mode !== 'walk' && mode !== 'transit' && mode !== 'drive') return fail('אמצעי תחבורה לא מוכר');
  if (mode === 'transit' && points.length > 13) return fail('בתחבורה ציבורית אפשר עד 13 תחנות ביום');
  return ok({ points, mode });
}

// ---------- times ----------
export function isTimeHHMM(v: unknown): v is string {
  return typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}
