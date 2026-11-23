import type { LatLng } from '@/lib/geo';

// "Stops along the way": how far a place is from the day's route, where along it, and between which stops.

const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Local flat projection (metres) around a latitude; plenty accurate for a few kilometres. */
function project(p: LatLng, lat0: number) {
  return { x: rad(p.lng) * R * Math.cos(rad(lat0)), y: rad(p.lat) * R };
}

/** Distance from p to segment a-b (metres), and where along the segment (0..1) it is closest. */
function toSegment(p: LatLng, a: LatLng, b: LatLng) {
  const P = project(p, p.lat), A = project(a, p.lat), B = project(b, p.lat);
  const dx = B.x - A.x, dy = B.y - A.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((P.x - A.x) * dx + (P.y - A.y) * dy) / len2)) : 0;
  const x = A.x + t * dx - P.x, y = A.y + t * dy - P.y;
  return { meters: Math.sqrt(x * x + y * y), t };
}

/**
 * meters: distance from the route line; progress: 0..1 along the line (for ordering);
 * after: index of the day's point the place comes right after (-1 = before the first).
 */
export function offRoute(line: LatLng[], stops: LatLng[], p: LatLng): { meters: number; progress: number; after: number } {
  let best = { meters: Infinity, progress: 0 };
  for (let i = 0; i < line.length - 1; i++) {
    const s = toSegment(p, line[i]!, line[i + 1]!);
    if (s.meters < best.meters) best = { meters: s.meters, progress: (i + s.t) / Math.max(1, line.length - 1) };
  }
  // Between which consecutive stops: the pair where going through p costs the least extra distance.
  let after = stops.length - 2;
  let bestExtra = Infinity;
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]!, b = stops[i + 1]!;
    const extra = flat(a, p) + flat(p, b) - flat(a, b);
    if (extra < bestExtra) { bestExtra = extra; after = i; }
  }
  return { ...best, after };
}

function flat(a: LatLng, b: LatLng) {
  const A = project(a, a.lat), B = project(b, a.lat);
  return Math.hypot(A.x - B.x, A.y - B.y);
}
