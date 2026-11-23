'use client';

import { useState } from 'react';
import { DestinationInput } from '@/components/trips/DestinationInput';
import { formatLengthHe, MAX_TRIP_DAYS, tripLengthDays } from '@/lib/trips/rules';

type Row = { key: number; name: string; placeId: string; start: string; end: string };
let nextKey = 1;
const row = (name = '', placeId = '', start = '', end = ''): Row => ({ key: nextKey++, name, placeId, start, end });

const input = 'date-center h-12 w-full rounded-xl border border-line bg-white px-1.5 text-base outline-none focus:border-ink focus:ring-2 focus:ring-ink/10 disabled:bg-sand-2 disabled:text-muted';

/**
 * Where and when: one destination, or several (Argentina in January, then Brazil in February).
 * Every destination is equal and has its own dates; the trip runs from the first date to the last.
 * Each row sends destinationName / placeId (with search-as-you-type) and legStart / legEnd.
 * The trip's overall dates go in hidden startDate / endDate.
 */
export function DestinationsList({
  defaultItems, defaultNoDates = false, errors = {}, autoFocus,
}: {
  defaultItems: { name: string; placeId?: string; start: string | null; end: string | null }[];
  defaultNoDates?: boolean;
  errors?: Partial<Record<string, string>>;
  autoFocus?: boolean;
}) {
  const [rows, setRows] = useState<Row[]>(() => {
    const items = defaultItems.length ? defaultItems : [{ name: '', start: null, end: null }];
    return items.map((d) => row(d.name, d.placeId ?? '', d.start ?? '', d.end ?? ''));
  });
  const [noDates, setNoDates] = useState(defaultNoDates);
  const set = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const move = (i: number, by: -1 | 1) => setRows((rs) => {
    const j = i + by;
    if (j < 0 || j >= rs.length) return rs;
    const copy = [...rs];
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
    return copy;
  });

  const starts = rows.map((r) => r.start).filter(Boolean).sort();
  const ends = rows.map((r) => r.end || r.start).filter(Boolean).sort();
  const tripStart = noDates ? '' : starts[0] ?? '';
  const tripEnd = noDates ? '' : ends[ends.length - 1] ?? '';
  const len = tripStart && tripEnd ? tripLengthDays(tripStart, tripEnd) : null;
  const dateError = errors.startDate || errors.endDate;

  return (
    <div className="flex flex-col gap-4">
      <input type="hidden" name="startDate" value={tripStart} />
      <input type="hidden" name="endDate" value={tripEnd} />

      <ol className="flex flex-col gap-3">
        {rows.map((r, i) => (
          <li key={r.key} data-tour={i === 0 ? "nt-dest" : undefined} className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-3 sm:p-4">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <DestinationInput label={rows.length > 1 ? `יעד ${i + 1}` : 'יעד'} defaultName={r.name} defaultPlaceId={r.placeId}
                  error={i === 0 ? errors.destinationName : undefined} autoFocus={autoFocus && i === 0}
                  placeholder={i === 0 ? 'עיר, מדינה או אזור. למשל: ארגנטינה' : 'היעד הבא. למשל: ברזיל'} />
              </div>
              {rows.length > 1 && (
                <div className="mt-7 flex shrink-0">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="להזיז למעלה"
                    className="h-10 w-8 rounded-lg text-ink-2 hover:bg-sand disabled:opacity-30">▲</button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="להזיז למטה"
                    className="h-10 w-8 rounded-lg text-ink-2 hover:bg-sand disabled:opacity-30">▼</button>
                  <button type="button" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} aria-label={`הסרת יעד ${i + 1}`}
                    className="h-10 w-8 rounded-lg font-bold text-danger hover:bg-sand">✕</button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3" data-tour={i === 0 ? "nt-dates" : undefined}>
              <label className="flex min-w-0 flex-col gap-1.5 text-sm font-bold">
                {i === 0 ? 'יציאה' : 'מתאריך'}
                <input type="date" name="legStart" dir="ltr" value={noDates ? '' : r.start} disabled={noDates} className={input}
                  onChange={(e) => set(r.key, { start: e.target.value, end: !r.end || e.target.value > r.end ? e.target.value : r.end })} />
              </label>
              <label className="flex min-w-0 flex-col gap-1.5 text-sm font-bold">
                {i === rows.length - 1 ? 'חזרה' : 'עד תאריך'}
                <input type="date" name="legEnd" dir="ltr" value={noDates ? '' : r.end} min={r.start || undefined} disabled={noDates} className={input}
                  onChange={(e) => set(r.key, { end: e.target.value })} />
              </label>
            </div>
          </li>
        ))}
      </ol>

      <button type="button" data-tour="nt-add"
        onClick={() => setRows((rs) => {
          const last = rs[rs.length - 1];
          // The next destination usually starts the day the previous one ends.
          const from = last?.end || last?.start || '';
          return [...rs, row('', '', from, from)];
        })}
        className="self-start rounded-xl border-2 border-dashed border-terracotta px-4 py-2.5 font-bold text-terracotta hover:bg-white">
        + הוספת יעד נוסף לטיול
      </button>

      {(dateError || errors.legs) && (
        <p role="alert" className="text-sm font-semibold text-danger">{errors.legs || dateError}</p>
      )}

      <p className="min-h-6 text-[15px] font-bold text-ink-2" aria-live="polite">
        {!noDates && len !== null && len >= 1 && len <= MAX_TRIP_DAYS
          ? `${rows.length > 1 ? `${rows.length} יעדים · ` : ''}${formatLengthHe(len)} · ${len} ימי תכנון ייווצרו אוטומטית`
          : ''}
      </p>

      <label data-tour="nt-nodates" className="flex min-h-11 w-fit cursor-pointer items-center gap-2.5 text-[15px] font-semibold">
        <input type="checkbox" name="noDates" checked={noDates} onChange={(e) => setNoDates(e.target.checked)}
          className="h-5 w-5 accent-[#0C2D4A]" />
        עוד אין תאריכים. אוסיף אחר כך
      </label>
    </div>
  );
}
