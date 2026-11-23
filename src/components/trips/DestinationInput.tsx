'use client';

import { useEffect, useId, useRef, useState } from 'react';

type Suggestion = { placeId: string; mainText: string; secondaryText: string | null };

const newToken = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `t${Date.now()}${Math.random()}`.replace('.', '');

/**
 * Destination field with search-as-you-type (Google, through our server).
 * Picking a suggestion fills two hidden fields: placeId and sessionToken.
 * If search is unavailable, whatever the user typed is still used.
 */
export function DestinationInput({
  label = 'יעד', defaultName = '', defaultPlaceId = '', error, autoFocus, placeholder = 'עיר, מדינה או אזור. למשל: רומא', onName,
}: {
  label?: string; defaultName?: string; defaultPlaceId?: string; error?: string; autoFocus?: boolean; placeholder?: string;
  /** Called with the text as it changes (typed or picked), for forms that show it elsewhere. */
  onName?: (name: string) => void;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [text, setText] = useState(defaultName);
  const [placeId, setPlaceId] = useState(defaultPlaceId);
  const [token, setToken] = useState('');
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [unavailable, setUnavailable] = useState(false);
  // A name that arrived with its place id is already chosen; a bare name (e.g. from the home page) still gets suggestions.
  const picked = useRef(defaultPlaceId ? defaultName : '');

  useEffect(() => setToken(newToken()), []);
  const onNameRef = useRef(onName);
  onNameRef.current = onName;
  useEffect(() => { onNameRef.current?.(text); }, [text]);

  // Ask for suggestions 250ms after the user stops typing.
  useEffect(() => {
    const q = text.trim();
    if (q.length < 2 || q === picked.current || !token || unavailable) {
      setItems([]);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/places/autocomplete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: q, sessionToken: token }),
          signal: ctrl.signal,
        });
        if (!res.ok) {
          if (res.status === 429 || res.status >= 500) setUnavailable(true);
          setItems([]);
          return;
        }
        const body = (await res.json()) as { suggestions?: Suggestion[] };
        setItems((body.suggestions ?? []).slice(0, 6));
        setOpen(true);
        setActive(-1);
      } catch {
        /* aborted or offline: keep the typed text */
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [text, token, unavailable]);

  const choose = (s: Suggestion) => {
    picked.current = s.mainText;
    setText(s.mainText);
    setPlaceId(s.placeId);
    setItems([]);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || items.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      choose(items[active]!);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showList = open && items.length > 0;

  return (
    <div className="relative flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-bold">{label}</label>
      <div className={`flex h-13 items-center gap-2.5 rounded-xl border bg-white px-3.5 focus-within:border-terracotta focus-within:shadow-[0_0_0_4px_rgba(27,115,201,.14)]
        ${error ? 'border-danger' : 'border-line'}`}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1B73C9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" />
        </svg>
        <input
          id={id}
          name="destinationName"
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          aria-invalid={error ? true : undefined}
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={text}
          maxLength={200}
          onChange={(e) => {
            setText(e.target.value);
            setPlaceId(''); // typed again: no longer the chosen place
            picked.current = '';
          }}
          onKeyDown={onKeyDown}
          onFocus={() => items.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="h-12 min-w-0 flex-1 bg-transparent text-[17px] outline-none focus:!shadow-none"
        />
        {placeId && (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B8FB8" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-label="יעד נבחר מהרשימה">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        )}
      </div>
      <input type="hidden" name="placeId" value={placeId} />
      <input type="hidden" name="sessionToken" value={token} />

      {showList && (
        <ul id={listId} role="listbox" className="absolute top-full z-20 mt-1 w-full overflow-hidden rounded-xl border border-line bg-white shadow-lg">
          {items.map((s, i) => (
            <li
              key={s.placeId}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(s);
              }}
              className={`cursor-pointer px-4 py-3 ${i === active ? 'bg-sand-2' : 'hover:bg-sand'}`}
            >
              <div className="font-bold">{s.mainText}</div>
              {s.secondaryText && <div className="text-sm text-ink-2">{s.secondaryText}</div>}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-sm font-semibold text-danger">{error}</p>}
    </div>
  );
}
