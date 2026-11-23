import type { CountryInfo } from '@/lib/countries/info';
import { formatDateRangeHe } from '@/lib/trips/rules';
import { joinHere, leaveHere } from '@/app/trips/here-actions';

export type Here = { joined: boolean; count: number; list: { name: string; from: string; to: string; note: string | null }[] };
export type TripCtx = { id: string; start: string | null; end: string | null };

/**
 * "ישראלים כאן": other YallaTrip travellers in this country on overlapping dates. Anyone sees how many;
 * only someone who chose to appear sees who (first name, dates, and the note they chose to share).
 * While nobody else is there yet (and the trip has no dates, nothing to match), it is one small line
 * that opens the form to appear, so the first traveller can still join.
 */
export function HereBox({ c, trip, here }: { c: CountryInfo; trip: TripCtx; here: Here | null }) {
  if (!trip.start || !trip.end) return null;
  const n = here?.count ?? 0;
  const join = (
    <form action={joinHere} className="mt-2 flex flex-col gap-2">
      <input type="hidden" name="tripId" value={trip.id} /><input type="hidden" name="country" value={c.code} />
      <input name="note" maxLength={200} placeholder="איך ליצור קשר, לא חובה (למשל אינסטגרם)"
        className="h-11 rounded-lg border border-line bg-white px-3 text-base" />
      <button className="min-h-11 rounded-lg bg-[#1B73C9] px-4 font-extrabold text-white">{n === 0 ? 'להופיע' : 'להופיע לישראלים שיהיו כאן ולראות מי הם'}</button>
      <p className="text-xs text-ink-2">רואים רק השם הפרטי, התאריכים ומה שכתבת כאן, ורק מי שגם בחר להופיע. אפשר להפסיק בכל רגע.</p>
    </form>
  );
  if (n === 0 && !here?.joined) {
    return (
      <details className="group mt-3 rounded-xl bg-[#EAF4FC] px-3.5" data-tour="here">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 py-2 text-sm font-bold [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1">🇮🇱 רוצה שישראלים שיגיעו לכאן בתאריכים שלך ימצאו אותך?</span>
          <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[#1B73C9] group-open:hidden">להופיע</span>
        </summary>
        <div className="pb-3.5">{join}</div>
      </details>
    );
  }
  return (
    <div className="mt-3 rounded-xl bg-[#EAF4FC] p-3.5" data-tour="here">
      <p className="font-extrabold">🇮🇱 ישראלים כאן</p>
      <p className="mt-1 text-sm text-ink-2">
        {n === 0 ? `עוד אין מטיילי YallaTrip שבחרו להופיע ב${c.he} בתאריכים שלך.` : `${n === 1 ? 'מטייל/ת ישראלי/ת אחד/ת' : `${n} מטיילים ישראלים`} ב-YallaTrip ${n === 1 ? 'יהיה' : 'יהיו'} ב${c.he} בתאריכים שלך (${formatDateRangeHe(trip.start, trip.end)}).`}
      </p>
      {here?.joined ? (
        <>
          {here.list.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1.5">
              {here.list.map((x, i) => (
                <li key={i} className="rounded-lg bg-white px-3 py-2 text-sm">
                  <b>{x.name}</b> <span className="text-ink-2">· {formatDateRangeHe(x.from, x.to)}</span>
                  {x.note && <span className="mt-0.5 block break-words">{x.note}</span>}
                </li>
              ))}
            </ul>
          )}
          <form action={leaveHere} className="mt-2">
            <input type="hidden" name="tripId" value={trip.id} /><input type="hidden" name="country" value={c.code} />
            <button className="min-h-10 text-sm font-bold text-[#B42318]">להפסיק להופיע</button>
          </form>
        </>
      ) : join}
    </div>
  );
}
