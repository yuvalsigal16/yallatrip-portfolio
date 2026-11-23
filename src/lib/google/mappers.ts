// Turns Google's raw responses into YallaTrip's shapes.
// Rule: never invent data. A field Google did not return becomes null,
// and the UI shows "אין מידע" for it.

import { distanceMeters, type LatLng } from '@/lib/geo';

type Json = Record<string, unknown>;
const asObj = (v: unknown): Json => (typeof v === 'object' && v !== null ? (v as Json) : {});
const asArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const text = (v: unknown): string | null => str(asObj(v).text);

// ---------- autocomplete ----------
export type Suggestion = { placeId: string; mainText: string; secondaryText: string | null; types: string[] };

export function mapAutocomplete(raw: unknown): Suggestion[] {
  const out: Suggestion[] = [];
  for (const s of asArr(asObj(raw).suggestions)) {
    const p = asObj(asObj(s).placePrediction);
    const placeId = str(p.placeId);
    const fmt = asObj(p.structuredFormat);
    const mainText = text(fmt.mainText) ?? text(p.text);
    if (!placeId || !mainText) continue;
    out.push({
      placeId,
      mainText,
      secondaryText: text(fmt.secondaryText),
      types: asArr(p.types).filter((t): t is string => typeof t === 'string'),
    });
  }
  return out;
}

// ---------- place ----------
export type PhotoRef = { name: string; attributions: { displayName: string; uri: string | null }[] };

export type Place = {
  googlePlaceId: string;
  name: string | null;
  address: string | null;
  location: LatLng | null;
  primaryType: string | null;
  rating: number | null;
  ratingCount: number | null;
  openNow: boolean | null;
  weeklyHours: string[] | null;
  /** Weekdays it opens at all (0 = Sunday), from Google's regular hours; null when Google has no hours. */
  openDays?: number[] | null;
  googleMapsUrl: string | null;
  photo: PhotoRef | null;
  /** Official website (often where tickets are sold). Card level only. */
  website?: string | null;
  /** Price range Google knows for the place ("€10–20"), when it has one. Card level only. */
  priceRange?: { start: number | null; end: number | null; currency: string } | null;
  types?: string[];
};

function money(v: unknown): { amount: number; currency: string } | null {
  const m = asObj(v);
  const currency = str(m.currencyCode);
  if (!currency) return null;
  const units = Number(m.units ?? 0);
  const amount = (Number.isFinite(units) ? units : 0) + (num(m.nanos) ?? 0) / 1e9;
  return { amount, currency };
}

function mapLocation(v: unknown): LatLng | null {
  const l = asObj(v);
  const lat = num(l.latitude);
  const lng = num(l.longitude);
  return lat === null || lng === null ? null : { lat, lng };
}

export function mapPlace(raw: unknown): Place | null {
  const p = asObj(raw);
  const id = str(p.id);
  if (!id) return null;
  const hours = asObj(p.currentOpeningHours ?? p.regularOpeningHours);
  const weekly = asArr(asObj(p.regularOpeningHours).weekdayDescriptions).filter(
    (d): d is string => typeof d === 'string',
  );
  const firstPhoto = asObj(asArr(p.photos)[0]);
  const photoName = str(firstPhoto.name);
  return {
    googlePlaceId: id,
    name: text(p.displayName),
    address: str(p.formattedAddress),
    location: mapLocation(p.location),
    primaryType: str(p.primaryType),
    rating: num(p.rating),
    ratingCount: num(p.userRatingCount),
    openNow: typeof hours.openNow === 'boolean' ? hours.openNow : null,
    weeklyHours: weekly.length ? weekly : null,
    openDays: (() => {
      const periods = asArr(asObj(p.regularOpeningHours).periods).map(asObj);
      if (!periods.length) return null;
      // open around the clock: one period that opens and never closes
      if (periods.length === 1 && !periods[0]!.close) return [0, 1, 2, 3, 4, 5, 6];
      const set = new Set<number>();
      for (const per of periods) { const d = num(asObj(per.open).day); if (d !== null && d >= 0 && d <= 6) set.add(d); }
      return set.size ? [...set].sort() : null;
    })(),
    googleMapsUrl: str(p.googleMapsUri),
    website: str(p.websiteUri),
    priceRange: (() => {
      const r = asObj(p.priceRange);
      const s = money(r.startPrice), e = money(r.endPrice);
      if (!s && !e) return null;
      return { start: s?.amount ?? null, end: e?.amount ?? null, currency: (s ?? e)!.currency };
    })(),
    types: asArr(p.types).filter((t): t is string => typeof t === 'string'),
    photo: photoName
      ? {
          name: photoName,
          attributions: asArr(firstPhoto.authorAttributions).map((a) => ({
            displayName: str(asObj(a).displayName) ?? '',
            uri: str(asObj(a).uri),
          })),
        }
      : null,
  };
}

// ---------- nearby ----------
export type NearbyPlace = Place & { distanceMeters: number | null };

export function mapNearby(raw: unknown, center: LatLng): NearbyPlace[] {
  return asArr(asObj(raw).places)
    .map(mapPlace)
    .filter((p): p is Place => p !== null)
    .map((p) => ({ ...p, distanceMeters: p.location ? distanceMeters(center, p.location) : null }))
    .sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity));
}

// ---------- route matrix ----------
export type MatrixElement = {
  origin: number;
  destination: number;
  durationSec: number | null;
  distanceMeters: number | null;
  found: boolean;
};

/** Google returns durations as strings like "754s". */
export function parseDuration(v: unknown): number | null {
  if (typeof v !== 'string') return null;
  const m = /^(\d+(?:\.\d+)?)s$/.exec(v);
  return m ? Math.round(Number(m[1])) : null;
}

export function mapMatrix(raw: unknown): MatrixElement[] {
  return asArr(raw)
    .map((e) => {
      const el = asObj(e);
      const found = el.condition === 'ROUTE_EXISTS';
      return {
        origin: num(el.originIndex) ?? 0,
        destination: num(el.destinationIndex) ?? 0,
        durationSec: found ? parseDuration(el.duration) : null,
        distanceMeters: found ? num(el.distanceMeters) : null,
        found,
      };
    })
    .sort((a, b) => a.origin - b.origin || a.destination - b.destination);
}

// ---------- a day's route (computeRoutes) ----------
export type DayLeg = {
  durationSec: number | null;
  distanceMeters: number | null;
  /** How this leg is travelled (a drive with no road becomes a walk). */
  mode?: 'walk' | 'transit' | 'drive';
  /** The real route to draw on the map (encoded), when Google has one. */
  polyline?: string | null;
  /** For short drives: the walking time too, so people can choose. */
  walkSec?: number | null;
};
export type DayRoute = { legs: DayLeg[]; polyline: string | null };

export function mapComputeRoutes(raw: unknown): DayRoute | null {
  const route = asObj(asArr(asObj(raw).routes)[0]);
  const legs = asArr(route.legs);
  if (!legs.length) return null;
  return {
    legs: legs.map((l) => ({
      durationSec: parseDuration(asObj(l).duration),
      distanceMeters: num(asObj(l).distanceMeters),
      polyline: str(asObj(asObj(l).polyline).encodedPolyline),
    })),
    polyline: null,
  };
}
