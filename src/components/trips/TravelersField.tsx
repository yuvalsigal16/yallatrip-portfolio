'use client';

import { useState } from 'react';
import { MAX_TRAVELERS, TRAVELER_LABEL } from '@/lib/trips/rules';

/** "How many are going?" with − / + buttons. */
export function TravelersField({ defaultValue = 2, error }: { defaultValue?: number; error?: string }) {
  const [n, setN] = useState(defaultValue);
  const step = (d: number) => setN((v) => Math.min(MAX_TRAVELERS, Math.max(1, v + d)));
  const btn = 'flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-white text-2xl font-bold hover:bg-sand-2 disabled:opacity-40';
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-lg font-extrabold">כמה נוסעים?</legend>
      <div className="flex items-center gap-3">
        <button type="button" className={btn} onClick={() => step(-1)} disabled={n <= 1} aria-label="פחות מטיילים">−</button>
        <input name="travelers" type="number" min={1} max={MAX_TRAVELERS} value={n} aria-label="מספר מטיילים"
          onChange={(e) => setN(Number(e.target.value) || 1)}
          className="h-12 w-20 rounded-xl border border-line bg-white text-center text-xl font-extrabold outline-none focus:border-ink" />
        <button type="button" className={btn} onClick={() => step(1)} disabled={n >= MAX_TRAVELERS} aria-label="יותר מטיילים">+</button>
        <span className="text-[15px] font-bold text-ink-2">{TRAVELER_LABEL(n)}</span>
      </div>
      {error && <p className="text-sm font-semibold text-danger">{error}</p>}
    </fieldset>
  );
}
