'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CoachTour } from '@/components/tour/CoachTour';

const KEY = 'gotrip-tour-creator';

/**
 * The creator area's guide: opens by itself the first time on this phone, and again from "הדרכה".
 * Remembered on the phone (not in the account), so it needed no database change.
 */
export function CreatorTour() {
  const [run, setRun] = useState(false);
  useEffect(() => {
    try {
      // Seen as soon as it opens (like the other guides), so leaving mid-way doesn't bring it back.
      if (!localStorage.getItem(KEY)) { localStorage.setItem(KEY, '1'); setRun(true); }
    } catch { /* private mode: only from the button */ }
  }, []);
  const done = () => setRun(false);
  return (
    <>
      <button type="button" onClick={() => setRun(true)}
        className="min-h-10 w-fit self-end rounded-full border border-line bg-white px-4 text-sm font-bold text-ink-2 hover:text-ink">הדרכה</button>
      {/* On <body>: inside <main> the page's rise-in animation would shift the guide's fixed layer. */}
      {run && createPortal(<CoachTour kind="creator" replay onDone={done} />, document.body)}
    </>
  );
}
