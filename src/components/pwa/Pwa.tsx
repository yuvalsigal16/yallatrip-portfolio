'use client';

import { useEffect, useState } from 'react';
import { InstallSheet } from './Install';

/**
 * Turns on the service worker (keeps trip pages for use without internet) and shows a thin bar
 * while the phone is offline, so it is clear that what you see is the saved copy.
 */
export function PwaShell() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
    }
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  return (
    <>
      {offline && (
        <div role="status" className="sticky top-0 z-[60] bg-[#8A4B00] px-4 py-1.5 text-center text-sm font-bold text-white print:hidden">
          אין חיבור לאינטרנט · מוצג המידע השמור בטלפון, ושינויים לא יישמרו עד שהחיבור יחזור
        </div>
      )}
      {/* "YallaTrip במסך הבית": opens on request (the ☰ menu, or once on the first trip). */}
      <InstallSheet />
    </>
  );
}

/** Asks the service worker to keep this trip (its page, its plan and the trips list) for offline use. */
export function KeepOffline({ tripId, title }: { tripId: string; title: string }) {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !navigator.onLine) return;
    const t = setTimeout(() => {
      navigator.serviceWorker.ready.then((reg) => {
        reg.active?.postMessage({ type: 'keep', title, urls: [`/trips/${tripId}/plan`, `/trips/${tripId}/today`, `/trips/${tripId}`, '/trips'] });
      }).catch(() => {});
    }, 2500);
    return () => clearTimeout(t);
  }, [tripId, title]);
  return null;
}

/** After signing out: nothing of the previous user's trips stays on this phone. */
export function ClearOfflineData() {
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.ready.then((reg) => reg.active?.postMessage({ type: 'clear' })).catch(() => {});
    if ('caches' in window) caches.delete('gotrip-pages-v1').catch(() => {});
  }, []);
  return null;
}

