'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/browser';
import { photoTakenTime, shrinkImage } from '@/lib/images';
import { addAlbumPhotos, type AlbumUpload as Upload } from '@/app/trips/album-actions';

type Day = { index: number; date: string; label: string };
const OTHER = 'other';
const localToday = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
};
const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Adding photos, inside the album: choose the day they were taken (a trip day or any date),
 * pick the photos, and they are filed under that day, in the order they were taken.
 */
export function AlbumUpload({ tripId, days }: { tripId: string; days: Day[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [choice, setChoice] = useState<string>(days[0]?.date ?? OTHER);
  const [other, setOther] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  // Default to today when the trip is on, otherwise the first day.
  useEffect(() => {
    const t = localToday();
    if (days.some((d) => d.date === t)) setChoice(t);
    else if (!days.length) setOther(t);
  }, [days]);

  const date = choice === OTHER ? other : choice;

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setMsg(null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setMsg({ kind: 'error', text: 'בחרי קודם את התאריך שבו צולמו התמונות.' });
    // Oldest first, so the album keeps the order they were taken in.
    const list = [...files].filter((f) => f.type.startsWith('image/') && f.size <= 30 * 1024 * 1024)
      .sort((a, b) => a.lastModified - b.lastModified).slice(0, 40);
    const supabase = createClient();
    const done: Upload[] = [];
    for (const [i, file] of list.entries()) {
      setBusy(`מעלים ${i + 1} מתוך ${list.length}…`);
      try {
        const blob = await shrinkImage(file, 2000);
        const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
        const path = `${tripId}/${date}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const up = await supabase.storage.from('trip-album').upload(path, blob, { contentType: blob.type, upsert: false });
        if (up.error) throw up.error;
        // The chosen date + the photo's own time of day (kept as the local clock time), so the day's order is right.
        // The camera's own time when the photo has it (a phone gallery gives no reliable file date), else the file's.
        const t = file.lastModified ? new Date(file.lastModified) : null;
        const time = (await photoTakenTime(file))
          ?? (t ? `${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}` : `12:00:${pad(i % 60)}`);
        done.push({ path, takenAt: `${date}T${time}.${String(i).padStart(3, '0')}Z`, lat: null, lng: null });
      } catch (e) {
        console.error('[album]', e);
      }
    }
    setBusy(null);
    if (input.current) input.current.value = '';
    if (!done.length) return setMsg({ kind: 'error', text: 'התמונות לא עלו. נסי שוב.' });
    const r = await addAlbumPhotos({ tripId, photos: done });
    if (!r.ok) return setMsg({ kind: 'error', text: r.error });
    setMsg({ kind: 'ok', text: `${r.data} תמונות נוספו${done.length < list.length ? ` (${list.length - done.length} לא עלו)` : ''}.` });
    router.refresh();
  };

  return (
    <section className="flex flex-col gap-3 rounded-3xl border border-line bg-white p-5 sm:p-6" aria-labelledby="upload-h">
      <h2 id="upload-h" className="text-xl font-extrabold">הוספת תמונות</h2>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1.5 text-sm font-bold">באיזה יום צולמו?
          <select value={choice} onChange={(e) => setChoice(e.target.value)} disabled={!!busy}
            className="h-12 rounded-xl border border-line bg-white px-3 text-base font-normal">
            {days.map((d) => <option key={d.date} value={d.date}>{d.label}</option>)}
            <option value={OTHER}>תאריך אחר…</option>
          </select>
        </label>
        {choice === OTHER && (
          <label className="flex flex-col gap-1.5 text-sm font-bold">תאריך
            <input type="date" dir="ltr" value={other} onChange={(e) => setOther(e.target.value)} disabled={!!busy}
              className="h-12 rounded-xl border border-line bg-white px-3 text-base font-normal" />
          </label>
        )}
        <button type="button" disabled={!!busy} onClick={() => input.current?.click()}
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-[#1B73C9] to-[#2E9BDB] px-5 font-bold text-white shadow-[0_8px_20px_-8px_rgba(27,115,201,.7)] disabled:opacity-60">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" />
          </svg>
          {busy ?? 'בחירת תמונות והעלאה'}
        </button>
      </div>
      <p className="text-sm text-ink-2">אפשר לבחור כמה תמונות בבת אחת (עד 40). הן נכנסות ליום שבחרת, לפי שעת הצילום.</p>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
      {msg && <p role="status" className={`text-sm font-semibold ${msg.kind === 'ok' ? 'text-sea' : 'text-danger'}`}>{msg.text}</p>}
    </section>
  );
}
