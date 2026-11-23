'use client';

import { useState } from 'react';
import { formatLengthHe, MAX_TRIP_DAYS, tripLengthDays } from '@/lib/trips/rules';

/** Departure + return dates (native date pickers), "no dates yet", and a live "6 days · 5 nights". */
export function DatesFields({
  defaultStart = '', defaultEnd = '', defaultNoDates = false, startError, endError,
}: {
  defaultStart?: string; defaultEnd?: string; defaultNoDates?: boolean; startError?: string; endError?: string;
}) {
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [noDates, setNoDates] = useState(defaultNoDates);
  const len = start && end ? tripLengthDays(start, end) : null;

  const input = (err?: string) =>
    `date-center h-12 w-full rounded-xl border bg-white px-3.5 text-base outline-none focus:border-ink focus:ring-2 focus:ring-ink/10 disabled:bg-sand-2 disabled:text-muted ${err ? 'border-danger' : 'border-line'}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor="startDate" className="text-sm font-bold">יציאה</label>
          <input id="startDate" name="startDate" type="date" value={start} disabled={noDates}
            onChange={(e) => {
              setStart(e.target.value);
              if (!end || e.target.value > end) setEnd(e.target.value);
            }}
            aria-invalid={startError ? true : undefined} className={input(startError)} />
          {startError && !noDates && <p className="text-sm font-semibold text-danger">{startError}</p>}
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor="endDate" className="text-sm font-bold">חזרה</label>
          <input id="endDate" name="endDate" type="date" value={end} min={start || undefined} disabled={noDates}
            onChange={(e) => setEnd(e.target.value)}
            aria-invalid={endError ? true : undefined} className={input(endError)} />
          {endError && !noDates && <p className="text-sm font-semibold text-danger">{endError}</p>}
        </div>
      </div>

      <p className="min-h-6 text-[15px] font-bold text-ink-2" aria-live="polite">
        {!noDates && len !== null && len >= 1 && len <= MAX_TRIP_DAYS
          ? `${formatLengthHe(len)} · ${len} ימי תכנון ייווצרו אוטומטית`
          : ''}
      </p>

      <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[15px] font-semibold">
        <input type="checkbox" name="noDates" checked={noDates} onChange={(e) => setNoDates(e.target.checked)}
          className="h-5 w-5 accent-[#0C2D4A]" />
        עוד אין תאריכים. אוסיף אחר כך
      </label>
    </div>
  );
}
