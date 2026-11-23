// When Shabbat (or a festival) starts and ends at a place, from the sun alone: no service to call,
// so it also works without internet. Candle lighting = 18 minutes before sunset; the end = the sun
// 8.5° below the horizon. Festivals follow the custom in Israel (one day each).

const RAD = Math.PI / 180;

/** The moment (UTC) the sun passes `zenith` degrees in the evening of that date at that place, or null near the poles. */
export function eveningSunUtc(date: string, lat: number, lng: number, zenith: number): Date | null {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const n = Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86_400_000);
  const lngHour = lng / 15;
  const t = n + (18 - lngHour) / 24;
  const M = 0.9856 * t - 3.289;
  let L = M + 1.916 * Math.sin(M * RAD) + 0.02 * Math.sin(2 * M * RAD) + 282.634;
  L = ((L % 360) + 360) % 360;
  let RA = Math.atan(0.91764 * Math.tan(L * RAD)) / RAD;
  RA = ((RA % 360) + 360) % 360;
  RA = (RA + Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90) / 15;
  const sinDec = 0.39782 * Math.sin(L * RAD);
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH = (Math.cos(zenith * RAD) - sinDec * Math.sin(lat * RAD)) / (cosDec * Math.cos(lat * RAD));
  if (cosH > 1 || cosH < -1) return null;
  const H = Math.acos(cosH) / RAD / 15;
  const T = H + RA - 0.06571 * t - 6.622;
  const ut = (((T - lngHour) % 24) + 24) % 24;
  // The evening of a local date east of Greenwich can fall on the previous UTC day, and west on the next.
  const base = Date.UTC(y, m - 1, d) + ut * 3_600_000;
  const localNoonUtc = Date.UTC(y, m - 1, d, 12) - lngHour * 3_600_000;
  const shift = base < localNoonUtc ? 86_400_000 : base - localNoonUtc > 86_400_000 ? -86_400_000 : 0;
  return new Date(base + shift);
}

const FESTIVALS: Record<string, string> = {
  'Tishri-1': 'ראש השנה', 'Tishri-2': 'ראש השנה', 'Tishri-10': 'יום כיפור', 'Tishri-15': 'סוכות', 'Tishri-22': 'שמחת תורה',
  'Nisan-15': 'פסח', 'Nisan-21': 'שביעי של פסח', 'Sivan-6': 'שבועות',
};

/** "שבת" or the festival's name when that date is a day of rest, otherwise null. */
export function holyDayName(date: string): string | null {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const at = new Date(Date.UTC(y, m - 1, d, 12));
  let fest: string | undefined;
  try {
    const parts = new Intl.DateTimeFormat('en-u-ca-hebrew', { day: 'numeric', month: 'long', timeZone: 'UTC' }).formatToParts(at);
    const month = parts.find((p) => p.type === 'month')?.value ?? '';
    const day = parts.find((p) => p.type === 'day')?.value ?? '';
    fest = FESTIVALS[`${month}-${day}`];
  } catch { /* no Hebrew calendar in this browser: Shabbat only */ }
  return fest ?? (at.getUTCDay() === 6 ? 'שבת' : null);
}

const nextDate = (date: string) => {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
};

export type ShabbatInfo =
  | { kind: 'starts'; name: string; at: Date | null }
  | { kind: 'ends'; name: string; at: Date | null }
  | { kind: 'all-day'; name: string };

/** What a keeper of Shabbat needs to know about this day of the trip, at this place. Null on an ordinary day. */
export function shabbatInfo(date: string | null, lat: number, lng: number): ShabbatInfo | null {
  if (!date) return null;
  const today = holyDayName(date);
  const tomorrow = holyDayName(nextDate(date));
  if (today && tomorrow) return { kind: 'all-day', name: today === tomorrow ? today : `${today} ו${tomorrow}` };
  if (today) return { kind: 'ends', name: today, at: eveningSunUtc(date, lat, lng, 98.5) };
  if (tomorrow) {
    const sunset = eveningSunUtc(date, lat, lng, 90.833);
    return { kind: 'starts', name: tomorrow, at: sunset ? new Date(sunset.getTime() - 18 * 60_000) : null };
  }
  return null;
}

/** Clock time on the phone ("17:42"). The switch shows only during the trip, so the phone's clock is the local one. */
export const clockHe = (at: Date | null) => (at ? at.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false }) : null);
const minutesOf = (at: Date) => at.getHours() * 60 + at.getMinutes();

/** Is a stop at this clock time ("HH:MM") inside Shabbat or the festival? */
export function insideShabbat(info: ShabbatInfo | null, time: string | null | undefined): boolean {
  if (!info) return false;
  if (info.kind === 'all-day') return true;
  if (!time || !info.at) return false;
  const [h, mi] = time.split(':').map(Number) as [number, number];
  const t = h * 60 + mi;
  return info.kind === 'starts' ? t >= minutesOf(info.at) : t < minutesOf(info.at);
}

export function shabbatLineHe(info: ShabbatInfo): string {
  const at = info.kind === 'all-day' ? null : clockHe(info.at);
  if (info.kind === 'all-day') return `היום ${info.name}, כל היום.`;
  if (info.kind === 'starts') return at ? `כניסת ${info.name} היום ב-${at} (הדלקת נרות, 18 דקות לפני השקיעה).` : `היום נכנסת ${info.name}.`;
  return at ? `צאת ${info.name} היום ב-${at} בערך.` : `היום ${info.name}.`;
}
