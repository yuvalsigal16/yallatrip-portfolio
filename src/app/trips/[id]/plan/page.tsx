import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireOnboardedUser } from '@/lib/auth/session';
import { canEditTrip, getTrip } from '@/lib/trips/queries';
import { getTripPlan } from '@/lib/planning/queries';
import { getMapPlaces } from '@/lib/places/queries';
import { dayTimeline } from '@/lib/planning/rules';
import { formatDateRangeHe, formatDayHe } from '@/lib/trips/rules';
import { CATEGORIES } from '@/lib/places/categories';
import { BOOKING_COLUMNS, kindOf, sortBookings, type Booking } from '@/lib/trips/bookings';
import { FEATURES } from '@/lib/features';

import { PlanToolbar } from './PlanToolbar';

const categoryLabel = (k: string | null) => CATEGORIES.find((c) => c.key === k)?.name ?? 'מקום';

export const metadata: Metadata = { title: 'התוכנית · YallaTrip', robots: { index: false, follow: false } };

const mapsLink = (lat: number, lng: number, placeId: string) =>
  `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=${encodeURIComponent(placeId)}`;

/**
 * The whole trip on one light page: every day, its stops, times and notes. No map, so it opens
 * fast, prints well, and is kept on the phone for use without internet.
 */
export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireOnboardedUser(`/trips/${id}/plan`);
  if (!(await canEditTrip(supabase, id))) notFound();
  const trip = await getTrip(supabase, id);
  if (!trip) notFound();
  const [days, places, { data: hotelRow }, { data: list }, { data: bookingRows }] = await Promise.all([
    getTripPlan(supabase, trip.id),
    getMapPlaces(supabase, trip.id),
    supabase.from('trips').select('hotel_saved_place_id').eq('id', trip.id).maybeSingle(),
    supabase.from('trip_checklist_items').select('text, done').eq('trip_id', trip.id).eq('done', false).order('position'),
    // Bookings switched off (src/lib/features.ts): saved bookings stay in the database, unseen.
    FEATURES.bookings ? supabase.from('trip_bookings').select(BOOKING_COLUMNS).eq('trip_id', trip.id) : Promise.resolve({ data: null }),
  ]);
  const bookings = sortBookings(((bookingRows ?? []) as unknown as Booking[]).map((b) => ({ ...b, start_time: b.start_time ? b.start_time.slice(0, 5) : null })));
  const dayDates = new Set(days.map((d) => d.date).filter(Boolean));
  const looseBookings = bookings.filter((b) => !b.starts_on || !dayDates.has(b.starts_on));
  const bookingLine = (b: Booking) => (
    <li key={b.id} className="flex gap-2 text-sm">
      <span aria-hidden="true">{kindOf(b.kind).icon}</span>
      <span className="min-w-0">
        <b>{b.title}</b>
        {b.start_time && <> · <span dir="ltr">{b.start_time}</span></>}
        {b.confirmation && <> · אישור <span dir="ltr" className="font-bold">{b.confirmation}</span></>}
        {b.ends_on && ` · עד ${formatDayHe(b.ends_on)}`}
        {b.note && <span className="block whitespace-pre-line text-ink-2">{b.note}</span>}
      </span>
    </li>
  );
  const byId = new Map(places.map((p) => [p.id, p]));
  const hotel = byId.get((hotelRow as { hotel_saved_place_id: string | null } | null)?.hotel_saved_place_id ?? '');
  const range = formatDateRangeHe(trip.start_date, trip.end_date);
  const todo = (list ?? []) as { text: string }[];

  return (
    <div className="app-skin mx-auto max-w-[760px] px-4 pb-16 pt-4 print:max-w-none print:p-0">
      <PlanToolbar tripId={trip.id} />
      <header className="mb-6 border-b-2 border-ink pb-3">
        <p className="text-sm font-bold text-terracotta">YallaTrip · התוכנית</p>
        <h1 className="font-display text-3xl font-black">{trip.title}</h1>
        <p className="text-ink-2">{range ?? 'בלי תאריכים'}{trip.destinations.length > 1 ? ` · ${trip.destinations.map((d) => d.name).join(' ← ')}` : ''}</p>
        {hotel && <p className="mt-1 text-sm">🛏️ לינה: <a href={mapsLink(hotel.lat, hotel.lng, hotel.googlePlaceId)} className="font-bold">{hotel.label}</a></p>}
      </header>

      <div className="flex flex-col gap-6">
        {days.map((d) => {
          const stops = d.stops.map((s) => ({ s, place: byId.get(s.savedPlaceId) })).filter((x) => x.place);
          const times = dayTimeline(d.startTime ?? '09:00', null,
            stops.map(({ s, place }) => ({ categoryKey: place!.categoryKey, durationMin: s.durationMin })), stops.map(() => 15 * 60));
          return (
            <section key={d.id} className="break-inside-avoid rounded-2xl border border-line bg-white p-4 print:rounded-none print:border-x-0 print:border-t-0">
              <h2 className="text-lg font-extrabold">
                יום {d.dayIndex}{d.date ? ` · ${formatDayHe(d.date)}` : ''}{d.title ? ` · ${d.title}` : ''}
              </h2>
              {d.notes && <p className="mt-1 whitespace-pre-line text-sm text-ink-2">📝 {d.notes}</p>}
              {bookings.some((b) => b.starts_on === d.date) && (
                <ul className="mt-2 flex flex-col gap-1 rounded-xl bg-sand-2/60 p-2.5">{bookings.filter((b) => b.starts_on === d.date).map(bookingLine)}</ul>
              )}
              {stops.length === 0 ? <p className="text-muted">יום חופשי — עוד לא שובצו מקומות.</p> : (
                <ol className="mt-2 flex flex-col gap-2.5">
                  {stops.map(({ s, place }, i) => (
                    <li key={s.id} className="flex gap-3">
                      <span className="w-12 shrink-0 pt-0.5 text-sm font-bold tabular-nums text-ink-2" dir="ltr">{s.plannedTime}</span>
                      <div className="min-w-0">
                        <a href={mapsLink(place!.lat, place!.lng, place!.googlePlaceId)} className="font-bold text-ink">{place!.label}</a>
                        <span className="text-sm text-muted"> · {categoryLabel(place!.categoryKey)}{` · ${times[i]?.stayMin ?? 60} דק'`}</span>
                        {(s.note || place!.note) && <p className="whitespace-pre-line text-sm text-ink-2">{s.note ?? place!.note}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          );
        })}
      </div>

      {looseBookings.length > 0 && (
        <section className="mt-6 break-inside-avoid rounded-2xl border border-line bg-white p-4">
          <h2 className="text-lg font-extrabold">הזמנות ומסמכים</h2>
          <ul className="mt-2 flex flex-col gap-1.5">
            {looseBookings.map((b) => (
              <li key={b.id} className="flex flex-col">{b.starts_on && <span className="text-xs font-bold text-ink-2">{formatDayHe(b.starts_on)}</span>}<ul>{bookingLine(b)}</ul></li>
            ))}
          </ul>
        </section>
      )}

      {todo.length > 0 && (
        <section className="mt-6 break-inside-avoid rounded-2xl border border-line bg-white p-4">
          <h2 className="text-lg font-extrabold">עוד לא מוכן ברשימת ההכנות</h2>
          <ul className="mt-2 list-disc ps-5">{todo.map((t, i) => <li key={i}>{t.text}</li>)}</ul>
        </section>
      )}
      <p className="mt-6 text-xs text-muted">השעות בלי שעה שקבעתם הן הערכה. הקישורים פותחים את המקום ב-Google Maps.</p>
    </div>
  );
}
