'use client';

import { useEffect, useState } from 'react';

const localToday = () => new Date().toLocaleDateString('en-CA');
const during = (start: string | null, end: string | null, t: string) => !!start && !!end && start <= t && t <= end;

/** In the trip's header, only on the trip's own dates: one tap to "today". */
export function TodayButton({ tripId, start, end }: { tripId: string; start: string | null; end: string | null }) {
  const [show, setShow] = useState(false);
  useEffect(() => setShow(during(start, end, localToday())), [start, end]);
  if (!show) return null;
  return (
    <a href={`/trips/${tripId}/today`} data-tour="today"
      className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[#FFD166] px-3 text-sm font-extrabold text-[#0B3D6E] no-underline shadow-md sm:px-4">
      <span className="h-2 w-2 rounded-full bg-[#B42318]" aria-hidden="true" />היום
    </a>
  );
}

/** On "my trips": the trip that is happening right now, with a way straight into its day. */
export function TodayBanner({ trips }: { trips: { id: string; title: string; start_date: string | null; end_date: string | null }[] }) {
  const [trip, setTrip] = useState<(typeof trips)[number] | null>(null);
  useEffect(() => { const t = localToday(); setTrip(trips.find((x) => during(x.start_date, x.end_date, t)) ?? null); }, [trips]);
  if (!trip) return null;
  return (
    <a href={`/trips/${trip.id}/today`} data-tour="today-banner"
      className="mb-8 flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-l from-[#1B73C9] to-[#2E9BDB] p-4 text-white no-underline shadow-[0_14px_30px_-14px_rgba(27,115,201,.8)]">
      <span className="min-w-0">
        <span className="block text-sm font-bold text-white/85">עכשיו בטיול</span>
        <span className="block truncate text-xl font-black">{trip.title}</span>
      </span>
      <span className="shrink-0 rounded-full bg-white px-4 py-2 text-sm font-extrabold text-[#0B3D6E]">למסך של היום ←</span>
    </a>
  );
}
