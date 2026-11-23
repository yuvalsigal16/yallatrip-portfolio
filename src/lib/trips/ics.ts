// Builds a calendar file (.ics) from a trip, so it can be added to the phone's calendar or Google Calendar.
// Times are "floating" (no time zone): 10:00 in the plan shows as 10:00 wherever the phone is.

export type IcsEvent = {
  uid: string;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM; without it the event is all-day. */
  time?: string | null;
  minutes?: number;
  /** Last day (inclusive) of an all-day event that spans days. */
  endDate?: string | null;
  description?: string | null;
  location?: string | null;
};

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1');
const ymd = (d: string) => d.replace(/-/g, '');
const pad = (n: number) => String(n).padStart(2, '0');

function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y!, m! - 1, d! + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** date + time + minutes, rolling over midnight when needed. Returns YYYYMMDDTHHMM00. */
function stamp(date: string, time: string, plusMin = 0): string {
  const [h, mi] = time.split(':').map(Number);
  const total = h! * 60 + mi! + plusMin;
  const day = addDays(date, Math.floor(total / 1440));
  const rest = ((total % 1440) + 1440) % 1440;
  return `${ymd(day)}T${pad(Math.floor(rest / 60))}${pad(rest % 60)}00`;
}

/** Lines longer than 75 bytes must be folded; a simple character-count fold keeps every reader happy. */
const fold = (line: string) => {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 60) { out.push(rest.slice(0, 60)); rest = ` ${rest.slice(60)}`; }
  out.push(rest);
  return out.join('\r\n');
};

export function buildIcs(calendarName: string, events: IcsEvent[], now = new Date()): string {
  const dtstamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//YallaTrip//Trip plan//HE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${esc(calendarName)}`];
  for (const e of events) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) continue;
    lines.push('BEGIN:VEVENT', `UID:${e.uid}@gotrip`, `DTSTAMP:${dtstamp}`);
    if (e.time && /^\d{2}:\d{2}$/.test(e.time)) {
      lines.push(`DTSTART:${stamp(e.date, e.time)}`, `DTEND:${stamp(e.date, e.time, Math.max(15, e.minutes ?? 60))}`);
    } else {
      const last = e.endDate && e.endDate >= e.date ? e.endDate : e.date;
      lines.push(`DTSTART;VALUE=DATE:${ymd(e.date)}`, `DTEND;VALUE=DATE:${ymd(addDays(last, 1))}`);
    }
    lines.push(fold(`SUMMARY:${esc(e.title)}`));
    if (e.description) lines.push(fold(`DESCRIPTION:${esc(e.description)}`));
    if (e.location) lines.push(fold(`LOCATION:${esc(e.location)}`));
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}
