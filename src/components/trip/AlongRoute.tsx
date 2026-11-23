'use client';

import { useState } from 'react';

type Kind = 'food' | 'sights' | 'rest';
export type AlongPlace = {
  googlePlaceId: string; name: string; rating: number | null; ratingCount: number | null; openNow: boolean | null;
  lat: number; lng: number; offMeters: number; detourMin: number; after: number;
};

const KINDS: { key: Kind; label: string }[] = [
  { key: 'food', label: 'מסעדות' },
  { key: 'sights', label: 'אטרקציות' },
  { key: 'rest', label: 'עצירה ומנוחה' },
];

/**
 * "Stops along the way": restaurants, sights and rest stops on the selected day's route,
 * or a few minutes off it, in the order you pass them. Adding one puts it in the day at the right spot.
 */
export function AlongRoute({ points, mode, dayLabel, onOpen, onAdd }: {
  points: { lat: number; lng: number }[];
  mode: 'walk' | 'transit' | 'drive';
  dayLabel: string;
  onOpen: (googlePlaceId: string) => void;
  /** after = index in `points` the place comes right after. */
  onAdd: (googlePlaceId: string, after: number) => Promise<boolean>;
}) {
  // Folded to a small "+ עצירה בדרך" link until tapped.
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind | null>(null);
  const [state, setState] = useState<{ status: 'idle' | 'loading' | 'done' | 'error'; places: AlongPlace[]; error?: string }>({ status: 'idle', places: [] });
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());

  const load = async (k: Kind) => {
    setKind(k);
    setState({ status: 'loading', places: [] });
    try {
      const res = await fetch('/api/routes/along', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points, mode, kind: k }),
      });
      const body = (await res.json()) as { places?: AlongPlace[]; error?: string };
      if (!res.ok) return setState({ status: 'error', places: [], error: body.error ?? 'לא הצלחנו לחפש כרגע' });
      setState({ status: 'done', places: body.places ?? [] });
    } catch {
      setState({ status: 'error', places: [], error: 'אין חיבור כרגע' });
    }
  };

  const add = async (p: AlongPlace) => {
    setAdding(p.googlePlaceId);
    const ok = await onAdd(p.googlePlaceId, p.after);
    setAdding(null);
    if (ok) setAdded((s) => new Set(s).add(p.googlePlaceId));
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} aria-expanded={false}
        className="flex min-h-10 w-fit items-center text-sm font-bold text-ink-2 hover:text-ink">+ עצירה בדרך</button>
    );
  }
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4" aria-labelledby="along-h">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 id="along-h" className="font-extrabold">עצירות בדרך · {dayLabel}</h3>
          <p className="text-sm text-ink-2">מקומות על המסלול של היום או בסטייה קטנה ממנו, לפי הסדר שבו עוברים לידם.</p>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="סגירת עצירות בדרך" aria-expanded
          className="-m-1 h-10 w-10 shrink-0 rounded-full text-lg text-ink-2 hover:bg-sand">✕</button>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="מה לחפש">
        {KINDS.map((k) => (
          <button key={k.key} type="button" onClick={() => load(k.key)} aria-pressed={kind === k.key}
            className={`min-h-10 rounded-full border px-4 text-sm font-bold transition ${kind === k.key
              ? 'border-transparent bg-terracotta text-white' : 'border-line bg-white text-ink hover:border-terracotta hover:text-terracotta'}`}>
            {k.label}
          </button>
        ))}
      </div>

      {state.status === 'loading' && <p className="text-sm text-muted" role="status">מחפשים לאורך המסלול…</p>}
      {state.status === 'error' && <p className="text-sm font-semibold text-danger" role="alert">{state.error}</p>}
      {state.status === 'done' && state.places.length === 0 && (
        <p className="text-sm text-muted">לא מצאנו מקומות כאלה צמוד למסלול. אפשר לנסות סוג אחר.</p>
      )}
      {state.places.length > 0 && (
        <ol className="flex flex-col gap-2">
          {state.places.map((p) => (
            <li key={p.googlePlaceId} className="flex items-center gap-3 rounded-xl bg-sand px-3 py-2">
              <button type="button" onClick={() => onOpen(p.googlePlaceId)} className="min-w-0 flex-1 text-right">
                <span className="block truncate font-bold">{p.name}</span>
                <span className="block text-xs text-ink-2">
                  {p.offMeters < 60 ? 'ממש על הדרך' : `סטייה של כ-${p.detourMin} דק׳`}
                  {p.rating !== null && <> · <span className="text-[#C98A1B]">★</span> {p.rating.toFixed(1)}{p.ratingCount ? ` (${p.ratingCount})` : ''}</>}
                  {p.openNow === true && ' · פתוח עכשיו'}
                  {p.openNow === false && ' · סגור עכשיו'}
                </span>
              </button>
              {added.has(p.googlePlaceId) ? (
                <span className="text-sm font-bold text-sea">נוסף ✓</span>
              ) : (
                <button type="button" disabled={adding !== null} onClick={() => add(p)}
                  className="min-h-10 shrink-0 rounded-full border border-line bg-white px-3.5 text-sm font-bold text-ink hover:border-ink disabled:opacity-50">
                  {adding === p.googlePlaceId ? 'מוסיפים…' : 'הוספה לדרך'}
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
