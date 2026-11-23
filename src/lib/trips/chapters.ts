// The destinations of a trip as "chapters": how many nights in each, and their dates.
// Pure functions, shared by the new-trip form (preview), the server (saving) and the trip screen.
import { addDays, tripLengthDays, type TripLeg } from './rules';

/** Nights split as evenly as possible; the first destinations get the extra nights. */
export function splitNights(total: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(total / count);
  const extra = total - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0));
}

/**
 * Dates for each destination from the trip's first day and nights per destination.
 * A destination starts the day the previous one ends (you travel on that day).
 */
export function datesFromNights(start: string, nights: number[]): { start: string; end: string }[] {
  let from = start;
  return nights.map((n) => {
    const to = addDays(from, n)!;
    const r = { start: from, end: to };
    from = to;
    return r;
  });
}

/** Nights in a destination (0 when it has no dates). */
export function nightsOf(leg: Pick<TripLeg, 'start' | 'end'>): number {
  if (!leg.start || !leg.end) return 0;
  return Math.max(0, (tripLengthDays(leg.start, leg.end) ?? 1) - 1);
}

/**
 * Moves one night across the border between destination `i` and the next one.
 * by = +1: destination i gets a night more and the next one a night less (and the other way).
 * The trip's total length stays the same, so no day (and no plan in it) is ever removed.
 * Returns null when it would leave a destination with no nights.
 */
export function tradeNight<T extends TripLeg>(legs: T[], i: number, by: 1 | -1): T[] | null {
  const a = legs[i], b = legs[i + 1];
  if (!a?.start || !a.end || !b?.start || !b.end) return null;
  if (nightsOf(a) + by < 1 || nightsOf(b) - by < 1) return null;
  const border = addDays(a.end, by)!;
  return legs.map((l, k) => (k === i ? { ...l, end: border } : k === i + 1 ? { ...l, start: border } : l));
}

/** Which destination a trip day belongs to: the one whose dates hold it (the travel day goes to the new place). */
export function chapterOfDate<T extends TripLeg>(legs: T[], date: string | null): number {
  if (!date) return -1;
  for (let i = legs.length - 1; i >= 0; i--) {
    const l = legs[i]!;
    if (l.start && l.end && date >= l.start && date <= l.end) return i;
  }
  return -1;
}
