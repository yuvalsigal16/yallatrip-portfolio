'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * The top of a trip card: the trip's own photo (uploaded by its owner) with the trip's name on it.
 * Without one it shows the calm colored cover. Nothing is asked from Google.
 */
export function TripCover({ tripId, title, bg, chip, chipClass, src, extra }: {
  tripId: string; title: string; bg: string; accent?: string; chip: string; chipClass: string;
  /** The trip's own photo, if it has one. */
  src?: string | null;
  /** Shown next to the chip (the "+" for a photo on my own trips). */
  extra?: ReactNode;
}) {
  const [state, setState] = useState<'loading' | 'ok' | 'none'>('loading');
  const img = useRef<HTMLImageElement>(null);
  // The photo may finish (or fail) before React is ready to hear about it: check once on mount.
  useEffect(() => {
    const el = img.current;
    if (el?.complete) setState(el.naturalWidth > 0 ? 'ok' : 'none');
  }, []);
  const photo = !!src && state !== 'none';
  return (
    <div className="relative h-48 overflow-hidden" style={{ background: bg }}>
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img ref={img} src={src ?? undefined} alt="" referrerPolicy="no-referrer"
          onLoad={() => setState('ok')} onError={() => setState('none')}
          className={`absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105 ${state === 'ok' ? 'opacity-100' : 'opacity-0'}`} />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" aria-hidden="true" />
      <div className="absolute top-4 left-4 flex items-center gap-1.5">
        <span className={`rounded-full px-3 py-1 text-[13px] font-extrabold ${chipClass}`}>{chip}</span>
        {extra}
      </div>
      <h3 className="absolute right-5 bottom-3 left-5 truncate font-display text-4xl font-black text-white [text-shadow:0_2px_8px_rgba(0,0,0,.45)]">{title}</h3>
    </div>
  );
}
