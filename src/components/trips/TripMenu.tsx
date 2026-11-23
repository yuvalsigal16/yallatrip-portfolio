'use client';

import { useEffect, useState } from 'react';
import { PlanGate, type PlanAccess } from '@/components/PlanGate';
import { TripStoryButton } from '@/components/trip/TripStory';
import { FEATURES } from '@/lib/features';

const ITEMS = [
  { key: 'bookings', href: 'bookings', icon: '🎫', label: 'הזמנות', hint: 'טיסות, לינה, כרטיסים ומסמכים' },
  { key: 'checklist', href: 'checklist', icon: '✅', label: 'הכנות', hint: 'מה לארוז ומה לסדר' },
  { key: 'budget', href: 'budget', icon: '💰', label: 'תקציב', hint: 'הוצאות וכמה נשאר' },
  { key: 'album', href: 'album', icon: '📷', label: 'אלבום', hint: 'התמונות של הטיול' },
] as const;

/**
 * The trip's extra pages behind one button with an arrow, so the header stays light.
 * The list opens inside the header (it can't float: the header clips its photo).
 * The in-app guide opens it by itself when it explains one of the pages.
 */
export function TripMenu({ tripId, withDates = false, center = null, plan = { active: false, has: true } }: {
  tripId: string; withDates?: boolean; center?: { lat: number; lng: number } | null; plan?: PlanAccess;
}) {
  const items = ITEMS.filter((it) => it.key !== 'bookings' || FEATURES.bookings);
  void withDates;
  const [open, setOpen] = useState(false);
  // As many columns as there are items, so a switched-off feature leaves no empty space.
  const count = items.length + (FEATURES.tripStory ? 1 : 0) + (center ? 1 : 0);
  const cols = count >= 6 ? 'sm:grid-cols-3 lg:grid-cols-6' : count === 5 ? 'sm:grid-cols-3 lg:grid-cols-5' : count === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3';
  useEffect(() => {
    const onTour = (e: Event) => setOpen((e as CustomEvent<string | null>).detail === 'trip-menu');
    window.addEventListener('gotrip-tour-open', onTour);
    return () => window.removeEventListener('gotrip-tour-open', onTour);
  }, []);
  return (
    <>
      {/* The page every traveller should open before flying: out of the list, in its own bright button. */}
      <a href={`/trips/${tripId}/know`} data-tour="know"
        className="relative inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[#FFD166] px-3 text-sm font-extrabold text-ink no-underline shadow-md ring-2 ring-white/70 transition hover:bg-[#FFC53D] sm:px-4">
        <span aria-hidden="true">🌍</span> מה צריך לדעת
        <span className="absolute -top-1 -left-1 flex h-3 w-3" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E4572E] opacity-60" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-[#E4572E]" />
        </span>
      </a>
      <button type="button" data-tour="tools" aria-expanded={open} aria-controls="trip-menu" onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-white/15 px-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/25 sm:px-4">
        עוד בטיול
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <nav id="trip-menu" aria-label="עוד בטיול" className={`${open ? 'grid' : 'hidden'} order-last basis-full grid-cols-1 gap-1.5 rounded-2xl bg-white p-1.5 text-ink shadow-lg ${cols}`}>
        {items.map((it) => (
          <a key={it.key} href={`/trips/${tripId}/${it.href}`} data-tour={it.key}
            className="flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 text-ink no-underline transition hover:bg-sand-2 sm:flex-col sm:items-start sm:gap-0.5">
            <span className="text-xl" aria-hidden="true">{it.icon}</span>
            <span className="min-w-0">
              <span className="block text-[15px] font-extrabold leading-tight">{it.label}</span>
              <span className="block text-[13px] leading-tight text-ink-2">{it.hint}</span>
            </span>
          </a>
        ))}
        {/* "סיכום הטיול לשיתוף": a story picture made on the phone. Part of the paid plan (marked "⭐ במנוי"). */}
        {FEATURES.tripStory && <PlanGate access={plan} className="grid">
          <div data-tour="story" className="grid">
            <TripStoryButton tripId={tripId}
              className="flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 text-right text-ink transition hover:bg-sand-2 sm:flex-col sm:items-start sm:gap-0.5">
              <span className="text-xl" aria-hidden="true">📸</span>
              <span className="min-w-0">
                <span className="block text-[15px] font-extrabold leading-tight">סיכום הטיול</span>
                <span className="block text-[13px] leading-tight text-ink-2">תמונה לסטורי ולווטסאפ</span>
              </span>
            </TripStoryButton>
          </div>
        </PlanGate>}
        {center && (
          // Google lets its own app keep a map area on the phone for free; the site itself may not keep Google's map.
          <a href={`https://www.google.com/maps/search/?api=1&query=${center.lat},${center.lng}`} target="_blank" rel="noopener noreferrer" data-tour="offline-map"
            className="flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 text-ink no-underline transition hover:bg-sand-2 sm:flex-col sm:items-start sm:gap-0.5">
            <span className="text-xl" aria-hidden="true">📴</span>
            <span className="min-w-0">
              <span className="block text-[15px] font-extrabold leading-tight">מפה בלי אינטרנט</span>
              <span className="block text-[13px] leading-tight text-ink-2">שמירת האזור ב-Google Maps, בחינם</span>
            </span>
          </a>
        )}
      </nav>
    </>
  );
}
