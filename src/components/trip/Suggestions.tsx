'use client';

import { useState } from 'react';
import type { NearbyPlace } from '@/lib/google/mappers';
import type { PlanDay } from '@/lib/planning/queries';
import { formatDistanceHe } from '@/lib/geo';

// Three helpers for the trip screen: "with kids" switch, "rainy day" alternatives, and
// "what now?" for spontaneous moments. All use real places from Google around a point.

type LatLng = { lat: number; lng: number };
const todayLocal = () => new Date().toLocaleDateString('en-CA');

async function around(center: LatLng, category: string, radius: number): Promise<NearbyPlace[]> {
  const res = await fetch('/api/places/nearby', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat: center.lat, lng: center.lng, category, radius }),
  });
  const body = (await res.json().catch(() => ({}))) as { places?: NearbyPlace[]; error?: string };
  if (!res.ok) throw new Error(body.error ?? 'לא הצלחנו לטעון המלצות');
  return body.places ?? [];
}

const best = (list: NearbyPlace[]) => [...list].sort((a, b) =>
  (b.rating ?? 0) * Math.log10((b.ratingCount ?? 0) + 10) - (a.rating ?? 0) * Math.log10((a.ratingCount ?? 0) + 10));

/** Trip with children: every recommendation leans to places that suit kids. A small chip, on or off. */
export function KidsToggle({ value, onChange, busy }: { value: boolean; onChange: (v: boolean) => void; busy: boolean }) {
  return (
    <button type="button" aria-pressed={value} disabled={busy} onClick={() => onChange(!value)}
      className={`inline-flex min-h-8 items-center gap-1 rounded-full border px-3 text-xs font-bold transition ${value ? 'border-terracotta bg-terracotta text-white' : 'border-line bg-white text-ink-2 hover:text-terracotta'}`}>
      🧒 עם ילדים{value && ' ✓'}
    </button>
  );
}

type Sheet = { title: string; intro?: string; warn?: string; status: 'loading' | 'done' | 'error'; places: NearbyPlace[]; error?: string };

function SuggestSheet({ sheet, days, dayId, setDayId, onClose, onAdd, onOpen, rain }: {
  /** "It's raining" switch inside the sheet: turns the list into indoor places. */
  rain?: { on: boolean; set: (v: boolean) => void };
  sheet: Sheet; days: PlanDay[]; dayId: string; setDayId: (v: string) => void;
  onClose: () => void; onAdd: (googlePlaceId: string, dayId: string | null) => Promise<boolean>; onOpen: (g: string) => void;
}) {
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="sg-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <h2 id="sg-title" className="text-xl font-extrabold">{sheet.title}</h2>
          <button type="button" onClick={onClose} aria-label="סגירה" className="h-9 w-9 rounded-full text-lg font-bold hover:bg-sand">✕</button>
        </div>
        {sheet.intro && <p className="mt-1 text-sm text-ink-2">{sheet.intro}</p>}
        {rain && (
          <button type="button" data-tour="now-rain" aria-pressed={rain.on} disabled={sheet.status === 'loading'} onClick={() => rain.set(!rain.on)}
            className={`mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-bold transition disabled:opacity-60 ${rain.on ? 'border-[#1B73C9] bg-[#1B73C9] text-white' : 'border-line bg-white text-ink-2'}`}>
            ☔ יורד גשם{rain.on && ' ✓'}
          </button>
        )}
        {sheet.warn && <p className="mt-2 rounded-xl bg-[#FFF8EA] px-3 py-2 text-sm font-semibold text-[#8A5A00]">{sheet.warn}</p>}
        {days.length > 0 && sheet.status === 'done' && sheet.places.length > 0 && (
          <label className="mt-3 flex flex-col gap-1 text-sm font-bold">להוסיף ליום
            <select value={dayId} onChange={(e) => setDayId(e.target.value)} className="h-11 rounded-lg border border-line bg-white px-2 text-base font-normal">
              <option value="">רק לשמורים, בלי יום</option>
              {days.map((d) => <option key={d.id} value={d.id}>יום {d.dayIndex}{d.date === todayLocal() ? ' · היום' : ''}</option>)}
            </select>
          </label>
        )}
        {sheet.status === 'loading' && <div className="mt-4 h-24 animate-pulse rounded-xl bg-sand-2" aria-label="טוען" />}
        {sheet.status === 'error' && <p role="alert" className="mt-3 text-danger">{sheet.error}</p>}
        {sheet.status === 'done' && sheet.places.length === 0 && <p className="mt-3 text-ink-2">לא מצאנו מקומות מתאימים בסביבה כרגע.</p>}
        {sheet.places.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {sheet.places.map((p) => (
              <li key={p.googlePlaceId} className="flex items-center gap-2 rounded-xl border border-line p-3">
                <button type="button" onClick={() => onOpen(p.googlePlaceId)} className="min-w-0 flex-1 text-right">
                  <span className="block truncate font-extrabold">{p.name ?? 'מקום'}</span>
                  <span className="block text-xs text-ink-2">
                    {p.rating !== null ? <>★ {p.rating.toFixed(1)}{p.ratingCount ? ` (${p.ratingCount})` : ''}</> : 'אין דירוג'}
                    {p.distanceMeters !== null && ` · ${formatDistanceHe(p.distanceMeters)}`}
                    {p.openNow === true && ' · פתוח עכשיו'}
                  </span>
                </button>
                {added.has(p.googlePlaceId) ? <span className="text-sm font-bold text-sea">נוסף ✓</span> : (
                  <button type="button" disabled={adding !== null}
                    onClick={async () => { setAdding(p.googlePlaceId); if (await onAdd(p.googlePlaceId, dayId || null)) setAdded((s) => new Set(s).add(p.googlePlaceId)); setAdding(null); }}
                    className="min-h-9 shrink-0 rounded-full bg-terracotta px-3.5 text-sm font-bold text-white disabled:opacity-50">
                    {adding === p.googlePlaceId ? '…' : 'הוספה'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted">מידע מ-Google.</p>
      </div>
    </div>
  );
}

/** "What now?": open, well-rated places close to where you are standing right now. With "it's raining" on, indoor places only. */
export function NowButton({ kids, days, onAdd, onOpen }: {
  kids: boolean; days: PlanDay[];
  onAdd: (googlePlaceId: string, dayId: string | null) => Promise<boolean>; onOpen: (g: string) => void;
}) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [dayId, setDayId] = useState('');
  const [rain, setRain] = useState(false);
  const [here, setHere] = useState<LatLng | null>(null);
  const baseFor = (wet: boolean) => ({
    title: 'מה עושים עכשיו?',
    intro: wet
      ? `${kids ? 'מקומות מקורים שמתאימים לילדים' : 'מוזיאונים, גלריות, אקווריומים, קניונים ועוד'} קרוב אלייך, שפתוחים עכשיו.`
      : `${kids ? 'מקומות לילדים' : 'אטרקציות, אוכל, קפה ופארקים'} קרוב אלייך, שפתוחים עכשיו ומדורגים גבוה.`,
  });
  const load = async (at: LatLng, wet: boolean) => {
    const base = baseFor(wet);
    setSheet({ ...base, status: 'loading', places: [] });
    try {
      const found = wet ? await around(at, kids ? 'rainy_kids' : 'rainy', 2000) : await around(at, kids ? 'now_kids' : 'now', 1500);
      const list = best(found).filter((p) => p.openNow === true && (p.rating ?? 0) >= 4).slice(0, 10);
      setSheet({ ...base, status: 'done', places: list });
    } catch (e) {
      setSheet({ ...base, status: 'error', places: [], error: e instanceof Error ? e.message : 'אין חיבור' });
    }
  };
  const open = () => {
    const base = baseFor(rain);
    setDayId(days.find((d) => d.date === todayLocal())?.id ?? '');
    if (!('geolocation' in navigator)) return setSheet({ ...base, status: 'error', places: [], error: 'הדפדפן הזה לא יודע לשתף מיקום.' });
    setSheet({ ...base, status: 'loading', places: [] });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const at = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setHere(at);
        void load(at, rain);
      },
      (err) => setSheet({
        ...base, status: 'error', places: [],
        error: err.code === err.PERMISSION_DENIED ? 'צריך לאשר לדפדפן גישה למיקום (בהגדרות האתר), ואז לנסות שוב.' : 'לא הצלחנו לקבל את המיקום. נסי שוב בעוד רגע.',
      }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  };
  // The rain switch keeps the place we already found, so the phone is not asked for the location again.
  const toggleRain = (v: boolean) => { setRain(v); if (here) void load(here, v); };
  return (
    <>
      <button type="button" onClick={open}
        className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-white px-3 text-sm font-bold text-ink shadow-sm hover:border-terracotta hover:text-terracotta">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3l1.9 4.6L19 8.2l-3.8 3.3 1.2 5L12 14l-4.4 2.5 1.2-5L5 8.2l5.1-.6z" />
        </svg>
        מה עושים עכשיו?
      </button>
      {sheet && <SuggestSheet sheet={sheet} days={days} dayId={dayId} setDayId={setDayId} onClose={() => setSheet(null)} onAdd={onAdd} onOpen={(g) => { setSheet(null); onOpen(g); }} rain={{ on: rain, set: toggleRain }} />}
    </>
  );
}
