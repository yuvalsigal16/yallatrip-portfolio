'use client';

import { useEffect, useState } from 'react';

/** Live countdown to the start of the next trip (midnight of its first day, the viewer's clock). */
export function Countdown({ startDate, title, href }: { startDate: string; title: string; href: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const [y, m, d] = startDate.split('-').map(Number);
  const target = new Date(y!, (m ?? 1) - 1, d ?? 1).getTime();
  const left = now === null ? null : Math.max(0, target - now);
  const parts = left === null ? null : {
    days: Math.floor(left / 86_400_000),
    hours: Math.floor(left / 3_600_000) % 24,
    minutes: Math.floor(left / 60_000) % 60,
    seconds: Math.floor(left / 1000) % 60,
  };
  const units: [keyof NonNullable<typeof parts>, string][] = [['days', 'ימים'], ['hours', 'שעות'], ['minutes', 'דקות'], ['seconds', 'שניות']];

  return (
    <a href={href} className="block rounded-2xl bg-gradient-to-l from-[#0C2D4A] to-[#1B73C9] p-5 text-white no-underline shadow-md hover:brightness-110">
      <p className="text-sm font-bold text-white/80">הספירה לאחור לטיול הבא</p>
      <p className="mt-0.5 text-xl font-extrabold">{title}</p>
      {left === 0 ? (
        <p className="mt-3 text-2xl font-black">הטיול התחיל! נסיעה טובה ✈</p>
      ) : (
        <div className="mt-4 grid grid-cols-4 gap-2" dir="rtl" aria-live="off"
          aria-label={parts ? `עוד ${parts.days} ימים, ${parts.hours} שעות ו-${parts.minutes} דקות` : undefined}>
          {units.map(([k, label]) => (
            <div key={k} className="flex flex-col items-center rounded-xl bg-white/12 py-2.5 backdrop-blur-sm">
              <span className="text-3xl font-black tabular-nums sm:text-4xl">{parts ? String(parts[k]).padStart(k === 'days' ? 1 : 2, '0') : '--'}</span>
              <span className="text-xs font-bold text-white/80">{label}</span>
            </div>
          ))}
        </div>
      )}
    </a>
  );
}
