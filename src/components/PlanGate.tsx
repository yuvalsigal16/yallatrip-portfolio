'use client';

import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { FEATURES } from '@/lib/features';

export type PlanAccess = { active: boolean; has: boolean };

/** The small mark on tools that will be part of a paid plan. */
export function PlanBadge() {
  return <span className="inline-flex shrink-0 items-center rounded-full bg-[#FFF4E0] px-2 py-0.5 text-[11px] font-extrabold text-[#8A5A00]">⭐ במנוי</span>;
}

/**
 * Wraps a plan tool. Subscriptions off: the tool works for everyone, with "⭐ במנוי" beside it.
 * Subscriptions on and no plan: tapping it opens a short "זה חלק מהמנוי" sheet instead (the tool itself is unchanged).
 * "תוכניות ומחירים" switched off (src/lib/features.ts): the tool is just itself, open to everyone, with no mark.
 */
export function PlanGate({ access, children, className = '' }: { access: PlanAccess; children: ReactNode; className?: string }) {
  const [ask, setAsk] = useState(false);
  const locked = FEATURES.plans && access.active && !access.has;
  return (
    <div className={`relative ${className}`}
      onClickCapture={locked ? (e) => {
        // Only taps on the tool itself: the sheet lives on <body>, but React still passes its taps through here.
        if (!e.currentTarget.contains(e.target as Node)) return;
        e.preventDefault(); e.stopPropagation(); setAsk(true);
      } : undefined}>
      {children}
      {FEATURES.plans && !access.active && <span className="pointer-events-none absolute -top-2 start-2"><PlanBadge /></span>}
      {ask && createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="plan-ask"
          onClick={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) setAsk(false); }}>
          <div className="w-full max-w-sm rounded-t-3xl bg-white p-6 text-center shadow-xl sm:rounded-3xl">
            <p className="text-3xl" aria-hidden="true">⭐</p>
            <h2 id="plan-ask" className="mt-1 text-xl font-extrabold">זה חלק מהמנוי</h2>
            <p className="mt-2 text-ink-2">הכלים לזמן הטיול וסיכום הטיול לשיתוף פתוחים עם כרטיס טיול או מנוי שנתי.</p>
            <a href="/plans" className="mt-4 flex min-h-12 items-center justify-center rounded-full bg-gradient-to-l from-[#1B73C9] to-[#2E9BDB] px-6 font-bold text-white no-underline">תוכניות ומחירים</a>
            <button type="button" onClick={() => setAsk(false)} className="mt-2 min-h-11 w-full rounded-full font-bold text-ink-2">לא עכשיו</button>
          </div>
        </div>
      , document.body)}
    </div>
  );
}
