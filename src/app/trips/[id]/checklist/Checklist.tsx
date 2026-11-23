'use client';

import { useState, useTransition } from 'react';
import { Alert } from '@/components/ui';
import { CHECKLIST_SUGGESTIONS, type ChecklistItem } from '@/lib/trips/extras';
import { addChecklistItems, deleteChecklistItem, setChecklistDone } from '@/app/trips/extras-actions';

const card = 'rounded-2xl border border-line bg-white p-4 sm:p-5';

export function Checklist({ tripId, initial }: { tripId: string; initial: ChecklistItem[] }) {
  const [items, setItems] = useState(initial);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showIdeas, setShowIdeas] = useState(initial.length === 0);
  const [pending, start] = useTransition();

  const doneCount = items.filter((i) => i.done).length;
  const have = new Set(items.map((i) => i.text));

  const add = (texts: string[]) => start(async () => {
    setError(null);
    const r = await addChecklistItems({ tripId, texts });
    if (!r.ok) { setError(r.error); return; }
    setItems((cur) => [...cur, ...r.data]);
    setText('');
  });

  const toggle = (it: ChecklistItem) => {
    setItems((cur) => cur.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)));
    start(async () => {
      const r = await setChecklistDone({ tripId, id: it.id, done: !it.done });
      if (!r.ok) {
        setError(r.error);
        setItems((cur) => cur.map((x) => (x.id === it.id ? { ...x, done: it.done } : x)));
      }
    });
  };

  const remove = (it: ChecklistItem) => {
    setItems((cur) => cur.filter((x) => x.id !== it.id));
    start(async () => {
      const r = await deleteChecklistItem({ tripId, id: it.id });
      if (!r.ok) { setError(r.error); setItems((cur) => [...cur, it].sort((a, b) => a.position - b.position)); }
    });
  };

  // Not yet done first, in the order they were added; done ones at the bottom.
  const open = items.filter((i) => !i.done);
  const closed = items.filter((i) => i.done);

  return (
    <>
      <section className={`${card} flex flex-col gap-4`}>
        {items.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-sm font-bold">
              <span>{doneCount === items.length ? 'הכול מוכן! ✓' : `${doneCount} מתוך ${items.length} מוכנים`}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-sand-2" aria-hidden="true">
              <div className="h-full rounded-full bg-[#1B73C9] transition-all" style={{ width: `${items.length ? (doneCount / items.length) * 100 : 0}%` }} />
            </div>
          </div>
        )}

        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) add([text]); }}>
          <label htmlFor="new-item" className="sr-only">פריט חדש</label>
          <input id="new-item" value={text} onChange={(e) => setText(e.target.value)} maxLength={200}
            placeholder="למשל: כרטיס כניסה למוזיאון"
            className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-white px-3.5 text-base outline-none focus:border-terracotta focus:ring-4 focus:ring-terracotta/15" />
          <button type="submit" disabled={pending || !text.trim()}
            className="h-12 shrink-0 rounded-xl bg-ink px-4 font-bold text-white disabled:opacity-50">הוספה</button>
        </form>
        {error && <Alert>{error}</Alert>}

        {items.length === 0 ? (
          <p className="text-ink-2">הרשימה עוד ריקה. כתבו פריט, או בחרו מהרעיונות למטה.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {[...open, ...closed].map((it) => (
              <li key={it.id} className="flex items-center gap-3 py-1">
                <label className="flex min-h-12 min-w-0 flex-1 cursor-pointer items-center gap-3">
                  <input type="checkbox" checked={it.done} onChange={() => toggle(it)} className="h-6 w-6 shrink-0 accent-[#1B73C9]" />
                  <span className={`min-w-0 break-words ${it.done ? 'text-muted line-through' : ''}`}>{it.text}</span>
                </label>
                <button type="button" onClick={() => remove(it)} aria-label={`מחיקת ${it.text}`}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl text-muted hover:bg-sand-2 hover:text-danger">×</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`${card} flex flex-col gap-3`}>
        <button type="button" onClick={() => setShowIdeas((v) => !v)} aria-expanded={showIdeas}
          className="flex min-h-11 items-center justify-between text-start text-lg font-extrabold">
          רעיונות לרשימה <span className="text-sm font-bold text-terracotta">{showIdeas ? 'הסתרה' : 'הצגה'}</span>
        </button>
        {showIdeas && CHECKLIST_SUGGESTIONS.map((g) => {
          const left = g.items.filter((t) => !have.has(t));
          if (!left.length) return null;
          return (
            <div key={g.group} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">{g.group}</h3>
                <button type="button" disabled={pending} onClick={() => add(left)} className="text-sm font-bold text-terracotta disabled:opacity-50">+ הוספת הכול</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {left.map((t) => (
                  <button key={t} type="button" disabled={pending} onClick={() => add([t])}
                    className="min-h-10 rounded-full border border-line bg-sand px-3 text-sm font-semibold hover:border-ink disabled:opacity-50">+ {t}</button>
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </>
  );
}
