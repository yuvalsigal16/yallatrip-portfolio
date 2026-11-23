export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_M = 6_371_000;

/** Straight-line distance in meters between two points (haversine formula). */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h)));
}

/** "450 מ׳" under 1 km, "1.4 ק״מ" above. */
export function formatDistanceHe(meters: number): string {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} מ׳`;
  return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} ק״מ`;
}

export function isLatLng(v: unknown): v is LatLng {
  if (typeof v !== 'object' || v === null) return false;
  const { lat, lng } = v as Record<string, unknown>;
  return (
    typeof lat === 'number' && Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
    typeof lng === 'number' && Number.isFinite(lng) && lng >= -180 && lng <= 180
  );
}
