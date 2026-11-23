// How full the trip's days should be, and where a newly saved place fits best.
// Pure functions, no calls: used on save (the place goes straight into a day) and by the day planner.

export type Pace = 'relaxed' | 'normal' | 'full';

export const PACES: { key: Pace; label: string; emoji: string; perDay: number; start: string; hint: string }[] = [
  { key: 'relaxed', label: 'רגוע', emoji: '🌴', perDay: 3, start: '10:00', hint: 'עד 3 דברים ביום, מתחילים ב-10:00 ונשאר זמן חופשי' },
  { key: 'normal', label: 'רגיל', emoji: '🚶', perDay: 5, start: '09:00', hint: 'עד 5 דברים ביום' },
  { key: 'full', label: 'מלא', emoji: '🏃', perDay: 7, start: '08:30', hint: 'עד 7 דברים ביום, יוצאים מוקדם' },
];

export function isPace(v: unknown): v is Pace {
  return v === 'relaxed' || v === 'normal' || v === 'full';
}

/** The trip's pace: the one chosen, or "relaxed" when the trip's styles say so. */
export function paceOf(chosen: string | null | undefined, travelStyles: string[] = []): Pace {
  if (isPace(chosen)) return chosen;
  return travelStyles.includes('relax') ? 'relaxed' : 'normal';
}

export const paceInfo = (p: Pace) => PACES.find((x) => x.key === p)!;

/** Places that are not "things to do": the hotel, getting around. Never put in a day by themselves. */
const LOGISTICS = new Set(['hotel', 'airport', 'transport', 'parking']);
/** A meal or a coffee happens anyway, so it counts as half a thing. */
const MEALS = new Set(['restaurant', 'cafe']);

export function stopWeight(categoryKey: string | null | undefined): number {
  if (categoryKey && LOGISTICS.has(categoryKey)) return 0;
  if (categoryKey && MEALS.has(categoryKey)) return 0.5;
  return 1;
}

export function isLogistics(categoryKey: string | null | undefined): boolean {
  return !!categoryKey && LOGISTICS.has(categoryKey);
}

/** How many "things" fit in a day. The flight days (first and last of a trip of 3+ days) get half. */
export function dayCapacity(pace: Pace, position: number, totalDays: number): number {
  const full = paceInfo(pace).perDay;
  const edge = totalDays >= 3 && (position === 0 || position === totalDays - 1);
  return edge ? Math.ceil(full / 2) : full;
}

export function dayWeight(stops: { categoryKey: string | null }[]): number {
  return stops.reduce((s, x) => s + stopWeight(x.categoryKey), 0);
}

type LatLng = { lat: number; lng: number };

function meters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Within this distance of a day's places, a new place belongs to the same area. */
export const SAME_AREA_M = 3000;

export type PickDay = {
  id: string;
  date: string | null;
  stops: { lat: number | null; lng: number | null; categoryKey: string | null }[];
};

/**
 * The best day for a new place:
 * 1. a day that already has places near it (same area) and still has room, the closest one;
 * 2. otherwise an empty day, the one with the most room (so the flight days fill last), earliest first;
 * 3. otherwise any day with room, the closest one.
 * Days before `fromDate` (the trip is under way) and days it is known to be closed are skipped.
 * Returns null when every day is full for the pace, or the place is not a thing to do (hotel, airport...).
 */
export function pickDay(
  place: LatLng & { categoryKey: string | null },
  days: PickDay[],
  opts: { pace: Pace; fromDate?: string | null; closedOn?: (date: string | null) => boolean },
): { dayId: string; sameArea: boolean } | null {
  const w = stopWeight(place.categoryKey);
  if (w === 0) return null;
  const rows = days.map((d, i) => {
    const pts = d.stops.filter((s): s is { lat: number; lng: number; categoryKey: string | null } => s.lat !== null && s.lng !== null);
    const near = pts.length ? Math.min(...pts.map((s) => meters(place, s))) : null;
    const room = dayCapacity(opts.pace, i, days.length) - dayWeight(d.stops);
    return { d, i, near, room, empty: d.stops.length === 0 };
  }).filter((r) => (!opts.fromDate || !r.d.date || r.d.date >= opts.fromDate) && !(opts.closedOn?.(r.d.date)) && r.room >= w);
  if (!rows.length) return null;

  const close = rows.filter((r) => r.near !== null && r.near <= SAME_AREA_M).sort((a, b) => a.near! - b.near!);
  if (close.length) return { dayId: close[0]!.d.id, sameArea: true };
  const empty = rows.filter((r) => r.empty).sort((a, b) => b.room - a.room || a.i - b.i);
  if (empty.length) return { dayId: empty[0]!.d.id, sameArea: false };
  const any = [...rows].sort((a, b) => (a.near ?? Infinity) - (b.near ?? Infinity));
  return { dayId: any[0]!.d.id, sameArea: false };
}

/** Part of the day for an arrival time ("10:30" -> morning). */
export type DayPart = 'morning' | 'noon' | 'evening';
export const DAY_PARTS: Record<DayPart, string> = { morning: '🌅 בוקר', noon: '☀️ צהריים', evening: '🌙 ערב' };

export function dayPartOf(time: string | null | undefined): DayPart | null {
  const m = time ? /^(\d{1,2}):(\d{2})/.exec(time) : null;
  if (!m) return null;
  const h = Number(m[1]);
  return h < 12 ? 'morning' : h < 17 ? 'noon' : 'evening';
}
