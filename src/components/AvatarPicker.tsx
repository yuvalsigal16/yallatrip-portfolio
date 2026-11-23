'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/browser';
import { setAvatar } from '@/app/profile/actions';
import { Avatar } from './Avatar';

const MAX_INPUT = 15 * 1024 * 1024; // what we accept from the camera roll, before shrinking
const SIZE = 512;

/** Crops the photo to a centred square and shrinks it to 512px (WebP where the browser can). */
export async function toSquare(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => fail(new Error('bad image'));
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no canvas');
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, SIZE, SIZE);
    // A fresh canvas image carries no camera metadata (such as GPS location).
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/webp', 0.86));
    if (!blob) throw new Error('encode failed');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Choose, change or remove the profile photo. Saves straight away. */
export function AvatarPicker({ userId, url, name, size = 96, bare = false }: {
  userId: string; url: string | null; name: string | null; size?: number;
  /** Just the photo with a camera badge (for the profile header); click to change. */
  bare?: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState(url);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);

  const cleanup = async (keep: string | null) => {
    // Remove older photos of this user so only the one in use is kept.
    const supabase = createClient();
    const { data } = await supabase.storage.from('avatars').list(userId, { limit: 100 });
    const old = (data ?? []).map((f) => `${userId}/${f.name}`).filter((p) => !keep || !keep.endsWith(p));
    if (old.length) await supabase.storage.from('avatars').remove(old);
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setMsg(null);
    if (!file.type.startsWith('image/')) return setMsg({ kind: 'error', text: 'אפשר להעלות רק תמונה' });
    if (file.size > MAX_INPUT) return setMsg({ kind: 'error', text: 'התמונה גדולה מדי (עד 15MB)' });
    setBusy(true);
    try {
      const blob = await toSquare(file);
      const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/jpeg' ? 'jpg' : 'png';
      const path = `${userId}/${Date.now()}.${ext}`;
      const supabase = createClient();
      const up = await supabase.storage.from('avatars').upload(path, blob, { contentType: blob.type, upsert: false });
      if (up.error) throw up.error;
      const publicUrl = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
      const r = await setAvatar(publicUrl);
      if (!r.ok) throw new Error(r.error);
      setCurrent(publicUrl);
      setMsg({ kind: 'ok', text: 'התמונה נשמרה' });
      await cleanup(publicUrl).catch(() => {});
      router.refresh();
    } catch (e) {
      console.error('[avatar]', e);
      setMsg({ kind: 'error', text: 'לא הצלחנו לשמור את התמונה. נסו תמונה אחרת.' });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const remove = async () => {
    setBusy(true);
    setMsg(null);
    const r = await setAvatar(null);
    if (r.ok) {
      setCurrent(null);
      await cleanup(null).catch(() => {});
      router.refresh();
    } else setMsg({ kind: 'error', text: r.error });
    setBusy(false);
  };

  const fileInput = (
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="hidden"
      onChange={(e) => pick(e.target.files?.[0])} />
  );

  if (bare) {
    return (
      <div className="flex flex-col items-center gap-1.5">
        <button type="button" onClick={() => input.current?.click()} disabled={busy}
          className="relative shrink-0 rounded-full bg-white p-1 shadow-lg disabled:opacity-60"
          aria-label={current ? 'החלפת תמונת הפרופיל' : 'העלאת תמונת פרופיל'}>
          <Avatar url={current} name={name} size={size} />
          <span className="absolute bottom-1 left-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-ink text-white" aria-hidden="true">
            {busy ? '…' : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7l1.5-3h5L16 7" /><circle cx="12" cy="13.5" r="3.5" />
              </svg>
            )}
          </span>
        </button>
        {current && !busy && (
          <button type="button" onClick={remove} className="text-xs font-bold text-white/85 underline hover:text-white">הסרת התמונה</button>
        )}
        {msg && <p role={msg.kind === 'error' ? 'alert' : 'status'} className="rounded bg-black/30 px-2 text-xs font-semibold text-white">{msg.text}</p>}
        {fileInput}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <button type="button" onClick={() => input.current?.click()} disabled={busy}
        className="group relative shrink-0 rounded-full disabled:opacity-60" aria-label="בחירת תמונת פרופיל">
        <Avatar url={current} name={name} size={size} />
        <span className="absolute inset-0 hidden items-center justify-center rounded-full bg-black/40 text-sm font-bold text-white group-hover:flex">
          {busy ? '…' : 'החלפה'}
        </span>
      </button>
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => input.current?.click()} disabled={busy}
            className="min-h-10 rounded-xl border border-line bg-white px-3.5 text-sm font-bold hover:bg-sand disabled:opacity-60">
            {busy ? 'שומרים…' : current ? 'החלפת תמונה' : 'העלאת תמונה'}
          </button>
          {current && (
            <button type="button" onClick={remove} disabled={busy}
              className="min-h-10 px-2 text-sm font-bold text-[#B42318] disabled:opacity-60">הסרה</button>
          )}
        </div>
        <p className="text-xs text-muted">JPG, PNG או WebP. נחתכת לריבוע ומוקטנת אוטומטית.</p>
        {msg && <p role={msg.kind === 'error' ? 'alert' : 'status'} className={`text-sm font-semibold ${msg.kind === 'error' ? 'text-danger' : 'text-sea'}`}>{msg.text}</p>}
      </div>
      {fileInput}
    </div>
  );
}
