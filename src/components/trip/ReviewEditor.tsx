'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import { shrinkImage } from '@/lib/images';
import { getReview, saveReview } from '@/app/trips/plan-actions';

const MAX_PHOTOS = 8;

/**
 * "My recommendation": a few words and the photos I took at this place.
 * Private while the trip is private; shown to others when the trip is shared.
 */
export function ReviewEditor({ tripId, savedPlaceId, onSaved }: { tripId: string; savedPlaceId: string; onSaved?: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState('');
  const [savedText, setSavedText] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [rating, setRating] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    getReview({ tripId, savedPlaceId }).then((r) => {
      if (!alive || !r.ok) return;
      setText(r.data.review);
      setSavedText(r.data.review);
      setPhotos(r.data.photos);
      setRating(r.data.rating);
      setLoaded(true);
    });
    return () => { alive = false; };
  }, [tripId, savedPlaceId]);

  const persist = async (nextText: string, nextPhotos: string[], okText: string, nextRating: number | null = rating) => {
    const r = await saveReview({ tripId, savedPlaceId, review: nextText, photos: nextPhotos, rating: nextRating });
    if (!r.ok) {
      setMsg({ kind: 'error', text: r.error });
      return false;
    }
    setSavedText(nextText.trim());
    setMsg({ kind: 'ok', text: okText });
    onSaved?.();
    return true;
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setMsg(null);
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) return setMsg({ kind: 'error', text: `אפשר עד ${MAX_PHOTOS} תמונות למקום` });
    setBusy(true);
    const supabase = createClient();
    const added: string[] = [];
    try {
      for (const [i, file] of [...files].slice(0, room).entries()) {
        if (!file.type.startsWith('image/') || file.size > 25 * 1024 * 1024) continue;
        const blob = await shrinkImage(file);
        const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
        const path = `${tripId}/${savedPlaceId}/${Date.now()}-${i}.${ext}`;
        const up = await supabase.storage.from('trip-photos').upload(path, blob, { contentType: blob.type, upsert: false });
        if (up.error) throw up.error;
        added.push(supabase.storage.from('trip-photos').getPublicUrl(path).data.publicUrl);
      }
    } catch (e) {
      console.error('[review photo]', e);
      setMsg({ kind: 'error', text: 'חלק מהתמונות לא עלו. נסי שוב.' });
    }
    if (added.length) {
      const next = [...photos, ...added];
      setPhotos(next);
      await persist(text, next, added.length === 1 ? 'התמונה נוספה' : `${added.length} תמונות נוספו`);
    }
    setBusy(false);
    if (input.current) input.current.value = '';
  };

  const removePhoto = async (url: string) => {
    const next = photos.filter((u) => u !== url);
    setBusy(true);
    if (await persist(text, next, 'התמונה הוסרה')) setPhotos(next);
    setBusy(false);
  };

  if (!loaded) return <p className="text-sm text-muted">טוענים את ההמלצה…</p>;

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-sand p-3">
      <div>
        <p className="text-sm font-extrabold">הדירוג וההמלצה שלי</p>
        <p className="text-xs text-ink-2">רק מטיילים ב-YallaTrip יראו את זה כשיפתחו את המקום במפה (עם השם הפרטי שלך). זה לא מתפרסם ב-Google.</p>
      </div>
      <div className="flex items-center gap-1" role="radiogroup" aria-label="דירוג">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} כוכבים`} disabled={busy}
            onClick={async () => { const next = rating === n ? null : n; setRating(next); setBusy(true); await persist(text, photos, next ? 'הדירוג נשמר' : 'הדירוג הוסר', next); setBusy(false); }}
            className={`h-10 w-10 text-3xl leading-none ${rating !== null && n <= rating ? 'text-[#F5A623]' : 'text-line'}`}>★</button>
        ))}
      </div>
      <textarea value={text} maxLength={2000} rows={3} onChange={(e) => setText(e.target.value)}
        placeholder="למשל: הקפה הכי טוב בעיר, לבקש את העוגה עם הקרמל"
        className="rounded-lg border border-line bg-white px-3 py-2 text-base" />

      {photos.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((u) => (
            <li key={u} className="relative aspect-square overflow-hidden rounded-lg bg-sand-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" className="h-full w-full object-cover" loading="lazy" />
              <button type="button" disabled={busy} onClick={() => removePhoto(u)} aria-label="הסרת התמונה"
                className="absolute top-1 left-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-sm font-bold text-white">✕</button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy || text.trim() === savedText} onClick={async () => { setBusy(true); await persist(text, photos, 'ההמלצה נשמרה'); setBusy(false); }}
          className="min-h-10 rounded-lg bg-ink px-4 text-sm font-bold text-white disabled:opacity-40">שמירת ההמלצה</button>
        {photos.length < MAX_PHOTOS && (
          <button type="button" disabled={busy} onClick={() => input.current?.click()}
            className="min-h-10 rounded-lg border border-line bg-white px-3 text-sm font-bold hover:bg-sand-2 disabled:opacity-50">
            {busy ? 'מעלים…' : '📷 הוספת תמונות'}
          </button>
        )}
        <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addPhotos(e.target.files)} />
        {msg && <span role={msg.kind === 'error' ? 'alert' : 'status'} className={`text-sm font-semibold ${msg.kind === 'error' ? 'text-danger' : 'text-sea'}`}>{msg.text}</span>}
      </div>
    </div>
  );
}
