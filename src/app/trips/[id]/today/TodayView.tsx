'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { chooseAlt, removeStop, setStopDone } from '@/app/trips/plan-actions';
import { DAY_LIMITS, fromMinutes, toMinutes } from '@/lib/planning/rules';
import { insideShabbat, shabbatInfo, shabbatLineHe } from '@/lib/shabbat';
import { formatDayHe } from '@/lib/trips/rules';

export type TodayStop = {
  id: string; savedPlaceId: string; label: string; category: string; time: string | null; stayMin: number; note: string | null;
  lat: number; lng: number; gpid: string; visited: boolean; isMust: boolean;
  /** Places still undecided for this slot ("this or that"). */
  alts: { id: string; label: string }[];
};
export type TodayBooking = { id: string; icon: string; title: string; time: string | null; confirmation: string | null; note: string | null; hasFile: boolean };
export type TodayDay = { id: string; index: number; date: string | null; title: string | null; notes: string | null; stops: TodayStop[]; bookings: TodayBooking[] };

const localToday = () => new Date().toLocaleDateString('en-CA');
const card = 'rounded-2xl border border-line bg-white p-4';
const pillLink = 'inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-white px-4 text-sm font-bold text-ink no-underline';

type Props = {
  tripId: string; title: string; days: TodayDay[]; travelMode: 'walking' | 'driving' | 'transit';
  keepsShabbat?: boolean; center?: { lat: number; lng: number } | null;
};

export function TodayView({ tripId, title, days, travelMode, keepsShabbat, center }: Props) {
  // The phone's own date decides which day is "today"; before or after the trip the nearest day is shown.
  const [today, setToday] = useState<string | null>(null);
  const [at, setAt] = useState(0);
  const [visited, setVisitedIds] = useState<Set<string>>(() => new Set(days.flatMap((d) => d.stops.filter((s) => s.visited).map((s) => s.id))));
  const [error, setError] = useState<string | null>(null);
  // "I'm running late": how many minutes the rest of today moves, on this screen only (the saved plan stays).
  const [late, setLate] = useState<{ dayId: string; min: number } | null>(null);
  const [onTime, setOnTime] = useState(false);
  const [dropped, setDropped] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const router = useRouter();

  // The tick belongs to one line of the day: a hotel that appears three times is ticked one line at a time.
  // Once, when the screen opens: saving "I was here" refreshes the data, and that must not jump back to today.
  useEffect(() => {
    const t = localToday();
    setToday(t);
    const exact = days.findIndex((d) => d.date === t);
    const firstLater = days.findIndex((d) => !!d.date && d.date > t);
    setAt(exact >= 0 ? exact : firstLater >= 0 ? firstLater : Math.max(0, days.length - 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = days[at];
  const day = useMemo(() => (shown ? { ...shown, stops: shown.stops.filter((s) => !dropped.has(s.id)) } : undefined), [shown, dropped]);
  const next = useMemo(() => day?.stops.find((s) => !visited.has(s.id)) ?? null, [day, visited]);
  const nav = (s: TodayStop) =>
    `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}&destination_place_id=${encodeURIComponent(s.gpid)}&travelmode=${travelMode}`;

  const toggle = (s: TodayStop) => {
    const now = !visited.has(s.id);
    setError(null);
    setVisitedIds((cur) => { const n = new Set(cur); if (now) n.add(s.id); else n.delete(s.id); return n; });
    start(async () => {
      const r = await setStopDone({ tripId, stopId: s.id, done: now }).catch(() => null);
      if (!r || !r.ok) {
        setVisitedIds((cur) => { const n = new Set(cur); if (now) n.delete(s.id); else n.add(s.id); return n; });
        setError('לא נשמר. בדקו את החיבור ונסו שוב.');
      }
    });
  };

  if (!day) {
    return (
      <div className="app-skin mx-auto flex max-w-[640px] flex-col gap-4 px-4 pb-16 pt-4">
        <div><a href={`/trips/${tripId}`} className={pillLink}>→ חזרה לטיול</a></div>
        <div className={card}><h1 className="text-2xl font-black">{title}</h1><p className="mt-1 text-ink-2">לטיול עוד אין ימים. קובעים תאריכים ב"הגדרות טיול".</p></div>
      </div>
    );
  }

  const isToday = !!today && day.date === today;
  const when = !today || !day.date ? '' : isToday ? 'היום' : day.date > today ? 'עוד לא הגענו ליום הזה' : 'היום הזה כבר עבר';
  const allDone = day.stops.length > 0 && !next;

  // The trip is under way by the phone's date: only then "running late" and the Shabbat times appear.
  const dated = days.filter((d) => d.date).map((d) => d.date!);
  const onTrip = !!today && dated.length > 0 && today >= dated[0]! && today <= dated[dated.length - 1]!;
  const spot = day.stops[0] ?? center ?? null;
  const holy = keepsShabbat && onTrip && spot ? shabbatInfo(day.date, spot.lat, spot.lng) : null;

  const shift = isToday && late?.dayId === day.id ? (late?.min ?? 0) : 0;
  const left = day.stops.filter((s) => !visited.has(s.id));
  const timeOf = (s: TodayStop) => {
    const m = toMinutes(s.time);
    return m === null || !shift || visited.has(s.id) ? s.time : fromMinutes(Math.min(m + shift, 23 * 60 + 59));
  };
  const limit = DAY_LIMITS.latestEnd;
  const last = left[left.length - 1];
  const endsAt = last && toMinutes(last.time) !== null ? toMinutes(last.time)! + shift + last.stayMin : null;
  // What could be given up so the day still ends on time: from the end of the day back, never a "must" and never the next stop.
  const giveUp: TodayStop[] = [];
  if (shift && endsAt !== null && endsAt > limit) {
    let over = endsAt - limit;
    for (const s of [...left].reverse()) {
      if (over <= 0) break;
      if (s.isMust || s.id === next?.id) continue;
      giveUp.push(s);
      over -= s.stayMin;
    }
  }
  const runLate = () => {
    const planned = toMinutes(next?.time);
    if (!next || planned === null) return;
    const now = new Date();
    const min = now.getHours() * 60 + now.getMinutes() - planned;
    if (min < 10) { setLate(null); setOnTime(true); return; }
    setOnTime(false);
    setLate({ dayId: day.id, min });
  };
  // "This or that": the decision. The chosen place takes the line; the other leaves the day and stays saved.
  const choose = (s: TodayStop, altId: string | null) => {
    setError(null);
    start(async () => {
      const r = await chooseAlt({ tripId, stopId: s.id, altId }).catch(() => null);
      if (!r || !r.ok) { setError('הבחירה לא נשמרה. בדקו את החיבור ונסו שוב.'); return; }
      router.refresh();
    });
  };
  const alts = (s: TodayStop, dark: boolean) => s.alts.length > 0 && (
    <div className={`mt-2 flex flex-col gap-1.5 rounded-xl p-2.5 text-sm ${dark ? 'bg-white/15' : 'bg-[#FFF8EA]'}`} data-tour="t-alt">
      <p className="font-bold">🤔 מתלבטת? לאן הולכים:</p>
      <div className="flex flex-wrap gap-1.5">
        {[{ id: null as string | null, label: s.label }, ...s.alts].map((o) => (
          <button key={o.id ?? 'keep'} type="button" disabled={pending} onClick={() => choose(s, o.id)}
            className={`min-h-10 rounded-full border px-3 text-sm font-bold disabled:opacity-60 ${dark ? 'border-white/60 bg-white text-[#0B3D6E]' : 'border-line bg-white text-ink'}`}>{o.label}</button>
        ))}
      </div>
    </div>
  );
  const drop = (s: TodayStop) => {
    setError(null);
    setDropped((cur) => new Set(cur).add(s.id));
    start(async () => {
      const r = await removeStop({ tripId, stopId: s.id }).catch(() => null);
      if (!r || !r.ok) {
        setDropped((cur) => { const n = new Set(cur); n.delete(s.id); return n; });
        setError('לא הוסר. בדקו את החיבור ונסו שוב.');
      }
    });
  };

  return (
    <div className="app-skin mx-auto flex max-w-[640px] flex-col gap-4 px-4 pb-16 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <a href={`/trips/${tripId}`} className={pillLink}>→ חזרה לטיול</a>
        <a href={`/trips/${tripId}?tab=map&day=${day.id}`} className={pillLink}>היום במפה</a>
        <a href={`/trips/${tripId}?tab=days&day=${day.id}`} className={pillLink}>עריכת היום</a>
      </div>

      <header className="flex items-center justify-between gap-2" data-tour="t-day">
        <button type="button" onClick={() => setAt((v) => Math.max(0, v - 1))} disabled={at === 0} aria-label="היום הקודם"
          className="h-11 w-11 shrink-0 rounded-full border border-line bg-white text-xl font-bold disabled:opacity-30">›</button>
        <div className="min-w-0 text-center">
          <p className="text-sm font-bold text-terracotta">{title}{when && ` · ${when}`}</p>
          <h1 className="font-display text-2xl font-black">יום {day.index} מתוך {days.length}</h1>
          <p className="text-ink-2">{formatDayHe(day.date) ?? 'בלי תאריך'}{day.title ? ` · ${day.title}` : ''}</p>
        </div>
        <button type="button" onClick={() => setAt((v) => Math.min(days.length - 1, v + 1))} disabled={at === days.length - 1} aria-label="היום הבא"
          className="h-11 w-11 shrink-0 rounded-full border border-line bg-white text-xl font-bold disabled:opacity-30">‹</button>
      </header>

      {next && (
        <section className="rounded-2xl bg-gradient-to-l from-[#1B73C9] to-[#2E9BDB] p-4 text-white shadow-[0_14px_30px_-14px_rgba(27,115,201,.8)]" aria-labelledby="t-next" data-tour="t-next">
          <p id="t-next" className="text-sm font-bold text-white/85">התחנה הבאה{next.time && <> · <span dir="ltr">{timeOf(next)}</span></>}</p>
          <p className="mt-0.5 text-2xl font-black leading-tight">{next.label}</p>
          <p className="text-sm text-white/85">{next.category} · כ-{next.stayMin} דק׳</p>
          {next.note && <p className="mt-1 whitespace-pre-line text-sm text-white/90">{next.note}</p>}
          {alts(next, true)}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a href={nav(next)} target="_blank" rel="noopener noreferrer"
              className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-4 font-extrabold text-[#0B3D6E] no-underline">🧭 ניווט</a>
            <button type="button" onClick={() => toggle(next)}
              className="min-h-12 rounded-full border border-white/60 bg-white/15 px-4 font-extrabold text-white">✓ הייתי כאן</button>
          </div>
        </section>
      )}
      {isToday && next?.time && (
        <section className={`${card} flex flex-col gap-2`} aria-label="אני באיחור" data-tour="t-late">
          {!shift ? (
            <>
              <button type="button" onClick={runLate} className="min-h-11 rounded-full border border-line bg-white px-4 font-extrabold text-ink">⏱️ אני באיחור</button>
              {onTime && <p role="status" className="text-sm font-bold text-[#2F6B3A]">לפי השעה עכשיו אתם בזמן לתחנה הבאה.</p>}
            </>
          ) : (
            <div role="status" className="flex flex-col gap-2 text-sm">
              <p className="font-extrabold">איחור של {shift >= 60 ? `${Math.floor(shift / 60)} שע׳${shift % 60 ? ` ו-${shift % 60} דק׳` : ''}` : `${shift} דק׳`}. הזזנו את שאר התחנות של היום בהתאם.</p>
              {endsAt !== null && <p>היום ייגמר בסביבות <b dir="ltr">{fromMinutes(Math.min(endsAt, 23 * 60 + 59))}</b>{endsAt > limit ? ', מאוחר מדי.' : ', עדיין בזמן סביר.'}</p>}
              {giveUp.length > 0 && (
                <>
                  <p className="font-bold">כדי לסיים בזמן אפשר לוותר על:</p>
                  <ul className="flex flex-col gap-1.5">
                    {giveUp.map((s) => (
                      <li key={s.id} className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 font-bold">{s.label} <span className="font-normal text-muted">· כ-{s.stayMin} דק׳</span></span>
                        <button type="button" onClick={() => drop(s)} className="min-h-10 shrink-0 rounded-full border border-line bg-white px-3 text-sm font-bold">הסרה מהיום</button>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted">מקום שהוסר מהיום נשאר שמור בטיול, ואפשר לשבץ אותו ביום אחר. מקומות חובה לא מוצעים להסרה.</p>
                </>
              )}
              {endsAt !== null && endsAt > limit && giveUp.length === 0 && <p>כל מה שנשאר מסומן כחובה, אז לא הצענו על מה לוותר.</p>}
              <p className="text-xs text-muted">השעות החדשות מוצגות במסך הזה בלבד. התוכנית השמורה לא השתנתה.</p>
              <button type="button" onClick={() => setLate(null)} className="min-h-10 self-start rounded-full border border-line bg-white px-4 text-sm font-bold">ביטול, חזרה לשעות המקוריות</button>
            </div>
          )}
        </section>
      )}
      {holy && <p role="status" data-tour="t-shabbat" className="rounded-2xl border border-[#BFD9F2] bg-[#F1F7FD] px-4 py-3 text-sm font-bold text-[#0B3D6E]">🕯️ {shabbatLineHe(holy)}</p>}
      {allDone && <p className="rounded-2xl bg-[#E3F0E3] px-4 py-3 font-bold text-[#2F6B3A]">✓ סיימת את כל התחנות של היום הזה.</p>}
      {error && <p role="alert" className="rounded-xl bg-[#FDECEA] px-3 py-2 text-sm font-bold text-[#B42318]">{error}</p>}

      {day.notes && <p className={`${card} whitespace-pre-line`}>📝 {day.notes}</p>}

      {day.bookings.length > 0 && (
        <section className={`${card} flex flex-col gap-2`} aria-labelledby="t-book" data-tour="t-bookings">
          <h2 id="t-book" className="text-lg font-extrabold">ההזמנות של היום</h2>
          <ul className="flex flex-col gap-2">
            {day.bookings.map((b) => (
              <li key={b.id} className="flex gap-2.5">
                <span className="text-xl" aria-hidden="true">{b.icon}</span>
                <span className="min-w-0">
                  <b>{b.title}</b>{b.time && <> · <span dir="ltr">{b.time}</span></>}
                  {b.confirmation && <span className="block text-sm">אישור: <span dir="ltr" className="rounded-md bg-sand-2 px-2 py-0.5 font-bold tracking-wide">{b.confirmation}</span></span>}
                  {b.note && <span className="block whitespace-pre-line text-sm text-ink-2">{b.note}</span>}
                  {b.hasFile && <a href={`/trips/${tripId}/bookings`} className="block text-sm font-bold">📎 לקובץ המצורף</a>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={`${card} flex flex-col gap-2`} aria-labelledby="t-stops" data-tour="t-stops">
        <h2 id="t-stops" className="text-lg font-extrabold">כל התחנות</h2>
        {day.stops.length === 0 ? (
          <p className="text-ink-2">יום חופשי, עוד לא שובצו מקומות. <a href={`/trips/${tripId}?tab=days&day=${day.id}`} className="font-bold">הוספת מקומות ליום</a></p>
        ) : (
          <ol className="flex flex-col divide-y divide-line">
            {day.stops.map((s) => {
              const done = visited.has(s.id);
              return (
                <li key={s.id} className="py-2.5">
                  <div className="flex items-center gap-3">
                  <span className="w-12 shrink-0 text-sm font-bold tabular-nums text-ink-2" dir="ltr">{timeOf(s)}</span>
                  <span className={`min-w-0 flex-1 ${done ? 'text-muted line-through' : ''}`}>
                    <span className="block font-bold">{s.label}</span>
                    <span className="block text-sm text-muted">{s.category}{insideShabbat(holy, timeOf(s)) && <b className="text-[#0B3D6E]"> · בזמן {holy!.name}</b>}</span>
                  </span>
                  <a href={nav(s)} target="_blank" rel="noopener noreferrer" aria-label={`ניווט אל ${s.label}`}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-white text-lg no-underline">🧭</a>
                  <button type="button" onClick={() => toggle(s)} aria-pressed={done} aria-label={done ? `ביטול "הייתי כאן" עבור ${s.label}` : `הייתי ב${s.label}`}
                    className={`h-11 w-11 shrink-0 rounded-full border text-lg font-bold ${done ? 'border-[#3F7F4A] bg-[#E3F0E3] text-[#3F7F4A]' : 'border-line bg-white text-ink-2'}`}>✓</button>
                  </div>
                  {!done && s.id !== next?.id && alts(s, false)}
                </li>
              );
            })}
          </ol>
        )}
        <p className="text-xs text-muted">שעה בלי שעה שקבעתם היא הערכה. הניווט נפתח ב-Google Maps.</p>
      </section>

      <a href={`/trips/${tripId}/plan`} className={pillLink}>התוכנית המלאה של הטיול</a>
    </div>
  );
}
