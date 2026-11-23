import { addDays, tripLengthDays, type TripLeg } from './rules';

// The bird's-eye view of a long trip: where the plan is still empty, and which nights have nowhere to sleep.
// Pure logic, so it is tested without a database.

export type OverviewDay = { id: string; dayIndex: number; date: string | null; stopCount: number };
export type Stay = { starts_on: string | null; ends_on: string | null };
export type DateRange = { from: string; to: string; count: number; firstDayId: string | null };

/** Consecutive dates folded into ranges: 12,13,14,17 -> 12–14 (3), 17 (1). */
export function foldDates(dates: string[], dayIdByDate: Map<string, string> = new Map()): DateRange[] {
  const out: DateRange[] = [];
  for (const d of [...new Set(dates)].sort()) {
    const last = out[out.length - 1];
    if (last && addDays(last.to, 1) === d) { last.to = d; last.count += 1; }
    else out.push({ from: d, to: d, count: 1, firstDayId: dayIdByDate.get(d) ?? null });
  }
  return out;
}

/** The nights a stay covers: check-in 10th, check-out 13th = the nights of the 10th, 11th and 12th. One night when there is no check-out. */
export function nightsOf(stay: Stay): string[] {
  if (!stay.starts_on) return [];
  const n = stay.ends_on && stay.ends_on > stay.starts_on ? (tripLengthDays(stay.starts_on, stay.ends_on) ?? 2) - 1 : 1;
  return Array.from({ length: Math.min(n, 400) }, (_, i) => addDays(stay.starts_on!, i)).filter((d): d is string => !!d);
}

export type Overview = {
  totalDays: number;
  plannedDays: number;
  emptyRanges: DateRange[];
  /** Nights of the trip (every day but the last) with no stay booked. Empty when no stay has dates at all. */
  uncoveredNights: DateRange[];
  coveredNights: Set<string>;
  hasDatedStays: boolean;
};

export function tripOverview(days: OverviewDay[], stays: Stay[]): Overview {
  const dated = days.filter((d): d is OverviewDay & { date: string } => !!d.date).sort((a, b) => a.date.localeCompare(b.date));
  const idByDate = new Map(dated.map((d) => [d.date, d.id]));
  const covered = new Set(stays.flatMap(nightsOf));
  const hasDatedStays = stays.some((s) => !!s.starts_on);
  const nights = dated.slice(0, -1).map((d) => d.date);
  return {
    totalDays: days.length,
    plannedDays: days.filter((d) => d.stopCount > 0).length,
    emptyRanges: foldDates(dated.filter((d) => d.stopCount === 0).map((d) => d.date), idByDate),
    uncoveredNights: hasDatedStays ? foldDates(nights.filter((n) => !covered.has(n)), idByDate) : [],
    coveredNights: covered,
    hasDatedStays,
  };
}

export type LegSummary = { name: string; start: string | null; end: string | null; days: number; planned: number; nights: number; nightsCovered: number };

/** Per destination of a multi-destination trip: its days, how many are planned, and how many of its nights have a stay. */
export function legSummaries(legs: TripLeg[], days: OverviewDay[], covered: Set<string>): LegSummary[] {
  return legs.map((l) => {
    const mine = l.start && l.end ? days.filter((d) => d.date && d.date >= l.start! && d.date <= l.end!) : [];
    const nights = mine.filter((d) => d.date! < l.end!).map((d) => d.date!);
    return {
      name: l.name, start: l.start, end: l.end, days: mine.length, planned: mine.filter((d) => d.stopCount > 0).length,
      nights: nights.length, nightsCovered: nights.filter((n) => covered.has(n)).length,
    };
  });
}

/** Month blocks for the calendar strip: each with the weekday offset of its first shown day (0 = Sunday). */
export function monthBlocks<T extends { date: string | null }>(days: T[]): { key: string; year: number; month: number; offset: number; days: T[] }[] {
  const out: { key: string; year: number; month: number; offset: number; days: T[] }[] = [];
  for (const d of days) {
    if (!d.date) continue;
    const key = d.date.slice(0, 7);
    let b = out[out.length - 1];
    if (!b || b.key !== key) {
      const [y, m, day] = d.date.split('-').map(Number) as [number, number, number];
      b = { key, year: y, month: m - 1, offset: new Date(Date.UTC(y, m - 1, day)).getUTCDay(), days: [] };
      out.push(b);
    }
    b.days.push(d);
  }
  return out;
}
