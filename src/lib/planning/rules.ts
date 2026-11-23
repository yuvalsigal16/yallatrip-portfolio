// Pure planning logic: filtering saved places, ordering a day, timing a day,
// splitting places into days, and decoding route lines. No framework imports: unit-tested.

import { distanceMeters, type LatLng } from '@/lib/geo';

// ---------- "What I saved": filter + search ----------
export type Filterable = { label: string; note: string | null; categoryKey: string | null; isMust: boolean; status: string };
export type SavedFilter = { category: string | 'all'; status: 'all' | 'saved' | 'planned' | 'visited'; q: string };

/** Hebrew-friendly normalisation: lower-case, no niqqud, final letters folded, no punctuation. */
export function normalizeHe(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[֑-ׇ]/g, '') // niqqud and cantillation
    .replace(/[ךםןףץ]/g, (c) => ({ ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' })[c] ?? c)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function filterSaved<T extends Filterable>(items: T[], f: SavedFilter): T[] {
  const q = normalizeHe(f.q);
  return items.filter((p) => {
    if (f.category === 'must' ? !p.isMust && p.categoryKey !== 'must' : f.category !== 'all' && p.categoryKey !== f.category) return false;
    if (f.status !== 'all' && p.status !== f.status) return false;
    if (q && !normalizeHe(`${p.label} ${p.note ?? ''}`).includes(q)) return false;
    return true;
  });
}

// ---------- ordering a day ----------
export type Pt = LatLng & { id: string };

export function routeLength(points: LatLng[], start?: LatLng | null): number {
  let total = 0;
  let prev = start ?? null;
  for (const p of points) {
    if (prev) total += distanceMeters(prev, p);
    prev = p;
  }
  return total;
}

/**
 * Shortest-looking order for a day's stops (open path, optionally starting at the hotel).
 * Nearest-neighbour to start, then 2-opt improvements. Exact for small days, very good for
 * the 5–15 stops a day usually has. Uses straight-line distance: fast, free, no API calls.
 */
export function optimizeOrder<T extends Pt>(stops: T[], start?: LatLng | null): T[] {
  if (stops.length < 3 && !start) return [...stops];
  const n = stops.length;
  if (n < 2) return [...stops];

  // nearest neighbour
  const left = [...stops];
  const order: T[] = [];
  let cur: LatLng = start ?? left.shift()!;
  if (!start) order.push(cur as T);
  while (left.length) {
    let best = 0;
    let bestD = Infinity;
    left.forEach((p, i) => {
      const d = distanceMeters(cur, p);
      if (d < bestD) { bestD = d; best = i; }
    });
    cur = left.splice(best, 1)[0]!;
    order.push(cur as T);
  }

  // 2-opt on the open path (the start point, if any, stays fixed before index 0)
  const len = (arr: T[]) => routeLength(arr, start);
  let improved = true;
  let bestLen = len(order);
  let guard = 0;
  while (improved && guard++ < 200) {
    improved = false;
    for (let i = 0; i < n - 1; i++) {
      for (let k = i + 1; k < n; k++) {
        const cand = [...order.slice(0, i), ...order.slice(i, k + 1).reverse(), ...order.slice(k + 1)];
        const l = len(cand);
        if (l + 1 < bestLen) {
          order.splice(0, n, ...cand);
          bestLen = l;
          improved = true;
        }
      }
    }
  }
  return order;
}

// ---------- timing a day ----------
/** Typical time spent at each kind of place, in minutes. The user can override per stop. */
export const DEFAULT_DURATION: Record<string, number> = {
  must: 90, attraction: 90, restaurant: 75, cafe: 40, shopping: 60, nightlife: 90,
  hotel: 0, parking: 10, park: 60, beach: 120, culture: 120, photo: 20, nature: 120, airport: 120, transport: 15, supermarket: 30,
};

export function durationFor(categoryKey: string | null, override: number | null): number {
  return override ?? DEFAULT_DURATION[categoryKey ?? ''] ?? 60;
}

export function toMinutes(t: string | null | undefined): number | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

export function fromMinutes(total: number): string {
  const t = ((Math.round(total) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/** Rounds up to the next 5 minutes, so times look like a person wrote them. */
const round5 = (m: number) => Math.ceil(m / 5) * 5;

/**
 * Gives every stop an arrival time: day start, then each stop's duration plus the travel
 * time to the next one (seconds from Google, or a walking estimate when missing).
 */
export function scheduleDay(
  stops: { categoryKey: string | null; durationMin: number | null }[],
  legSeconds: (number | null)[],
  dayStart = '09:00',
  estimateLegSeconds: (i: number) => number = () => 15 * 60,
): string[] {
  let t = toMinutes(dayStart) ?? 540;
  return stops.map((s, i) => {
    const arrive = round5(t);
    const leg = i < stops.length - 1 ? (legSeconds[i] ?? estimateLegSeconds(i)) : 0;
    t = arrive + durationFor(s.categoryKey, s.durationMin) + leg / 60;
    return fromMinutes(arrive);
  });
}

/**
 * The day's clock, recalculated on every change: leave the start at `dayStart`, travel the real
 * route time to each stop, stay there, travel on. Exact to the minute, in the destination's local
 * time (the times the traveller will see on their watch there). A leg with no route counts as 0.
 */
export function dayTimeline(
  dayStart: string,
  startLegSec: number | null,
  stops: { categoryKey: string | null; durationMin: number | null }[],
  legSeconds: (number | null)[],
): { arrive: string; leave: string; stayMin: number }[] {
  let t = (toMinutes(dayStart) ?? 540) + Math.round((startLegSec ?? 0) / 60);
  return stops.map((s, i) => {
    const arrive = t;
    const stayMin = durationFor(s.categoryKey, s.durationMin);
    const leave = arrive + stayMin;
    t = leave + Math.round((legSeconds[i] ?? 0) / 60);
    return { arrive: fromMinutes(arrive), leave: fromMinutes(leave), stayMin };
  });
}

/** True when the stops' own times go backwards somewhere (e.g. after reordering). */
export function timesOutOfOrder(times: (string | null)[]): boolean {
  const mins = times.map(toMinutes).filter((m): m is number => m !== null);
  return mins.some((m, i) => i > 0 && m < mins[i - 1]!);
}

/** Straight-line walking estimate: 4.5 km/h, with a 1.3 detour factor for real streets. */
export function walkingSecondsEstimate(a: LatLng, b: LatLng): number {
  return Math.round((distanceMeters(a, b) * 1.3) / (4500 / 3600));
}

// ---------- splitting places into days (Phase 10) ----------
/**
 * Groups places into `days` geographic clusters of similar size (balanced k-means),
 * so each day covers one area instead of zig-zagging across the city.
 * Deterministic: same input, same answer.
 */
export function clusterIntoDays<T extends Pt>(points: T[], days: number, maxIterations = 30): T[][] {
  const k = Math.max(1, Math.min(days, points.length));
  if (points.length === 0) return Array.from({ length: Math.max(1, days) }, () => []);
  const cap = Math.ceil(points.length / k);

  // deterministic seeding: farthest-point from the centroid, then farthest from chosen
  const centroid = {
    lat: points.reduce((s, p) => s + p.lat, 0) / points.length,
    lng: points.reduce((s, p) => s + p.lng, 0) / points.length,
  };
  const sorted = [...points].sort((a, b) => a.id.localeCompare(b.id));
  const centers: LatLng[] = [];
  let first = sorted[0]!;
  for (const p of sorted) if (distanceMeters(p, centroid) > distanceMeters(first, centroid)) first = p;
  centers.push(first);
  while (centers.length < k) {
    let far = sorted[0]!;
    let farD = -1;
    for (const p of sorted) {
      const d = Math.min(...centers.map((c) => distanceMeters(c, p)));
      if (d > farD) { farD = d; far = p; }
    }
    centers.push(far);
  }

  let groups: T[][] = [];
  for (let it = 0; it < maxIterations; it++) {
    // balanced assignment: closest pairs first, respecting capacity
    const pairs: { p: T; c: number; d: number }[] = [];
    for (const p of sorted) centers.forEach((c, ci) => pairs.push({ p, c: ci, d: distanceMeters(p, c) }));
    pairs.sort((a, b) => a.d - b.d || a.p.id.localeCompare(b.p.id) || a.c - b.c);
    const assigned = new Map<string, number>();
    const size = new Array(k).fill(0) as number[];
    for (const { p, c } of pairs) {
      if (assigned.has(p.id) || size[c]! >= cap) continue;
      assigned.set(p.id, c);
      size[c]!++;
    }
    const next: T[][] = Array.from({ length: k }, () => []);
    for (const p of sorted) next[assigned.get(p.id)!]!.push(p);

    const moved = next.some((g, i) => g.length !== groups[i]?.length || g.some((p, j) => p.id !== groups[i]![j]?.id));
    groups = next;
    if (!moved) break;
    groups.forEach((g, i) => {
      if (g.length) centers[i] = { lat: g.reduce((s, p) => s + p.lat, 0) / g.length, lng: g.reduce((s, p) => s + p.lng, 0) / g.length };
    });
  }

  // order days from west to east-ish so day 1 / day 2 read naturally, then pad empty days
  groups.sort((a, b) => (a[0] ? mean(a).lng : 0) - (b[0] ? mean(b).lng : 0));
  while (groups.length < days) groups.push([]);
  return groups;
}

const mean = (g: LatLng[]) => ({
  lat: g.reduce((s, p) => s + p.lat, 0) / g.length,
  lng: g.reduce((s, p) => s + p.lng, 0) / g.length,
});

// ---------- route line from Google ----------
/** Decodes Google's encoded polyline format into points. */
export function decodePolyline(encoded: string): LatLng[] {
  const out: LatLng[] = [];
  let i = 0;
  let lat = 0;
  let lng = 0;
  while (i < encoded.length) {
    for (const which of [0, 1]) {
      let shift = 0;
      let result = 0;
      let b: number;
      do {
        b = encoded.charCodeAt(i++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20 && i < encoded.length);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (which === 0) lat += delta;
      else lng += delta;
    }
    out.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return out;
}

// ---------- labels ----------
export function formatLegHe(seconds: number | null, meters: number | null, mode: 'walk' | 'transit' | 'drive'): string {
  if (seconds === null) return 'אין מידע על זמן ההגעה';
  const min = Math.max(1, Math.round(seconds / 60));
  const time = min < 60 ? `${min} דק׳` : `${Math.floor(min / 60)} ש׳ ${min % 60 ? `${min % 60} דק׳` : ''}`.trim();
  const how = mode === 'walk' ? 'הליכה' : mode === 'transit' ? 'בתחבורה ציבורית' : 'נסיעה';
  const dist = meters === null ? '' : meters < 1000 ? ` · ${Math.round(meters / 10) * 10} מ׳` : ` · ${(meters / 1000).toFixed(1)} ק״מ`;
  return `${time} ${how}${dist}`;
}

/**
 * One leg's line in the day plan, from real Google routes only (never a straight-line guess).
 * Short drives also show the real walking time, so people can choose.
 */
export function describeLegHe(
  leg: { durationSec: number | null; distanceMeters: number | null; mode?: 'walk' | 'transit' | 'drive'; walkSec?: number | null },
  fallbackMode: 'walk' | 'transit' | 'drive',
): string {
  if (leg.durationSec === null) return 'לא נמצא מסלול נסיעה או הליכה בין המקומות';
  const mode = leg.mode ?? fallbackMode;
  const text = formatLegHe(leg.durationSec, leg.distanceMeters, mode);
  if (mode !== 'drive' || leg.walkSec == null) return text;
  const min = Math.max(1, Math.round(leg.walkSec / 60));
  const walk = min < 60 ? `${min} דק׳` : `${Math.floor(min / 60)} ש׳ ${min % 60 ? `${min % 60} דק׳` : ''}`.trim();
  return `${text} · ברגל ${walk}`;
}

/** The trip's main way of moving, for route requests. */
export function primaryMode(modes: string[]): 'walk' | 'transit' | 'drive' {
  if (modes.includes('car') || modes.includes('taxi')) return 'drive';
  if (modes.includes('walk')) return 'walk';
  if (modes.includes('transit')) return 'transit';
  return 'drive';
}

// ---------- is the day realistic? ----------
/** A day counts as too full when it ends after this, runs longer than this, or has this many stops. */
export const DAY_LIMITS = { latestEnd: 21 * 60 + 30, maxBusyMin: 11 * 60, maxStops: 12, comfortableEnd: 20 * 60 + 30 };

export type DayLoad = {
  overloaded: boolean;
  /** Clock time the day's last stop ends ("21:45"). */
  endsAt: string;
  /** Minutes of visits plus getting there. */
  busyMin: number;
  stops: number;
  /** Indexes of stops worth moving or dropping (not "must see", longest first) until the day fits. */
  suggest: number[];
};

/**
 * How full a day is, from the start time, each stop's visit length and the travel between stops
 * (the real route time when it is known, otherwise a walking estimate). Pure arithmetic, no calls.
 */
export function dayLoad(
  dayStart: string,
  startLegSec: number | null,
  stops: { stayMin: number; isMust: boolean }[],
  legSec: number[],
): DayLoad {
  const start = toMinutes(dayStart) ?? 540;
  const travel = Math.round(((startLegSec ?? 0) + legSec.reduce((s, x) => s + x, 0)) / 60);
  const visits = stops.reduce((s, x) => s + x.stayMin, 0);
  const busyMin = travel + visits;
  const end = start + busyMin;
  const overloaded = stops.length >= 2 && (end > DAY_LIMITS.latestEnd || busyMin > DAY_LIMITS.maxBusyMin || stops.length >= DAY_LIMITS.maxStops);
  const suggest: number[] = [];
  if (overloaded) {
    const avgLeg = legSec.length ? travel / Math.max(1, legSec.length) : 0;
    let over = Math.max(end - DAY_LIMITS.comfortableEnd, busyMin - (DAY_LIMITS.maxBusyMin - 60), 0);
    let left = stops.length;
    const order = stops.map((s, i) => ({ ...s, i })).filter((s) => !s.isMust).sort((a, b) => b.stayMin - a.stayMin);
    for (const s of order) {
      if ((over <= 0 && left < DAY_LIMITS.maxStops) || suggest.length >= 3) break;
      suggest.push(s.i);
      over -= s.stayMin + avgLeg;
      left -= 1;
    }
  }
  return { overloaded, endsAt: fromMinutes(end), busyMin, stops: stops.length, suggest: suggest.sort((a, b) => a - b) };
}

// ---------- opening days ----------
/** Weekday of a trip date (0 = Sunday, as Google counts), or null without a date. */
export function weekdayOf(date: string | null): number | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
}

export const WEEKDAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'] as const;

/** True only when the place's hours are known and it does not open at all on that date's weekday. */
export function closedOn(openDays: number[] | null | undefined, date: string | null): boolean {
  const wd = weekdayOf(date);
  return !!openDays && wd !== null && !openDays.includes(wd);
}

// ---------- walking or driving, per leg ----------
/** Rough city driving: 1.35x the straight line at 25 km/h, plus 3 minutes to park. Only when Google gave no drive time. */
export function drivingSecondsEstimate(a: LatLng, b: LatLng): number {
  return Math.round((distanceMeters(a, b) * 1.35) / (25000 / 3600)) + 180;
}

export type LegOption = { sec: number; meters: number | null; exact: boolean };
export type LegMode = 'walk' | 'drive' | 'transit';
export type LegOptions = { walk: LegOption | null; drive: LegOption | null; transit: LegOption | null; chosen: LegMode };

/**
 * Both ways of getting from one stop to the next: the real Google time when the day's route has it
 * (driving route, or the walking time Google gives for short drives), otherwise an estimate.
 * `choice` is what the traveller picked; without one, the trip's own way of moving.
 */
export function legOptions(
  leg: { durationSec: number | null; distanceMeters: number | null; mode?: 'walk' | 'transit' | 'drive'; walkSec?: number | null } | null,
  a: LatLng, b: LatLng,
  tripMode: 'walk' | 'drive',
  choice: LegMode | null | undefined,
  transitSec: number | null = null,
): LegOptions {
  const legMode = leg?.mode ?? tripMode;
  const real = leg && leg.durationSec !== null ? leg.durationSec : null;
  const walk: LegOption = legMode === 'walk' && real !== null
    ? { sec: real, meters: leg!.distanceMeters, exact: true }
    : leg?.walkSec != null ? { sec: leg.walkSec, meters: null, exact: true }
    : { sec: walkingSecondsEstimate(a, b), meters: null, exact: false };
  // A leg Google could only walk (no sensible road) has no drive option.
  const noRoad = tripMode === 'drive' && legMode === 'walk';
  const drive: LegOption | null = noRoad ? null
    : legMode === 'drive' && real !== null ? { sec: real, meters: leg!.distanceMeters, exact: true }
    : { sec: drivingSecondsEstimate(a, b), meters: null, exact: false };
  // Public transport only when it really helps: clearly faster than walking the same way.
  const transit: LegOption | null = transitSec !== null && transitSec < walk.sec * 0.85 ? { sec: transitSec, meters: null, exact: true } : null;
  const chosen: LegMode = choice === 'transit' && transit ? 'transit' : choice === 'drive' && drive ? 'drive' : choice === 'walk' ? 'walk' : noRoad ? 'walk' : tripMode;
  return { walk, drive, transit, chosen };
}

export function shortDurationHe(sec: number): string {
  const min = Math.max(1, Math.round(sec / 60));
  return min < 60 ? `${min} דק׳` : `${Math.floor(min / 60)} ש׳${min % 60 ? ` ${min % 60} דק׳` : ''}`;
}
