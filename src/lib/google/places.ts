import 'server-only';
import { googleFetch } from '@/lib/google/client';
import * as F from '@/lib/google/fields';
import { mapAutocomplete, mapNearby, mapPlace, type NearbyPlace, type Place } from '@/lib/google/mappers';
import { distanceMeters } from '@/lib/geo';
import { AROUND_KINDS, type AroundKind } from '@/lib/places/around';
import { BY_POPULARITY, NEARBY_TEXT, NEARBY_TYPES } from '@/lib/categories';
import type { AutocompleteInput, DetailsInput, NearbyInput } from '@/lib/validation';

const BASE = 'https://places.googleapis.com/v1';
const LANG = 'he';

export async function autocomplete({ input, sessionToken, bias }: AutocompleteInput) {
  const raw = await googleFetch(`${BASE}/places:autocomplete`, {
    method: 'POST',
    fieldMask: F.AUTOCOMPLETE,
    body: {
      input,
      sessionToken,
      languageCode: LANG,
      ...(bias && { locationBias: { circle: { center: { latitude: bias.lat, longitude: bias.lng }, radius: 30000 } } }),
    },
  });
  return mapAutocomplete(raw);
}

export async function placeDetails({ placeId, level, sessionToken }: DetailsInput): Promise<Place | null> {
  const qs = new URLSearchParams({ languageCode: LANG });
  // The session token closes the autocomplete session, so typing + choosing bill as one.
  if (sessionToken) qs.set('sessionToken', sessionToken);
  const raw = await googleFetch(`${BASE}/places/${encodeURIComponent(placeId)}?${qs}`, {
    fieldMask: level === 'basic' ? F.DETAILS_BASIC : F.DETAILS_CARD,
    // Short cache only: Google's terms limit how long place content may be stored.
    revalidate: sessionToken ? undefined : 3600,
  });
  return mapPlace(raw);
}

export async function nearby({ center, category, radius }: NearbyInput) {
  if (category === 'kosher' || category === 'chabad') {
    const t = NEARBY_TEXT[category];
    const raw = await googleFetch(`${BASE}/places:searchText`, {
      method: 'POST',
      fieldMask: F.NEARBY,
      body: {
        textQuery: t.query, languageCode: LANG, pageSize: 10, rankPreference: 'DISTANCE',
        locationBias: { circle: { center: { latitude: center.lat, longitude: center.lng }, radius: t.radius } },
      },
    });
    return mapNearby(raw, center).filter((p) => p.distanceMeters !== null && p.distanceMeters <= t.maxMeters);
  }
  const raw = await googleFetch(`${BASE}/places:searchNearby`, {
    method: 'POST',
    fieldMask: F.NEARBY,
    body: {
      includedTypes: NEARBY_TYPES[category],
      maxResultCount: BY_POPULARITY.has(category) || NEARBY_TYPES[category].length > 2 ? 20 : 10,
      rankPreference: BY_POPULARITY.has(category) ? 'POPULARITY' : 'DISTANCE',
      languageCode: LANG,
      locationRestriction: { circle: { center: { latitude: center.lat, longitude: center.lng }, radius } },
    },
  });
  return mapNearby(raw, center);
}

/** "✨ מה יש בסביבה": one kind of place around a point, in Google's popularity order (basic fields only). */
export async function aroundPlaces(center: { lat: number; lng: number }, kind: AroundKind): Promise<NearbyPlace[]> {
  const k = AROUND_KINDS[kind];
  const raw = await googleFetch(`${BASE}/places:searchNearby`, {
    method: 'POST',
    fieldMask: F.AROUND,
    body: {
      includedTypes: k.types, maxResultCount: 20, rankPreference: 'POPULARITY', languageCode: LANG,
      locationRestriction: { circle: { center: { latitude: center.lat, longitude: center.lng }, radius: k.radius } },
    },
  });
  return ((raw as { places?: unknown[] } | null)?.places ?? []).map(mapPlace)
    .filter((p): p is Place => !!p && !!p.location)
    .map((p) => ({ ...p, distanceMeters: distanceMeters(center, p.location!) }));
}

/** Where a typed destination is ("ארגנטינה"), when no place was picked from the suggestions. */
export async function findLocation(query: string): Promise<{ lat: number; lng: number } | null> {
  const raw = (await googleFetch(`${BASE}/places:searchText`, {
    method: 'POST',
    fieldMask: 'places.location',
    body: { textQuery: query, languageCode: LANG, pageSize: 1 },
  })) as { places?: { location?: { latitude?: unknown; longitude?: unknown } }[] };
  const loc = raw.places?.[0]?.location;
  return typeof loc?.latitude === 'number' && typeof loc?.longitude === 'number' ? { lat: loc.latitude, lng: loc.longitude } : null;
}

/** Places right around a point (the traveler's own location), nearest first. */
export async function placesAround(center: { lat: number; lng: number }, radius = 80) {
  const raw = await googleFetch(`${BASE}/places:searchNearby`, {
    method: 'POST',
    fieldMask: F.NEARBY,
    body: {
      maxResultCount: 10,
      rankPreference: 'DISTANCE',
      languageCode: LANG,
      locationRestriction: { circle: { center: { latitude: center.lat, longitude: center.lng }, radius } },
    },
  });
  return mapNearby(raw, center);
}

type RawPhoto = { name?: unknown; widthPx?: unknown; heightPx?: unknown };

/** The best cover among a place's photos: the first wide (landscape) one, else the first. */
function pickCover(photos: RawPhoto[] | undefined): string | null {
  const ok = (photos ?? []).filter((p): p is RawPhoto & { name: string } => typeof p.name === 'string');
  const wide = ok.find((p) => typeof p.widthPx === 'number' && typeof p.heightPx === 'number' && p.widthPx > p.heightPx * 1.2);
  return (wide ?? ok[0])?.name ?? null;
}

/**
 * A photo of the trip's destination, for the trip card. By the chosen place when there is one,
 * otherwise by searching the destination's name. Cached for a day, so it is looked up rarely.
 */
export async function destinationPhoto(placeId: string | null, name: string): Promise<string | null> {
  if (placeId) {
    const raw = (await googleFetch(`${BASE}/places/${encodeURIComponent(placeId)}`, {
      fieldMask: 'photos', revalidate: 86400,
    })) as { photos?: RawPhoto[] };
    const p = pickCover(raw.photos);
    if (p) return p;
  }
  const raw = (await googleFetch(`${BASE}/places:searchText`, {
    method: 'POST',
    fieldMask: 'places.photos',
    body: { textQuery: name, languageCode: LANG, pageSize: 1 },
  })) as { places?: { photos?: RawPhoto[] }[] };
  return pickCover(raw.places?.[0]?.photos);
}

/** Resolves a photo to a short-lived Google image URL that does not carry our key. */
export async function photoUrl(photoName: string, maxWidthPx = 800): Promise<string | null> {
  const qs = new URLSearchParams({ maxWidthPx: String(maxWidthPx), skipHttpRedirect: 'true' });
  const raw = (await googleFetch(`${BASE}/${photoName}/media?${qs}`, { revalidate: 3600 })) as { photoUri?: unknown };
  return typeof raw.photoUri === 'string' ? raw.photoUri : null;
}

/** Places of one kind along an encoded route line (Google ranks them by how little they detour). */
export async function placesAlongRoute(encodedPolyline: string, textQuery: string, includedType?: string) {
  const raw = await googleFetch(`${BASE}/places:searchText`, {
    method: 'POST',
    fieldMask: F.NEARBY,
    body: {
      textQuery, languageCode: LANG, pageSize: 20,
      ...(includedType && { includedType }),
      searchAlongRouteParameters: { polyline: { encodedPolyline } },
    },
  });
  const list = (raw as { places?: unknown[] }).places ?? [];
  return list.map(mapPlace).filter((p): p is Place => p !== null && p.location !== null);
}


// ---------- "fill my days": the best-loved places around a destination ----------
const POPULAR_FIELDS = F.NEARBY + ',places.types';

/** Best-loved places of these types around a point (Google's popularity order). */
export async function popularAround(center: { lat: number; lng: number }, types: string[], radius: number): Promise<Place[]> {
  const raw = await googleFetch(`${BASE}/places:searchNearby`, {
    method: 'POST', fieldMask: POPULAR_FIELDS,
    body: {
      includedTypes: types, maxResultCount: 20, rankPreference: 'POPULARITY', languageCode: LANG,
      locationRestriction: { circle: { center: { latitude: center.lat, longitude: center.lng }, radius } },
    },
  });
  return ((raw as { places?: unknown[] } | null)?.places ?? []).map(mapPlace).filter((x): x is Place => !!x && !!x.location && !!x.name);
}

/** Places found by words ("romantic restaurant") near a point. */
export async function textAround(center: { lat: number; lng: number }, query: string, radius: number): Promise<Place[]> {
  const raw = await googleFetch(`${BASE}/places:searchText`, {
    method: 'POST', fieldMask: POPULAR_FIELDS,
    body: { textQuery: query, languageCode: LANG, pageSize: 20, locationBias: { circle: { center: { latitude: center.lat, longitude: center.lng }, radius } } },
  });
  return ((raw as { places?: unknown[] } | null)?.places ?? []).map(mapPlace).filter((x): x is Place => !!x && !!x.location && !!x.name);
}

/** A text search with no area around it (the query names the place, e.g. a whole country). */
export async function textAnywhere(query: string): Promise<Place[]> {
  const raw = await googleFetch(`${BASE}/places:searchText`, {
    method: 'POST', fieldMask: POPULAR_FIELDS,
    body: { textQuery: query, languageCode: LANG, pageSize: 20 },
  });
  return ((raw as { places?: unknown[] } | null)?.places ?? []).map(mapPlace).filter((x): x is Place => !!x && !!x.location && !!x.name);
}

/** A place's English name ("ארגנטינה" → "Argentina"): searches about it in English find much more. */
export async function englishName(query: string): Promise<string | null> {
  const raw = (await googleFetch(`${BASE}/places:searchText`, {
    method: 'POST',
    fieldMask: 'places.displayName',
    body: { textQuery: query, languageCode: 'en', pageSize: 1 },
  })) as { places?: { displayName?: { text?: unknown } }[] };
  const t = raw.places?.[0]?.displayName?.text;
  return typeof t === 'string' && t.trim() ? t.trim() : null;
}
