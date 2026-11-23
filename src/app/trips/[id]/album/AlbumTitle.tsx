'use client';

import { useState } from 'react';
import { setAlbumTitle } from '@/app/trips/album-actions';

/** The album's name, editable in place ("✎ שינוי שם"). */
export function AlbumTitle({ tripId, title }: { tripId: string; title: string | null }) {
  const [name, setName] = useState(title);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setErr(null);
    const r = await setAlbumTitle({ tripId, title: draft });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    setName(r.data);
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-line bg-white px-5 py-4">
        <span className="text-sm font-bold text-ink-2">שם האלבום</span>
        <span className="text-xl font-extrabold">{name ?? 'עוד אין שם'}</span>
        <button type="button" onClick={() => { setDraft(name ?? ''); setEditing(true); }}
          className="rounded-full bg-terracotta-tint px-3.5 py-1.5 text-sm font-bold text-terracotta">
          {name ? '✎ שינוי שם' : '+ לתת שם לאלבום'}
        </button>
      </div>
    );
  }
  return (
    <form className="flex flex-col gap-2 rounded-3xl border border-line bg-white px-5 py-4 sm:flex-row sm:items-end"
      onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <label className="flex flex-1 flex-col gap-1.5 text-sm font-bold">שם האלבום
        <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={80} autoFocus
          placeholder="למשל: רומא עם הבנות, מאי 2026" className="h-12 rounded-xl border border-line bg-white px-3 text-base font-normal" />
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="min-h-12 rounded-xl bg-terracotta px-5 font-bold text-white disabled:opacity-60">{busy ? 'שומרים…' : 'שמירה'}</button>
        <button type="button" onClick={() => setEditing(false)} className="min-h-12 rounded-xl px-4 font-bold text-ink-2">ביטול</button>
      </div>
      {err && <p role="alert" className="text-sm font-semibold text-danger">{err}</p>}
    </form>
  );
}
