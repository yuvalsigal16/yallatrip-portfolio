import { formatDateRangeHe, formatLegDatesHe, formatLengthHe, TRAVELER_LABEL, transportLabel, tripLengthDays } from '@/lib/trips/rules';
import type { TripDetail, TripPerson } from '@/lib/trips/queries';
import { Avatar } from '@/components/Avatar';
import { TripMenu } from './TripMenu';
import { TodayButton } from './TodayEntry';
import type { PlanAccess } from '@/components/PlanGate';

const pillLook = 'items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[13px] font-semibold text-white backdrop-blur';
const pill = `inline-flex ${pillLook}`;

// The trip's header: back, title, dates, who & how, settings.
export function TripTopBar({ trip, people = [], isAdmin = false, plan }: { trip: TripDetail; people?: TripPerson[]; isAdmin?: boolean; plan?: PlanAccess }) {
  const range = formatDateRangeHe(trip.start_date, trip.end_date);
  const len = trip.start_date && trip.end_date ? tripLengthDays(trip.start_date, trip.end_date) : null;
  return (
    <div className="relative isolate flex flex-col gap-2.5 overflow-hidden bg-[#0B3D6E] px-4 py-3 text-white sm:gap-3 sm:py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
      {/* The trip's own photo (if the owner added one) behind the trip's name */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {trip.cover_url && <img src={trip.cover_url} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" />}
      <div className="absolute inset-0 -z-10 bg-gradient-to-l from-[#051A33]/90 via-[#0B3D6E]/75 to-[#0B3D6E]/45" aria-hidden="true" />
      <div className="flex min-w-0 items-center gap-3">
        <a href="/trips" aria-label="חזרה לטיולים שלי"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white no-underline backdrop-blur transition hover:bg-white/25">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </a>
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl font-bold leading-tight sm:text-2xl">{trip.title}</h1>
          <div className="text-[13px] font-semibold text-white/80">
            {range ? `${range} · ${formatLengthHe(len ?? 1).split(' · ')[0]}` : 'עוד אין תאריכים'}
            {trip.title !== trip.destination_name && trip.destinations.length === 0 && ` · ${trip.destination_name}`}
          </div>
          {trip.destinations.length > 0 && (
            <ol className="mt-1.5 flex flex-wrap items-center gap-1 text-[13px]" aria-label="היעדים בטיול">
              {trip.destinations.map((l, i) => {
                const dates = formatLegDatesHe(l);
                return (
                  <li key={i} className="flex items-center gap-1">
                    {i > 0 && <span className="text-white/60" aria-hidden="true">←</span>}
                    <span className="rounded-full bg-white/15 px-2.5 py-0.5 font-bold text-white">
                      {l.name}{dates && <span className="font-semibold text-white/75"> · {dates}</span>}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {people.length > 1 && (
          <span className={pill} title={people.map((x) => x.name).join(', ')}>
            <span className="flex -space-x-2 rtl:space-x-reverse">
              {people.slice(0, 4).map((x) => <Avatar key={x.id} url={x.avatar} name={x.name} size={22} className="ring-2 ring-[#0B3D6E]" />)}
            </span>
            טיול משותף
          </span>
        )}
        <span className={`hidden sm:inline-flex ${pillLook}`}>{TRAVELER_LABEL(trip.travelers_count)}</span>
        <span className={`hidden sm:inline-flex ${pillLook}`}>{transportLabel(trip.transport_modes)}</span>
        <TodayButton tripId={trip.id} start={trip.start_date} end={trip.end_date} />
        {isAdmin && (
          <a href={`/trips/${trip.id}?tour=1`} data-tour="help" aria-label="הדרכה"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-white/15 px-3 text-sm font-bold text-white no-underline backdrop-blur transition hover:bg-white/25 sm:px-4">
            הדרכה
          </a>
        )}
        <TripMenu tripId={trip.id} plan={plan} withDates={!!trip.start_date} center={trip.center_lat != null && trip.center_lng != null ? { lat: trip.center_lat, lng: trip.center_lng } : null} />
        <a href={`/trips/${trip.id}/settings`} data-tour="settings"
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-white px-3 text-sm font-bold text-ink no-underline shadow-md transition hover:text-terracotta sm:px-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" />
          </svg>
          הגדרות<span className="hidden sm:inline"> טיול</span>
        </a>
      </div>
    </div>
  );
}
