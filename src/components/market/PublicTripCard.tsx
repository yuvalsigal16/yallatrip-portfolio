import type { PublicTrip } from '@/lib/market/queries';
import { formatDateRangeHe } from '@/lib/trips/rules';
import { TripCover } from '@/components/trips/TripCover';

const COVERS = [
  { bg: 'linear-gradient(160deg, #0E4A86, #2E86C9)' },
  { bg: 'linear-gradient(160deg, #0B2F55, #1B73C9)' },
  { bg: 'linear-gradient(160deg, #0B5E73, #2A9BC4)' },
  { bg: 'linear-gradient(160deg, #173E7A, #3F7FD0)' },
];

/** A trip someone made public: opens the read-only view, where it can be added to your trips and edited. Yours opens for editing. */
export function PublicTripCard({ t, index = 0 }: { t: PublicTrip; index?: number }) {
  const cover = COVERS[index % COVERS.length]!;
  const range = formatDateRangeHe(t.start_date, t.end_date);
  const route = (t.destinations ?? []).map((d) => d.name).filter(Boolean);
  return (
    <a href={t.mine ? `/trips/${t.id}` : `/s/${t.share_token}`}
      className="group flex flex-col overflow-hidden rounded-3xl border border-line bg-white text-ink no-underline transition duration-300 hover:-translate-y-1">
      <TripCover tripId={t.id} title={t.destination_name} bg={cover.bg}
        chip={t.mine ? 'הטיול שלך' : 'ציבורי'} chipClass={t.mine ? 'bg-terracotta text-white' : 'bg-white text-ink'} />
      <div className="flex flex-1 flex-col gap-1.5 p-5">
        <h3 className="text-lg font-extrabold leading-snug">{t.title}</h3>
        {route.length > 1 && <p className="truncate text-sm font-bold text-ink-2">{route.join(' ← ')}</p>}
        <p className="text-sm text-ink-2">
          {t.days_count} ימים · {t.places_count} מקומות{t.owner_name && ` · של ${t.owner_name}`}
        </p>
        {range && <p className="text-sm text-muted">{range}</p>}
        <p className="mt-auto pt-2 text-sm font-bold text-terracotta">{t.mine ? 'עריכה ←' : 'צפייה והוספה לטיולים שלי ←'}</p>
      </div>
    </a>
  );
}
