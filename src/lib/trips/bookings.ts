// Bookings and documents of a trip: flights, hotel, car, tickets, with the confirmation number,
// date, time and an optional attached file. Pure rules here, no database.

export const BOOKING_KINDS = [
  { key: 'flight', label: 'טיסה', icon: '✈️' },
  { key: 'hotel', label: 'לינה', icon: '🛏️' },
  { key: 'car', label: 'רכב', icon: '🚗' },
  { key: 'train', label: 'רכבת / אוטובוס', icon: '🚆' },
  { key: 'ticket', label: 'כרטיס / אטרקציה', icon: '🎟️' },
  { key: 'restaurant', label: 'מסעדה', icon: '🍽️' },
  { key: 'other', label: 'אחר', icon: '📄' },
] as const;
export type BookingKind = (typeof BOOKING_KINDS)[number]['key'];
export const isBookingKind = (v: unknown): v is BookingKind => BOOKING_KINDS.some((k) => k.key === v);
export const kindOf = (k: string) => BOOKING_KINDS.find((x) => x.key === k) ?? BOOKING_KINDS[BOOKING_KINDS.length - 1]!;

export type Booking = {
  id: string;
  kind: BookingKind;
  title: string;
  confirmation: string | null;
  starts_on: string | null; // YYYY-MM-DD
  start_time: string | null; // HH:MM
  ends_on: string | null;
  note: string | null;
  file_path: string | null;
  file_name: string | null;
};

export const BOOKING_COLUMNS = 'id, kind, title, confirmation, starts_on, start_time, ends_on, note, file_path, file_name';

export const DOC_BUCKET = 'trip-docs';
export const DOC_MAX_BYTES = 10 * 1024 * 1024;
export const DOC_TYPES: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** A file path is always inside the trip's own folder, with a safe generated name. */
export const isDocPath = (tripId: string, p: unknown): p is string =>
  typeof p === 'string' && p.startsWith(`${tripId}/`) && /^[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,120}$/.test(p);

const clean = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.replace(/[ \t]+/g, ' ').trim();
  return t ? t.slice(0, max) : null;
};
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const isTime = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

export type BookingInput = {
  kind: string; title: string; confirmation?: string; startsOn?: string; startTime?: string; endsOn?: string; note?: string;
};

/** Checks and tidies what the form sent. Returns a Hebrew message when something is wrong. */
export function parseBooking(input: BookingInput):
  | { ok: true; value: Omit<Booking, 'id' | 'file_path' | 'file_name'> }
  | { ok: false; error: string } {
  if (!isBookingKind(input?.kind)) return { ok: false, error: 'בחרו את סוג ההזמנה' };
  const title = clean(input.title, 120);
  if (!title) return { ok: false, error: 'כתבו שם להזמנה, למשל "טיסה לטביליסי"' };
  const startsOn = input.startsOn ? input.startsOn : null;
  const endsOn = input.endsOn ? input.endsOn : null;
  const startTime = input.startTime ? input.startTime : null;
  if (startsOn !== null && !isDate(startsOn)) return { ok: false, error: 'התאריך לא תקין' };
  if (endsOn !== null && !isDate(endsOn)) return { ok: false, error: 'תאריך הסיום לא תקין' };
  if (startsOn && endsOn && endsOn < startsOn) return { ok: false, error: 'תאריך הסיום לפני תאריך ההתחלה' };
  if (startTime !== null && !isTime(startTime)) return { ok: false, error: 'השעה לא תקינה' };
  return {
    ok: true,
    value: { kind: input.kind, title, confirmation: clean(input.confirmation, 80), starts_on: startsOn, start_time: startTime, ends_on: endsOn, note: clean(input.note, 1000) },
  };
}

/** Dated bookings first, in order; undated ones last. */
export function sortBookings<T extends { starts_on: string | null; start_time: string | null }>(list: T[]): T[] {
  return [...list].sort((a, b) =>
    (a.starts_on ?? '9999').localeCompare(b.starts_on ?? '9999') || (a.start_time ?? '99').localeCompare(b.start_time ?? '99'));
}
