'use client';

import { useEffect, useState } from 'react';

/** Back to the trip, print / save as PDF, and whether this page is kept on the phone for offline use. */
export function PlanToolbar({ tripId }: { tripId: string }) {
  const [offlineReady, setOfflineReady] = useState(false);
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready.then(() => setOfflineReady(true)).catch(() => {});
  }, []);
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
      <a href={`/trips/${tripId}`} className="min-h-10 rounded-full border border-line bg-white px-4 py-2 text-sm font-bold text-ink no-underline">→ חזרה לטיול</a>
      <button type="button" onClick={() => window.print()} className="min-h-10 rounded-full bg-ink px-4 text-sm font-bold text-white">הדפסה / שמירה כ-PDF</button>
      <a href={`/trips/${tripId}/calendar`} className="min-h-10 rounded-full border border-line bg-white px-4 py-2 text-sm font-bold text-ink no-underline">📅 הוספה ליומן</a>
      <a href={`/trips/${tripId}/summary`} className="min-h-10 rounded-full border border-line bg-white px-4 py-2 text-sm font-bold text-ink no-underline">סיכום הטיול</a>
      {offlineReady && <span className="text-sm font-semibold text-sea">✓ נשמר בטלפון, נפתח גם בלי אינטרנט</span>}
    </div>
  );
}
