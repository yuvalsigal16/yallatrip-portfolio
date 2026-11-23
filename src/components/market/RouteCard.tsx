import type { CatalogRoute } from '@/lib/market/queries';
import { formatPrice } from '@/lib/market/rules';
import { TripCover } from '@/components/trips/TripCover';

const COVERS = [
  'linear-gradient(160deg, #0E4A86, #2E86C9)', 'linear-gradient(160deg, #0B2F55, #1B73C9)',
  'linear-gradient(160deg, #0B5E73, #2A9BC4)', 'linear-gradient(160deg, #173E7A, #3F7FD0)',
];

/** A route in the store: destination, creator, length, rating, price. */
export function RouteCard({ r, index = 0 }: { r: CatalogRoute; index?: number }) {
  return (
    <a href={`/routes/${r.id}`} className="group flex flex-col overflow-hidden rounded-3xl border border-line bg-white text-ink no-underline transition duration-300 hover:-translate-y-1">
      <TripCover tripId={r.id} title={r.destination_name} bg={COVERS[index % COVERS.length]!}
        chip={formatPrice(r.price_agorot)} chipClass={r.price_agorot === 0 ? "bg-[#E3F5EA] text-[#1E6B3A] shadow-md" : "bg-white text-ink shadow-md"} />
      <div className="flex flex-1 flex-col gap-1.5 p-5">
        <h3 className="text-lg font-extrabold leading-snug">{r.title}</h3>
        <p className="text-sm text-ink-2">{r.days_count} ימים · {r.places_count} מקומות · מאת {r.creator_name}</p>
        <p className="mt-auto pt-2 text-sm font-bold">
          {r.rating_count > 0 ? <span><span className="text-[#E0A21B]">★</span> {r.rating_avg.toFixed(1)} <span className="font-semibold text-muted">({r.rating_count})</span></span> : <span className="text-muted">עוד אין דירוגים</span>}
          {r.acquisitions > 0 && <span className="font-semibold text-muted"> · {r.acquisitions} מטיילים</span>}
        </p>
      </div>
    </a>
  );
}
