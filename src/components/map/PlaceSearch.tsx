'use client';

import { useEffect, useId, useRef, useState } from 'react';

type Suggestion = { placeId: string; mainText: string; secondaryText: string | null };

const newToken = () => crypto.randomUUID();

/**
 * "Search a place in Rome" box that floats on the map.
 * Results are biased to the map's current center. Picking one hands the place id
 * and the session token to the map, which opens the place card.
 */
export function PlaceSearch({
  placeholder, getBias, onPick,
}: {
  placeholder: string;
  getBias: () => { lat: number; lng: number } | null;
  onPick: (placeId: string, sessionToken: string, label?: string) => void;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(-1);
  const [message, setMessage] = useState<string | null>(null);
  const token = useRef<string>('');

  useEffect(() => {
    token.current = newToken();
  }, []);

  useEffect(() => {
    const text = q.trim();
    if (text.length < 2) {
      setItems([]);
      setMessage(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const bias = getBias();
        const res = await fetch('/api/places/autocomplete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: text, sessionToken: token.current, ...(bias && { bias }) }),
          signal: ctrl.signal,
        });
        const body = (await res.json().catch(() => ({}))) as { suggestions?: Suggestion[]; error?: string };
        if (!res.ok) {
          setItems([]);
          setMessage(body.error ?? 'החיפוש לא זמין כרגע');
          return;
        }
        setItems((body.suggestions ?? []).slice(0, 6));
        setMessage(body.suggestions?.length ? null : 'לא נמצאו מקומות. נסו לכתוב אחרת');
        setActive(-1);
      } catch {
        /* aborted */
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, getBias]);

  const pick = (s: Suggestion) => {
    onPick(s.placeId, token.current, s.mainText);
    token.current = newToken(); // a session ends when a place is picked
    setQ('');
    setItems([]);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!items.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % items.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a <= 0 ? items.length - 1 : a - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(items[Math.max(0, active)]!); }
    else if (e.key === 'Escape') setItems([]);
  };

  return (
    <div className="relative w-full">
      <label htmlFor={id} className="sr-only">חיפוש מקום</label>
      <div className="flex h-12 items-center gap-2.5 rounded-2xl bg-white px-3.5 shadow-[0_4px_16px_rgba(23,32,43,0.14)] focus-within:ring-2 focus-within:ring-ink/20">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4A5563" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" /><path d="M16.5 16.5 21 21" />
        </svg>
        <input
          id={id} type="search" value={q} placeholder={placeholder} autoComplete="off" maxLength={120}
          role="combobox" aria-expanded={items.length > 0} aria-controls={listId} aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown}
          className="h-full min-w-0 flex-1 bg-transparent text-base outline-none focus:!shadow-none"
        />
      </div>
      {(items.length > 0 || message) && (
        <div className="absolute top-full z-30 mt-1.5 w-full overflow-hidden rounded-2xl bg-white shadow-xl">
          {items.length > 0 ? (
            <ul id={listId} role="listbox">
              {items.map((s, i) => (
                <li key={s.placeId} id={`${listId}-${i}`} role="option" aria-selected={i === active}
                  onMouseDown={(e) => { e.preventDefault(); pick(s); }}
                  className={`cursor-pointer px-4 py-3 ${i === active ? 'bg-sand-2' : 'hover:bg-sand'}`}>
                  <div className="font-bold">{s.mainText}</div>
                  {s.secondaryText && <div className="text-sm text-ink-2">{s.secondaryText}</div>}
                </li>
              ))}
            </ul>
          ) : (
            <p role="status" className="px-4 py-3 text-sm text-ink-2">{message}</p>
          )}
        </div>
      )}
    </div>
  );
}
