'use client';

import type { TripLeg } from '@/lib/trips/rules';
import { nightsOf } from '@/lib/trips/chapters';

const short = (d: string | null) => (d ? `${Number(d.slice(8, 10))}.${Number(d.slice(5, 7))}` : '');
const nightsHe = (n: number) => (n === 1 ? 'לילה אחד' : n === 2 ? 'שני לילות' : `${n} לילות`);

/**
 * A trip with several places, as chapters: each place with its nights and dates.
 * Tapping a place shows only its days (and moves the map there); − / + trades a night with the
 * neighbouring place, so the trip's length never changes.
 */
export function ChaptersStrip({ legs, selected, onSelect, onNight, busy }: {
  legs: TripLeg[];
  selected: number | null;
  onSelect: (i: number | null) => void;
  onNight: (i: number, by: 1 | -1) => void;
  busy: boolean;
}) {
  const totalNights = legs.reduce((s, l) => s + nightsOf(l), 0);
  return (
    <section aria-label="המקומות בטיול" data-tour="chapters" className="flex flex-col gap-2">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <button type="button" aria-pressed={selected === null} onClick={() => onSelect(null)}
          className={`flex min-w-[92px] shrink-0 flex-col justify-center rounded-2xl border px-3 py-2 text-right ${selected === null ? 'border-ink bg-ink text-white' : 'border-line bg-white'}`}>
          <span className="text-sm font-extrabold">🗺️ כל הטיול</span>
          <span className={`text-xs font-semibold ${selected === null ? 'text-white/75' : 'text-muted'}`}>{legs.length} מקומות · {totalNights} לילות</span>
        </button>
        {legs.map((l, i) => {
          const on = selected === i;
          return (
            <button key={`${l.name}-${i}`} type="button" aria-pressed={on} onClick={() => onSelect(on ? null : i)}
              className={`flex min-w-[124px] max-w-[180px] shrink-0 flex-col rounded-2xl border px-3 py-2 text-right ${on ? 'border-terracotta bg-terracotta text-white' : 'border-line bg-white'}`}>
              <span className="truncate text-sm font-extrabold"><span className={on ? 'text-white/80' : 'text-muted'}>{i + 1} · </span>{l.name}</span>
              <span className={`text-xs font-semibold ${on ? 'text-white/80' : 'text-muted'}`}>
                {nightsHe(nightsOf(l))} · <span dir="ltr">{short(l.start)}–{short(l.end)}</span>
              </span>
            </button>
          );
        })}
      </div>
      {selected !== null && legs[selected] && (
        <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2" data-tour="chapter-nights">
          <span className="min-w-0 flex-1 text-sm font-bold">כמה לילות ב{legs[selected]!.name}?</span>
          <button type="button" disabled={busy || nightsOf(legs[selected]!) <= 1} onClick={() => onNight(selected, -1)}
            aria-label={`לילה אחד פחות ב${legs[selected]!.name}`} className="h-9 w-9 rounded-full border border-line text-lg font-bold disabled:opacity-30">−</button>
          <span className="w-16 text-center text-sm font-extrabold">{nightsHe(nightsOf(legs[selected]!))}</span>
          <button type="button" disabled={busy} onClick={() => onNight(selected, 1)}
            aria-label={`לילה אחד יותר ב${legs[selected]!.name}`} className="h-9 w-9 rounded-full border border-line text-lg font-bold disabled:opacity-30">+</button>
        </div>
      )}
    </section>
  );
}
