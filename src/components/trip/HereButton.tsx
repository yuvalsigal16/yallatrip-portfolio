'use client';

import { useState } from 'react';
import { placesHere, type HerePlace } from '@/app/trips/places-actions';
import type { PlanDay } from '@/lib/planning/queries';

type State =
  | { kind: 'idle' }
  | { kind: 'locating' }
  | { kind: 'list'; places: HerePlace[] }
  | { kind: 'error'; text: string };

const todayLocal = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in the traveler's own time zone

/**
 * "I'm here": uses the phone's location to find the place the traveler is standing in
 * (the café on a food tour...), and saves it to the trip and to today's day in one tap.
 */
export function HereButton({ tripId, days, onAdd }: {
  tripId: string;
  days: PlanDay[];
  onAdd: (googlePlaceId: string, dayId: string | null) => Promise<boolean>;
}) {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [adding, setAdding] = useState<string | null>(null);
  const todayDay = days.find((d) => d.date === todayLocal()) ?? null;
  const [dayId, setDayId] = useState<string>('');

  const locate = () => {
    if (!('geolocation' in navigator)) return setState({ kind: 'error', text: 'הדפדפן הזה לא יודע לשתף מיקום.' });
    setDayId(todayDay?.id ?? '');
    setState({ kind: 'locating' });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const r = await placesHere({ tripId, lat: pos.coords.latitude, lng: pos.coords.longitude });
        if (!r.ok) return setState({ kind: 'error', text: r.error });
        if (!r.data.length) return setState({ kind: 'error', text: 'לא מצאנו מקומות ממש לידך. אפשר לחפש את המקום בשם במפה.' });
        setState({ kind: 'list', places: r.data });
      },
      (err) => setState({
        kind: 'error',
        text: err.code === err.PERMISSION_DENIED
          ? 'צריך לאשר לדפדפן גישה למיקום (בהגדרות האתר), ואז לנסות שוב.'
          : 'לא הצלחנו לקבל את המיקום. נסי שוב בעוד רגע, רצוי בחוץ או ליד חלון.',
      }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  };

  const pick = async (p: HerePlace) => {
    setAdding(p.googlePlaceId);
    const ok = await onAdd(p.googlePlaceId, dayId || null);
    setAdding(null);
    if (ok) setState({ kind: 'idle' });
  };

  return (
    <>
      <button type="button" onClick={locate} disabled={state.kind === 'locating'}
        className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-terracotta px-4 font-bold text-white shadow-sm hover:brightness-110 disabled:opacity-70">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3.5" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="8" />
        </svg>
        {state.kind === 'locating' ? 'מאתרים את המיקום שלך…' : 'אני כאן: הוספת המקום שאני נמצאת בו'}
      </button>

      {(state.kind === 'list' || state.kind === 'error') && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="here-title"
          onClick={(e) => e.target === e.currentTarget && setState({ kind: 'idle' })}>
          <div className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl">
            <div className="flex items-start justify-between gap-3">
              <h2 id="here-title" className="text-xl font-extrabold">{state.kind === 'list' ? 'איפה את עכשיו?' : 'אני כאן'}</h2>
              <button type="button" onClick={() => setState({ kind: 'idle' })} aria-label="סגירה" className="h-9 w-9 rounded-full text-lg font-bold hover:bg-sand">✕</button>
            </div>

            {state.kind === 'error' ? (
              <p role="alert" className="mt-3 text-ink-2">{state.text}</p>
            ) : (
              <>
                {days.length > 0 && (
                  <label className="mt-3 flex flex-col gap-1 text-sm font-bold">להוסיף ליום
                    <select value={dayId} onChange={(e) => setDayId(e.target.value)}
                      className="h-11 rounded-lg border border-line bg-white px-2 text-base font-normal">
                      <option value="">רק לשמורים, בלי יום</option>
                      {days.map((d) => (
                        <option key={d.id} value={d.id}>יום {d.dayIndex}{d.date === todayLocal() ? ' · היום' : ''}</option>
                      ))}
                    </select>
                  </label>
                )}
                <p className="mt-3 text-sm text-ink-2">המקומות הכי קרובים אלייך. בחרי את המקום שאת נמצאת בו:</p>
                <ul className="mt-2 flex flex-col gap-2">
                  {state.places.map((p) => (
                    <li key={p.googlePlaceId}>
                      <button type="button" disabled={adding !== null} onClick={() => pick(p)}
                        className="flex w-full items-center gap-3 rounded-xl border border-line p-3 text-right hover:bg-sand disabled:opacity-60">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-extrabold">{p.name}</span>
                          {p.address && <span className="block truncate text-sm text-ink-2">{p.address}</span>}
                        </span>
                        <span className="shrink-0 text-sm font-bold text-terracotta">
                          {adding === p.googlePlaceId ? 'מוסיפים…' : p.distance !== null ? `${p.distance} מ׳` : ''}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
