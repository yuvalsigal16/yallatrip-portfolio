// Pure trip rules: validating the trip form, working with dates, and
// the Hebrew labels the screens show. No framework imports, so it is unit-tested.

import { TRANSPORTS, TRAVEL_STYLES, BUDGETS, type OnboardingAnswers } from '@/lib/auth/rules';
import { isGooglePlaceId, isSessionToken } from '@/lib/validation';

export const MAX_TRIP_DAYS = 366; // matches the database check (end - start <= 365)
export const MAX_TRAVELERS = 50;

// ---------- dates (plain YYYY-MM-DD strings, no time zones) ----------
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Parses "2026-10-10" as a calendar date. Returns null for anything else, including 2026-02-30. */
export function parseDate(s: unknown): Date | null {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date : null;
}

export function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Today's date in Israel, as YYYY-MM-DD. */
export function todayInIsrael(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(now);
}

const DAY_MS = 86_400_000;

/** Inclusive length: 10–15 October = 6 days. */
export function tripLengthDays(start: string, end: string): number | null {
  const a = parseDate(start);
  const b = parseDate(end);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / DAY_MS) + 1;
}

export function addDays(date: string, n: number): string | null {
  const d = parseDate(date);
  return d ? toDateString(new Date(d.getTime() + n * DAY_MS)) : null;
}

// ---------- Hebrew labels ----------
const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export function monthNameHe(monthIndex: number): string {
  return MONTHS[monthIndex] ?? '';
}

/** "10–15 באוקטובר 2026", "28 בספטמבר – 3 באוקטובר 2026", "30 בדצמבר 2026 – 2 בינואר 2027". */
export function formatDateRangeHe(start: string | null, end: string | null): string | null {
  const a = parseDate(start);
  const b = parseDate(end);
  if (!a || !b) return null;
  const [ad, am, ay] = [a.getUTCDate(), a.getUTCMonth(), a.getUTCFullYear()];
  const [bd, bm, by] = [b.getUTCDate(), b.getUTCMonth(), b.getUTCFullYear()];
  if (ay === by && am === bm) return ad === bd ? `${ad} ב${MONTHS[am]} ${ay}` : `${ad}–${bd} ב${MONTHS[am]} ${ay}`;
  if (ay === by) return `${ad} ב${MONTHS[am]} – ${bd} ב${MONTHS[bm]} ${ay}`;
  return `${ad} ב${MONTHS[am]} ${ay} – ${bd} ב${MONTHS[bm]} ${by}`;
}

/** "שבת, 10 באוקטובר" */
export function formatDayHe(date: string | null): string | null {
  const d = parseDate(date);
  if (!d) return null;
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ב${MONTHS[d.getUTCMonth()]}`;
}

/** "6 ימים · 5 לילות" */
export function formatLengthHe(days: number): string {
  const d = days === 1 ? 'יום אחד' : days === 2 ? 'יומיים' : `${days} ימים`;
  const n = days - 1;
  const nights = n === 0 ? '' : n === 1 ? ' · לילה אחד' : n === 2 ? ' · שני לילות' : ` · ${n} לילות`;
  return d + nights;
}

// ---------- trip status (the chip on each trip card) ----------
export type TripStatus =
  | { kind: 'draft'; label: string }
  | { kind: 'upcoming'; label: string; daysUntil: number }
  | { kind: 'ongoing'; label: string; dayNumber: number }
  | { kind: 'past'; label: string };

export function tripStatus(start: string | null, end: string | null, today: string): TripStatus {
  const len = start && end ? tripLengthDays(start, end) : null;
  if (!start || !end || len === null) return { kind: 'draft', label: 'בלי תאריכים' };
  const until = tripLengthDays(today, start);
  if (until === null) return { kind: 'draft', label: 'בלי תאריכים' };
  const daysUntil = until - 1;
  if (daysUntil > 1) return { kind: 'upcoming', label: `בעוד ${daysUntil} ימים`, daysUntil };
  if (daysUntil === 1) return { kind: 'upcoming', label: 'מחר!', daysUntil };
  const dayNumber = -daysUntil + 1;
  if (dayNumber <= len) return { kind: 'ongoing', label: `עכשיו בטיול · יום ${dayNumber}`, dayNumber };
  return { kind: 'past', label: 'הטיול הסתיים' };
}

/** Upcoming and ongoing first (soonest first), then drafts, then past trips (latest first). */
export function sortTrips<T extends { start_date: string | null; end_date: string | null; created_at: string }>(
  trips: T[],
  today: string,
): T[] {
  const rank = (t: T) => {
    const k = tripStatus(t.start_date, t.end_date, today).kind;
    return k === 'ongoing' ? 0 : k === 'upcoming' ? 1 : k === 'draft' ? 2 : 3;
  };
  return [...trips].sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    if (rank(a) <= 1) return (a.start_date ?? '').localeCompare(b.start_date ?? '');
    if (rank(a) === 3) return (b.end_date ?? '').localeCompare(a.end_date ?? '');
    return b.created_at.localeCompare(a.created_at);
  });
}

// ---------- the trip form (wizard + settings) ----------
type StyleKey = OnboardingAnswers['travelStyles'][number];
type BudgetKey = NonNullable<OnboardingAnswers['budget']>;
type TransportKey = OnboardingAnswers['transport'][number];

/** One stop of a multi-destination trip: a country or city, with optional dates. */
export type TripLeg = {
  name: string; start: string | null; end: string | null;
  /** Where it is (when known): centres the map and the "fill my days" search. */
  lat?: number | null; lng?: number | null; placeId?: string | null;
};
export const MAX_LEGS = 40;

export type TripInput = {
  legs: TripLeg[];
  title: string;
  destinationName: string;
  placeId: string | null;
  sessionToken: string | null;
  startDate: string | null;
  endDate: string | null;
  travelers: number;
  transport: TransportKey[];
  styles: StyleKey[];
  budget: BudgetKey | null;
};

export type TripFields = {
  title?: unknown;
  destinationName?: unknown;
  placeId?: unknown;
  sessionToken?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  noDates?: unknown;
  travelers?: unknown;
  transport?: unknown[];
  styles?: unknown[];
  budget?: unknown;
  legName?: unknown[];
  legStart?: unknown[];
  legEnd?: unknown[];
};

/** Which wizard step shows each field, so an error sends the user back to the right step. */
export const FIELD_STEP: Record<string, 1 | 2 | 3> = {
  destinationName: 1, startDate: 1, endDate: 1, title: 1, legs: 1, travelers: 2, transport: 2, styles: 3, budget: 3,
};

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const keysOf = <T extends readonly { key: string }[]>(list: T, values: unknown[] = []) => {
  const allowed = new Set<string>(list.map((x) => x.key));
  return [...new Set(values.filter((v): v is T[number]['key'] => typeof v === 'string' && allowed.has(v)))];
};

export function parseTripForm(
  f: TripFields,
): { ok: true; value: TripInput } | { ok: false; fieldErrors: Record<string, string> } {
  const errors: Record<string, string> = {};

  const destinationName = str(f.destinationName);
  if (!destinationName) errors.destinationName = 'לאן נוסעים?';
  else if (destinationName.length > 200) errors.destinationName = 'שם היעד ארוך מדי';

  // Several destinations, each with its own dates: the trip runs from the first date to the last.
  const noDatesFlag = f.noDates === 'on' || f.noDates === true || f.noDates === '1';
  const multi = parseLegs(f.legName ?? [], f.legStart ?? [], f.legEnd ?? [], null, null);
  if (!multi.ok) errors.legs = multi.error;
  const legs = multi.ok && multi.legs.length > 1 ? multi.legs.map((l) => (noDatesFlag ? { ...l, start: null, end: null } : l)) : [];
  const legStarts = legs.map((l) => l.start).filter((d): d is string => Boolean(d)).sort();
  const legEnds = legs.map((l) => l.end).filter((d): d is string => Boolean(d)).sort();
  const derived = legStarts.length ? { s: legStarts[0]!, e: legEnds[legEnds.length - 1] ?? legStarts[0]! } : null;

  const title = str(f.title) || (legs.length > 1 ? legs.map((l) => l.name).join(' + ').slice(0, 120) : destinationName);
  if (title.length > 120) errors.title = 'השם ארוך מדי (עד 120 תווים)';

  const placeId = isGooglePlaceId(f.placeId) ? f.placeId : null;
  const sessionToken = isSessionToken(f.sessionToken) ? f.sessionToken : null;

  let startDate: string | null = null;
  let endDate: string | null = null;
  const noDates = f.noDates === 'on' || f.noDates === true || f.noDates === '1';
  if (!noDates) {
    const s = derived?.s ?? str(f.startDate);
    const e = derived?.e ?? str(f.endDate);
    if (!s) errors.startDate = 'מתי יוצאים?';
    else if (!parseDate(s)) errors.startDate = 'תאריך לא תקין';
    if (!e) errors.endDate = 'מתי חוזרים?';
    else if (!parseDate(e)) errors.endDate = 'תאריך לא תקין';
    if (!errors.startDate && !errors.endDate) {
      const len = tripLengthDays(s, e)!;
      if (len < 1) errors.endDate = 'תאריך החזרה לפני תאריך היציאה';
      else if (len > MAX_TRIP_DAYS) errors.endDate = 'טיול יכול להימשך עד שנה';
      else [startDate, endDate] = [s, e];
    }
  }

  const travelersRaw = str(f.travelers) || '1';
  const travelers = Number(travelersRaw);
  if (!Number.isInteger(travelers) || travelers < 1 || travelers > MAX_TRAVELERS) {
    errors.travelers = `מספר מטיילים בין 1 ל-${MAX_TRAVELERS}`;
  }

  const transport = keysOf(TRANSPORTS, f.transport);
  const styles = keysOf(TRAVEL_STYLES, f.styles);
  const budget = keysOf(BUDGETS, [f.budget])[0] ?? null;

  if (Object.keys(errors).length) return { ok: false, fieldErrors: errors };
  return {
    ok: true,
    value: {
      legs,
      title, destinationName, placeId, sessionToken, startDate, endDate, travelers,
      transport: transport.length ? transport : ['walk', 'transit'],
      styles, budget,
    },
  };
}

/**
 * The destinations of a trip, in order, from the form's parallel fields.
 * Empty rows are skipped. Dates are optional; a row with dates needs them in order
 * (and inside the trip's dates, when those are given).
 */
export function parseLegs(
  names: unknown[], starts: unknown[], ends: unknown[], tripStart: string | null, tripEnd: string | null,
): { ok: true; legs: TripLeg[] } | { ok: false; error: string } {
  const legs: TripLeg[] = [];
  const n = Math.max(names.length, starts.length, ends.length);
  for (let i = 0; i < n; i++) {
    const name = str(names[i]);
    const s = str(starts[i]);
    const e = str(ends[i]);
    if (!name && !s && !e) continue;
    if (!name) return { ok: false, error: 'חסר שם של אחד היעדים' };
    if (name.length > 200) return { ok: false, error: `השם "${name.slice(0, 20)}…" ארוך מדי` };
    if ((s && !parseDate(s)) || (e && !parseDate(e))) return { ok: false, error: `תאריך לא תקין ב${name}` };
    const start = s || null;
    const end = e || s || null;
    if (start && end && (tripLengthDays(start, end) ?? 0) < 1) return { ok: false, error: `ב${name} תאריך הסיום לפני ההתחלה` };
    if (!start && end) return { ok: false, error: `ב${name} חסר תאריך הגעה` };
    if (start && tripStart && tripEnd && (start < tripStart || end! > tripEnd)) {
      return { ok: false, error: `התאריכים של ${name} מחוץ לתאריכי הטיול` };
    }
    legs.push({ name, start, end });
  }
  if (legs.length > MAX_LEGS) return { ok: false, error: `אפשר עד ${MAX_LEGS} יעדים בטיול` };
  return { ok: true, legs };
}

/** Reads the stored list defensively (it is JSON in the database). */
export function legsFromJson(v: unknown): TripLeg[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((x) => {
    const o = x as Record<string, unknown>;
    if (typeof o?.name !== 'string') return [];
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    const lat = num(o.lat), lng = num(o.lng);
    return [{
      name: o.name, start: typeof o.start === 'string' ? o.start : null, end: typeof o.end === 'string' ? o.end : null,
      ...(lat !== null && lng !== null ? { lat, lng } : {}),
      ...(typeof o.placeId === 'string' ? { placeId: o.placeId } : {}),
    }];
  });
}

/** "11–20 בינואר 2027", or one date, or nothing. */
export function formatLegDatesHe(leg: TripLeg): string | null {
  if (!leg.start) return null;
  return formatDateRangeHe(leg.start, leg.end ?? leg.start);
}

/** The first wizard step that has an error. */
export function firstStepWithError(fieldErrors: Record<string, string> | undefined): 1 | 2 | 3 {
  const steps = Object.keys(fieldErrors ?? {}).map((k) => FIELD_STEP[k] ?? 1);
  return (steps.length ? Math.min(...steps) : 1) as 1 | 2 | 3;
}

/** How many days the new dates would remove from the end of the trip. */
export function daysRemovedByNewDates(
  oldStart: string | null, oldEnd: string | null, newStart: string | null, newEnd: string | null,
): number {
  if (!oldStart || !oldEnd || !newStart || !newEnd) return 0;
  const before = tripLengthDays(oldStart, oldEnd) ?? 0;
  const after = tripLengthDays(newStart, newEnd) ?? 0;
  return Math.max(0, before - after);
}

export const TRAVELER_LABEL = (n: number) => (n === 1 ? 'מטייל/ת אחד/ת' : n === 2 ? 'זוג' : `${n} מטיילים`);

export function transportLabel(keys: string[]): string {
  const labels = keys.map((k) => TRANSPORTS.find((t) => t.key === k)?.label).filter(Boolean);
  return labels.join(' + ');
}
