'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { uploadTripCover } from '@/lib/trips/cover-upload';

/**
 * "+" on a trip card, next to the countdown: picks a photo from the phone and makes it the trip's cover,
 * without going into the trip's settings. It sits on a link, so its clicks stop here.
 */
export function CoverPlus({ tripId, hasPhoto }: { tripId: string; hasPhoto: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setErr(null);
    const r = await uploadTripCover(tripId, file);
    setBusy(false);
    if (input.current) input.current.value = '';
    if (r.ok) router.refresh(); else setErr(r.error);
  };

  return (
    <>
      <button type="button" data-tour="cover-plus" disabled={busy}
        aria-label={hasPhoto ? 'להחליף את תמונת הטיול' : 'להוסיף תמונה לטיול'} title={hasPhoto ? 'להחליף תמונה' : 'להוסיף תמונה'}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); input.current?.click(); }}
        className="flex h-9 min-w-9 items-center justify-center rounded-full bg-white/90 px-2 text-xl font-black leading-none text-terracotta shadow-md backdrop-blur disabled:opacity-70">
        {busy ? '…' : '+'}
      </button>
      <input ref={input} type="file" accept="image/*" className="hidden" tabIndex={-1} aria-hidden="true"
        onClick={(e) => e.stopPropagation()} onChange={(e) => pick(e.target.files?.[0])} />
      {err && (
        <span role="alert" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setErr(null); }}
          className="max-w-[60vw] rounded-xl bg-[#FDECEA] px-2.5 py-1 text-xs font-bold text-[#B42318] shadow">{err}</span>
      )}
    </>
  );
}
