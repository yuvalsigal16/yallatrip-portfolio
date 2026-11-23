import 'server-only';
import { googleFetch } from '@/lib/google/client';
import { DAY_ROUTE, ROUTE_MATRIX } from '@/lib/google/fields';
import { mapComputeRoutes, mapMatrix, type DayLeg, type DayRoute } from '@/lib/google/mappers';
import { distanceMeters, type LatLng } from '@/lib/geo';
import type { DayRouteInput, MatrixInput, TravelMode } from '@/lib/validation';

const MODE: Record<TravelMode, string> = { walk: 'WALK', transit: 'TRANSIT', drive: 'DRIVE' };

const waypoint = (p: LatLng) => ({ waypoint: { location: { latLng: { latitude: p.lat, longitude: p.lng } } } });

/** Travel time and distance between every origin and every destination. */
export async function routeMatrix({ origins, destinations, mode }: MatrixInput) {
  const raw = await googleFetch('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', {
    method: 'POST',
    fieldMask: ROUTE_MATRIX,
    body: {
      origins: origins.map(waypoint),
      destinations: destinations.map(waypoint),
      travelMode: MODE[mode],
      languageCode: 'he',
      // Traffic-aware routing costs more; plain estimates are enough for planning.
      ...(mode === 'drive' && { routingPreference: 'TRAFFIC_UNAWARE' }),
    },
  });
  return mapMatrix(raw);
}

/**
 * Travel time between consecutive stops of a day, plus each leg's real route to draw on the map.
 * Driving: one computeRoutes call with the stops as waypoints; a leg with no sensible road (inside a
 * canyon, a park, an old town) is replaced by a real walking route. Short drives also get the
 * walking time, so people can decide. Transit: one small matrix call per leg (no line).
 */
export async function dayRoute({ points, mode }: DayRouteInput): Promise<DayRoute> {
  if (mode === 'transit') {
    const legs = await Promise.all(
      points.slice(0, -1).map(async (p, i) => {
        const [el] = await routeMatrix({ origins: [p], destinations: [points[i + 1]!], mode });
        return { durationSec: el?.durationSec ?? null, distanceMeters: el?.distanceMeters ?? null, mode };
      }),
    );
    return { legs, polyline: null };
  }
  const route = await computeRoute(points, mode);
  const legs = route?.legs ?? points.slice(0, -1).map(() => ({ durationSec: null, distanceMeters: null }));
  const out = await Promise.all(legs.map(async (leg, i): Promise<DayLeg> => {
    const a = points[i]!;
    const b = points[i + 1]!;
    if (mode === 'walk') return { ...leg, mode };
    if (isSensible(leg.distanceMeters, a, b)) {
      // A short drive: is it worth walking instead?
      if (distanceMeters(a, b) > 3000) return { ...leg, mode };
      const walk = await computeRoute([a, b], 'walk').catch(() => null);
      return { ...leg, mode, walkSec: walk?.legs[0]?.durationSec ?? null };
    }
    const walk = await computeRoute([a, b], 'walk').catch(() => null);
    const w = walk?.legs[0];
    if (w && isSensible(w.distanceMeters, a, b)) return { ...w, mode: 'walk' };
    return { durationSec: null, distanceMeters: null, polyline: null };
  }));
  return { legs: out, polyline: null };
}

async function computeRoute(points: LatLng[], mode: 'walk' | 'drive'): Promise<DayRoute | null> {
  const loc = (p: LatLng) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });
  const raw = await googleFetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    fieldMask: DAY_ROUTE,
    body: {
      origin: loc(points[0]!),
      destination: loc(points[points.length - 1]!),
      intermediates: points.slice(1, -1).map(loc),
      travelMode: MODE[mode],
      languageCode: 'he',
      polylineQuality: 'OVERVIEW',
      ...(mode === 'drive' && { routingPreference: 'TRAFFIC_UNAWARE' }),
    },
  });
  return mapComputeRoutes(raw);
}

/** A route no more than ~3x the straight-line distance (plus slack for short hops). */
function isSensible(meters: number | null, a: LatLng, b: LatLng): boolean {
  return meters !== null && meters <= 3 * distanceMeters(a, b) + 3000;
}

/**
 * The whole day's route as one encoded line (for "stops along the way").
 * Public transport has no single road line, so it uses the driving route as the corridor.
 */
export async function routeLine(points: LatLng[], mode: TravelMode): Promise<string | null> {
  const loc = (p: LatLng) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });
  const raw = (await googleFetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    fieldMask: 'routes.polyline.encodedPolyline',
    body: {
      origin: loc(points[0]!),
      destination: loc(points[points.length - 1]!),
      intermediates: points.slice(1, -1).map(loc),
      travelMode: mode === 'walk' ? 'WALK' : 'DRIVE',
      polylineQuality: 'OVERVIEW',
      ...(mode !== 'walk' && { routingPreference: 'TRAFFIC_UNAWARE' }),
    },
  })) as { routes?: { polyline?: { encodedPolyline?: string } }[] };
  return raw.routes?.[0]?.polyline?.encodedPolyline ?? null;
}
