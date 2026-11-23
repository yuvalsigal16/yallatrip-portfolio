'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { DestinationInput } from '@/components/trips/DestinationInput';
import { ChoiceChip, ChoiceGroup } from '@/components/ChoiceChip';
import { TRANSPORTS, TRAVEL_STYLES } from '@/lib/auth/rules';
import type { FormState } from '@/lib/auth/rules';
import { formatLengthHe, MAX_TRIP_DAYS, tripLengthDays } from '@/lib/trips/rules';
import { datesFromNights, splitNights } from '@/lib/trips/chapters';
import { PACES } from '@/lib/planning/pace';
import { createQuickTrip } from '../actions';
import { TripObservance } from '@/components/trips/TripFormSections';
import { FEATURES } from '@/lib/features';

export type QuickDefaults = { destinationName: string; transport: string[]; styles: string[]; shabbat: boolean; kosher: boolean };

const WHO = [
  { key: 'solo', label: '🧍 לבד' },
  { key: 'couple', label: '💑 זוג' },
  { key: 'friends', label: '👯 חברים' },
  { key: 'family', label: '👨‍👩‍👧 משפחה עם ילדים' },
] as const;

const input = 'h-12 w-full rounded-xl border border-line bg-white px-3 text-base outline-none focus:border-ink focus:ring-2 focus:ring-ink/10 disabled:bg-sand-2 disabled:text-muted';
let nextKey = 1;

/**
 * A new trip on one screen: where (one place or a route of several), when, who and at what pace.
 * Several places: the nights are split between them by themselves (−/+ to change), so no dates per place.
 * Everything else (getting around, style, Shabbat and kosher) is optional, folded under "more"; the last two start from the profile.
 */
export function QuickTripForm({ defaults }: { defaults: QuickDefaults }) {
  const [state, action] = useActionState(createQuickTrip, {} as FormState);
  const [stops, setStops] = useState<{ key: number; label: string }[]>(() => [{ key: nextKey++, label: defaults.destinationName }]);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [noDates, setNoDates] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const len = !noDates && start && end ? tripLengthDays(start, end) : null;
  const validLen = len !== null && len >= 1 && len <= MAX_TRIP_DAYS ? len : null;
  const totalNights = validLen ? validLen - 1 : 0;
  const [nights, setNights] = useState<number[]>([]);
  // A new route or new dates: split the nights again, evenly.
  useEffect(() => setNights(splitNights(totalNights, stops.length)), [totalNights, stops.length]);
  const legDates = useMemo(
    () => (validLen && stops.length > 1 && nights.length === stops.length ? datesFromNights(start, nights) : []),
    [validLen, stops.length, nights, start],
  );
  const shift = (i: number, by: 1 | -1) => setNights((ns) => {
    // Take the night from (or give it to) the next place, or the previous one for the last place.
    const j = i < ns.length - 1 ? i + 1 : i - 1;
    if (j < 0 || ns[i]! + by < 1 || ns[j]! - by < 1) return ns;
    return ns.map((n, k) => (k === i ? n + by : k === j ? n - by : n));
  });
  const tooMany = validLen !== null && stops.length > 1 && totalNights < stops.length;
  const short = (d: string) => `${Number(d.slice(8, 10))}.${Number(d.slice(5, 7))}`;

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-8" noValidate>
      {state.error && <Alert>{state.error}</Alert>}

      <section className="flex flex-col gap-3" data-tour="nt-dest">
        <h2 className="text-xl font-extrabold">לאן? ✈️</h2>
        <ol className="flex flex-col gap-2.5">
          {stops.map((s, i) => (
            <li key={s.key} className="flex items-start gap-2">
              {stops.length > 1 && (
                <span className="mt-9 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-extrabold text-white" aria-hidden="true">{i + 1}</span>
              )}
              <div className="min-w-0 flex-1">
                <DestinationInput label={stops.length > 1 ? `עצירה ${i + 1}` : 'יעד'} defaultName={s.label}
                  error={i === 0 ? state.fieldErrors?.destinationName : undefined} autoFocus={i === 0 && !defaults.destinationName}
                  placeholder={i === 0 ? 'עיר, מדינה או אזור. למשל: תאילנד' : 'העצירה הבאה'}
                  onName={(name) => setStops((st) => st.map((x) => (x.key === s.key && x.label !== name ? { ...x, label: name } : x)))} />
              </div>
              {stops.length > 1 && (
                <button type="button" onClick={() => setStops((st) => st.filter((x) => x.key !== s.key))} aria-label={`הסרת עצירה ${i + 1}`}
                  className="mt-8 h-11 w-10 shrink-0 rounded-lg font-bold text-danger hover:bg-sand">✕</button>
              )}
            </li>
          ))}
        </ol>
        <button type="button" data-tour="nt-add" onClick={() => setStops((st) => [...st, { key: nextKey++, label: '' }])}
          className="self-start rounded-xl border-2 border-dashed border-terracotta px-4 py-2 text-[15px] font-bold text-terracotta hover:bg-white">
          + עוד עצירה במסלול
        </button>
        <p className="text-sm text-muted">טיול ארוך עם כמה מקומות? מוסיפים אותם לפי הסדר, והלילות מתחלקים לבד.</p>
      </section>

      <section className="flex flex-col gap-3" data-tour="nt-dates">
        <h2 className="text-xl font-extrabold">מתי? 📅</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex min-w-0 flex-col gap-1.5 text-sm font-bold">יוצאים
            <input type="date" name="startDate" dir="ltr" value={noDates ? '' : start} disabled={noDates} className={`${input} date-center`}
              onChange={(e) => { setStart(e.target.value); if (!end || e.target.value > end) setEnd(e.target.value); }} />
          </label>
          <label className="flex min-w-0 flex-col gap-1.5 text-sm font-bold">חוזרים
            <input type="date" name="endDate" dir="ltr" value={noDates ? '' : end} min={start || undefined} disabled={noDates} className={`${input} date-center`}
              onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>
        {(state.fieldErrors?.startDate || state.fieldErrors?.endDate || state.fieldErrors?.legs) && (
          <p role="alert" className="text-sm font-semibold text-danger">{state.fieldErrors?.legs || state.fieldErrors?.startDate || state.fieldErrors?.endDate}</p>
        )}
        {validLen && <p className="text-[15px] font-bold text-ink-2" aria-live="polite">{formatLengthHe(validLen)}</p>}
        <label data-tour="nt-nodates" className="flex min-h-11 w-fit cursor-pointer items-center gap-2.5 text-[15px] font-semibold">
          <input type="checkbox" name="noDates" checked={noDates} onChange={(e) => setNoDates(e.target.checked)} className="h-5 w-5 accent-[#0C2D4A]" />
          עוד אין תאריכים
        </label>

        {legDates.length > 0 && !tooMany && (
          <div className="rounded-2xl border border-line bg-sand/60 p-3" data-tour="nt-split">
            <p className="text-sm font-extrabold">כמה לילות בכל מקום</p>
            <p className="text-xs text-muted">חילקנו שווה בשווה. אפשר לשנות עכשיו או בכל רגע בהמשך.</p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {stops.map((s, i) => (
                <li key={s.key} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{s.label.trim() || `עצירה ${i + 1}`}
                    <span className="mr-1 font-normal text-muted" dir="ltr">{short(legDates[i]!.start)}–{short(legDates[i]!.end)}</span>
                  </span>
                  <button type="button" onClick={() => shift(i, -1)} aria-label={`לילה אחד פחות בעצירה ${i + 1}`} className="h-9 w-9 rounded-full border border-line text-lg font-bold">−</button>
                  <span className="w-16 text-center text-sm font-extrabold">{nights[i]} לילות</span>
                  <button type="button" onClick={() => shift(i, 1)} aria-label={`לילה אחד יותר בעצירה ${i + 1}`} className="h-9 w-9 rounded-full border border-line text-lg font-bold">+</button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {tooMany && <p role="alert" className="text-sm font-semibold text-danger">יש יותר עצירות מלילות בטיול. כדאי להאריך את התאריכים או להוריד עצירה.</p>}
        {nights.length === stops.length && stops.length > 1 && !noDates && nights.map((n, i) => <input key={i} type="hidden" name="legNights" value={n} />)}
      </section>

      <ChoiceGroup title="מי נוסע? 🧳">
        {WHO.map((w) => <ChoiceChip key={w.key} type="radio" name="who" value={w.key} label={w.label} defaultChecked={w.key === 'couple'} />)}
      </ChoiceGroup>

      {FEATURES.pace && (
        <ChoiceGroup title="באיזה קצב?" help="כמה דברים ביום. אפשר לשנות בכל רגע">
          {PACES.map((x) => <ChoiceChip key={x.key} type="radio" name="pace" value={x.key} label={`${x.emoji} ${x.label}`} defaultChecked={x.key === 'normal'} />)}
        </ChoiceGroup>
      )}

      <details className="rounded-2xl border border-line bg-white p-4">
        <summary className="cursor-pointer text-[15px] font-extrabold">עוד העדפות (לא חובה)</summary>
        <div className="mt-5 flex flex-col gap-7">
          <ChoiceGroup title="איך זזים ביעד?" help="לחישוב זמני הגעה. אפשר לבחור כמה">
            {TRANSPORTS.map((t) => <ChoiceChip key={t.key} type="checkbox" name="transport" value={t.key} label={t.label} defaultChecked={defaults.transport.includes(t.key)} />)}
          </ChoiceGroup>
          <ChoiceGroup title="מה בא לכם?" help="אפשר לבחור כמה">
            {TRAVEL_STYLES.filter((s) => s.key !== 'family').map((s) => <ChoiceChip key={s.key} type="checkbox" name="styles" value={s.key} label={s.label} defaultChecked={defaults.styles.includes(s.key)} />)}
          </ChoiceGroup>
          <TripObservance shabbat={defaults.shabbat} kosher={defaults.kosher} />
        </div>
      </details>

      <div className="sticky bottom-0 -mx-5 flex gap-3 border-t border-line bg-white px-5 py-3 sm:static sm:mx-0 sm:border-0 sm:p-0">
        <SubmitButton pendingText="בונים את הטיול...">יוצאים לדרך ✨</SubmitButton>
      </div>
    </form>
  );
}
