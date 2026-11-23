import { formatDateRangeHe, formatLengthHe, tripLengthDays, tripStatus } from '@/lib/trips/rules';
import type { TripSummary } from '@/lib/trips/queries';
import { TripCover } from './TripCover';
import { CoverPlus } from './CoverPlus';

// Cover colors cycle so neighbouring cards differ; shown when the trip has no photo of its own.
const COVERS = [
  { bg: 'linear-gradient(160deg, #0E4A86, #2E86C9)' },
  { bg: 'linear-gradient(160deg, #0B2F55, #1B73C9)' },
  { bg: 'linear-gradient(160deg, #0B5E73, #2A9BC4)' },
  { bg: 'linear-gradient(160deg, #173E7A, #3F7FD0)' },
];

export function TripCard({ trip, today, index }: { trip: TripSummary; today: string; index: number }) {
  const cover = COVERS[index % COVERS.length]!;
  const status = tripStatus(trip.start_date, trip.end_date, today);
  const range = formatDateRangeHe(trip.start_date, trip.end_date);
  const len = trip.start_date && trip.end_date ? tripLengthDays(trip.start_date, trip.end_date) : null;
  const progress = trip.savedCount ? Math.round((Math.min(trip.scheduledCount, trip.savedCount) / trip.savedCount) * 100) : 0;
  const chip =
    status.kind === 'ongoing' ? 'bg-sea text-white shadow-md' :
    status.kind === 'upcoming' ? 'bg-white/90 text-terracotta shadow-md backdrop-blur' :
    'bg-white/80 text-ink-2 backdrop-blur';

  return (
    <a href={`/trips/${trip.id}`}
      className="group block overflow-hidden rounded-3xl border border-line bg-white text-ink no-underline transition duration-300 hover:-translate-y-1">
      <TripCover tripId={trip.id} title={trip.title} bg={cover.bg} src={trip.cover_url} chip={status.label} chipClass={chip}
        extra={trip.isOwner ? <CoverPlus tripId={trip.id} hasPhoto={!!trip.cover_url} /> : null} />
      <div className="p-5">
        {trip.shared && <span className="mb-1.5 inline-block rounded-full bg-terracotta-tint px-2.5 py-0.5 text-xs font-extrabold text-terracotta">טיול משותף</span>}
        <div className="font-bold">{range ? `${range}${len ? ` · ${formatLengthHe(len).split(' · ')[0]}` : ''}` : 'עוד אין תאריכים'}</div>
        <div className="mt-1 text-sm text-ink-2">
          {trip.savedCount === 0
            ? 'עוד לא נשמרו מקומות'
            : `${trip.savedCount} מקומות שמורים · ${trip.scheduledCount} משובצים בימים`}
        </div>
        {trip.savedCount > 0 && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sand-2" role="img" aria-label={`${progress}% מהמקומות משובצים`}>
            <div className="h-full rounded-full bg-gradient-to-l from-[#1B73C9] to-[#35A7E0]" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
    </a>
  );
}
