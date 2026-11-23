import { paceInfo, paceOf } from '@/lib/planning/pace';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireOnboardedUser } from '@/lib/auth/session';
import { canEditTrip, getTrip } from '@/lib/trips/queries';
import { getTripPlan } from '@/lib/planning/queries';
import { getMapPlaces } from '@/lib/places/queries';
import { dayTimeline } from '@/lib/planning/rules';
import { CATEGORIES } from '@/lib/places/categories';
import { BOOKING_COLUMNS, kindOf, sortBookings, type Booking } from '@/lib/trips/bookings';
import { FEATURES } from '@/lib/features';
import { TodayView, type TodayDay } from './TodayView';

export const metadata: Metadata = { title: 'היום · YallaTrip', robots: { index: false, follow: false } };

const categoryLabel = (k: string | null) => CATEGORIES.find((c) => c.key === k)?.name ?? 'מקום';

/**
 * The screen for the trip itself: today's day, the next stop with a "navigate" button, and today's
 * bookings. It carries every day of the trip (text only), so the phone picks "today" by its own
 * clock and the saved copy works without internet on any day.
 */
export default async function TodayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireOnboardedUser(`/trips/${id}/today`);
  if (!(await canEditTrip(supabase, id))) notFound();
  const trip = await getTrip(supabase, id);
  if (!trip) notFound();
  const [plan, places, { data: bookingRows }, { data: flags }] = await Promise.all([
    getTripPlan(supabase, trip.id),
    getMapPlaces(supabase, trip.id),
    // Bookings switched off (src/lib/features.ts): saved bookings stay in the database, unseen.
    FEATURES.bookings ? supabase.from('trip_bookings').select(BOOKING_COLUMNS).eq('trip_id', trip.id).not('starts_on', 'is', null) : Promise.resolve({ data: null }),
    supabase.from('trips').select('keeps_shabbat, pace').eq('id', trip.id).maybeSingle(),
  ]);
  const byId = new Map(places.map((p) => [p.id, p]));
  const dayStart = paceInfo(FEATURES.pace ? paceOf((flags as { pace?: string | null } | null)?.pace, trip.travel_styles) : 'normal').start;
  const bookings = sortBookings(((bookingRows ?? []) as unknown as Booking[]).map((b) => ({ ...b, start_time: b.start_time ? b.start_time.slice(0, 5) : null })));
  const days: TodayDay[] = plan.map((d) => {
    const stops = d.stops.map((s) => ({ s, place: byId.get(s.savedPlaceId) })).filter((x) => x.place);
    const times = dayTimeline(d.startTime ?? dayStart, null,
      stops.map(({ s, place }) => ({ categoryKey: place!.categoryKey, durationMin: s.durationMin })), stops.map(() => 15 * 60));
    return {
      id: d.id, index: d.dayIndex, date: d.date, title: d.title, notes: d.notes ?? null,
      stops: stops.map(({ s, place }, i) => ({
        id: s.id, savedPlaceId: place!.id, label: place!.label, category: categoryLabel(place!.categoryKey),
        time: s.plannedTime ?? null, stayMin: times[i]?.stayMin ?? 60, note: s.note ?? place!.note,
        lat: place!.lat, lng: place!.lng, gpid: place!.googlePlaceId, visited: !!s.done, isMust: place!.isMust,
        alts: (s.alts ?? []).flatMap((a) => { const ap = byId.get(a.savedPlaceId); return ap ? [{ id: a.id, label: ap.label }] : []; }),
      })),
      bookings: bookings.filter((b) => b.starts_on === d.date).map((b) => ({
        id: b.id, icon: kindOf(b.kind).icon, title: b.title, time: b.start_time, confirmation: b.confirmation, note: b.note, hasFile: !!b.file_path,
      })),
    };
  });
  const drive = trip.transport_modes.some((m) => m === 'car' || m === 'taxi');
  const transit = !drive && trip.transport_modes.includes('transit') && !trip.transport_modes.includes('walk');
  return <TodayView tripId={trip.id} title={trip.title} days={days} travelMode={drive ? 'driving' : transit ? 'transit' : 'walking'}
    keepsShabbat={(flags as { keeps_shabbat?: boolean } | null)?.keeps_shabbat === true}
    center={trip.center_lat !== null && trip.center_lng !== null ? { lat: trip.center_lat, lng: trip.center_lng } : null} />;
}
