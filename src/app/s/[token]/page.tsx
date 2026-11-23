import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Alert, Logo } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { createClient } from '@/lib/supabase/server';
import { categoryMeta } from '@/lib/places/categories';
import { formatDateRangeHe, formatDayHe, TRAVELER_LABEL } from '@/lib/trips/rules';
import { googleDirectionsUrl, googlePlaceUrl, isShareToken } from '@/lib/sharing/rules';
import { cloneSharedTrip } from '@/app/trips/share-actions';

type SharedStop = {
  planned_time: string | null; note: string | null; label: string; google_place_id: string; lat: number; lng: number;
  category_key: string | null; review?: string | null; photos?: string[] | null;
};
type Recommended = Omit<SharedStop, 'planned_time' | 'note'>;
type Shared = {
  trip: { title: string; destination_name: string; start_date: string | null; end_date: string | null; travelers_count: number; visibility: string };
  hotel: { label: string; lat: number; lng: number; google_place_id: string } | null;
  days: { day_index: number; date: string | null; title: string | null; stops: SharedStop[] }[];
  recommended?: Recommended[];
  /** The owner looking at their own shared trip: edit it instead of copying. */
  mine?: boolean;
  trip_id?: string | null;
  unscheduled_count: number;
};

/** The traveler's own recommendation and photos for a place. */
function MyTake({ review, photos, label }: { review?: string | null; photos?: string[] | null; label: string }) {
  const pics = (photos ?? []).filter((u) => typeof u === 'string' && u.startsWith('https://'));
  if (!review && pics.length === 0) return null;
  return (
    <div className="mt-2 flex flex-col gap-2 rounded-xl bg-sand p-3">
      {review && <p className="whitespace-pre-line text-[15px] text-ink"><span className="font-extrabold">💬 ההמלצה שלי: </span>{review}</p>}
      {pics.length > 0 && (
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {pics.map((u, i) => (
            <li key={u} className="shrink-0">
              <a href={u} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt={`${label}, תמונה ${i + 1}`} loading="lazy" className="h-28 w-28 rounded-lg object-cover sm:h-36 sm:w-36" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function load(token: string): Promise<Shared | null> {
  if (!isShareToken(token)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc('get_shared_trip', { p_token: token });
  return (data as unknown as Shared | null) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const shared = await load((await params).token);
  return {
    title: shared ? `${shared.trip.title} · טיול ב-YallaTrip` : 'טיול · YallaTrip',
    // link-only trips must not show up in search engines
    robots: shared?.trip.visibility === 'public' ? undefined : { index: false, follow: false },
  };
}

// A shared trip: read-only, no login needed. "Copy to my trips" asks to sign in.
export default async function SharedTripPage({ params, searchParams }: {
  params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const shared = await load(token);
  if (!shared) notFound();
  const { trip, days, hotel } = shared;
  const range = formatDateRangeHe(trip.start_date, trip.end_date);
  const planned = days.filter((d) => d.stops.length);

  return (
    <div className="app-skin mx-auto max-w-[820px] px-5 py-6 sm:px-8">
      <Logo />
      <header className="relative isolate mt-8 flex flex-col gap-4 overflow-hidden rounded-[28px] bg-[#0B3D6E] p-6 pt-24 text-white shadow-[0_24px_50px_-20px_rgba(6,32,61,.6)] sm:p-9 sm:pt-32">
        <div className="absolute inset-0 -z-10 bg-gradient-to-l from-[#051A33]/90 via-[#0B3D6E]/70 to-[#0B3D6E]/35" aria-hidden="true" />
        <p className="text-sm font-bold text-[#A9DBF5]">{shared.mine ? 'הטיול שלך, כמו שאחרים רואים אותו' : trip.visibility === 'public' ? 'טיול ציבורי' : 'טיול ששותף איתך'}</p>
        <h1 className="font-display text-4xl font-black sm:text-5xl">{trip.title}</h1>
        <p className="font-semibold text-white/85">
          {trip.destination_name}{range && ` · ${range}`} · {TRAVELER_LABEL(trip.travelers_count)}
        </p>
        {shared.mine && shared.trip_id ? (
          <a href={`/trips/${shared.trip_id}`} className="w-fit rounded-full bg-white px-6 py-3 font-bold text-ink no-underline shadow-lg">עריכת הטיול</a>
        ) : (
          <>
            <form action={cloneSharedTrip}>
              <input type="hidden" name="token" value={token} />
              <SubmitButton full={false} pendingText="מוסיפים לטיולים שלך...">הוספה לטיולים שלי ועריכה</SubmitButton>
            </form>
            <p className="text-xs text-white/75">הטיול נכנס לטיולים שלך ונפתח לעריכה מיד. השינויים שלך לא משנים את הטיול המקורי.</p>
          </>
        )}
      </header>

      {sp.error === 'copy' && <div className="mt-4"><Alert>ההוספה לטיולים שלך לא הצליחה. נסו שוב.</Alert></div>}

      {hotel && (
        <p className="mt-6 rounded-2xl border border-line bg-white p-4">
          <b>המלון:</b> <a href={googlePlaceUrl(hotel)} target="_blank" rel="noopener noreferrer">{hotel.label}</a>
        </p>
      )}

      <div className="mt-6 flex flex-col gap-5">
        {planned.length === 0 && <p className="text-ink-2">בטיול הזה עוד לא שובצו מקומות לימים.</p>}
        {planned.map((d) => {
          const dir = googleDirectionsUrl(d.stops);
          return (
            <section key={d.day_index} className="rounded-3xl border border-line bg-white p-5" aria-labelledby={`d${d.day_index}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id={`d${d.day_index}`} className="font-display text-2xl font-bold">
                  יום {d.day_index}{d.date && ` · ${formatDayHe(d.date)}`}{d.title && ` · ${d.title}`}
                </h2>
                {dir && <a href={dir} target="_blank" rel="noopener noreferrer" className="text-sm font-bold">כל היום ב-Google Maps ↗</a>}
              </div>
              <ol className="mt-3 flex flex-col gap-2">
                {d.stops.map((s, i) => {
                  const meta = categoryMeta(s.category_key);
                  return (
                    <li key={i} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white" style={{ background: meta.color }}>{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <a href={googlePlaceUrl(s)} target="_blank" rel="noopener noreferrer" className="font-extrabold text-ink">{s.label}</a>
                        <div className="text-sm text-ink-2">{s.planned_time && `${s.planned_time} · `}{meta.name}{s.note && ` · ${s.note}`}</div>
                        <MyTake review={s.review} photos={s.photos} label={s.label} />
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
        {(shared.recommended ?? []).length > 0 && (
          <section className="rounded-3xl border border-line bg-white p-5" aria-labelledby="recs">
            <h2 id="recs" className="font-display text-2xl font-bold">עוד המלצות שלי</h2>
            <ul className="mt-3 flex flex-col gap-4">
              {(shared.recommended ?? []).map((r) => (
                <li key={r.google_place_id}>
                  <a href={googlePlaceUrl(r)} target="_blank" rel="noopener noreferrer" className="font-extrabold text-ink">{r.label}</a>
                  <span className="text-sm text-ink-2"> · {categoryMeta(r.category_key).name}</span>
                  <MyTake review={r.review} photos={r.photos} label={r.label} />
                </li>
              ))}
            </ul>
          </section>
        )}
        {shared.unscheduled_count > 0 && (
          <p className="text-sm text-muted">ועוד {shared.unscheduled_count} מקומות שמורים שעוד לא שובצו לימים (ייכנסו גם הם כשמוסיפים לטיולים שלך).</p>
        )}
      </div>
    </div>
  );
}
