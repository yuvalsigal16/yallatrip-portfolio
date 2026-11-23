import { createClient } from '@/lib/supabase/server';
import { canEditTrip, getTrip } from '@/lib/trips/queries';
import { getTripPlan } from '@/lib/planning/queries';
import { getMapPlaces } from '@/lib/places/queries';
import { dayTimeline } from '@/lib/planning/rules';
import { BOOKING_COLUMNS, kindOf, type Booking } from '@/lib/trips/bookings';
import { FEATURES } from '@/lib/features';
import { buildIcs, type IcsEvent } from '@/lib/trips/ics';

// GET /trips/{id}/calendar -> the trip as a calendar file: every scheduled stop and every dated booking.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user || !(await canEditTrip(supabase, id))) return new Response('Not found', { status: 404 });
  const trip = await getTrip(supabase, id);
  if (!trip) return new Response('Not found', { status: 404 });
  const [days, places, { data: bookingRows }] = await Promise.all([
    getTripPlan(supabase, trip.id),
    getMapPlaces(supabase, trip.id),
    // Bookings switched off (src/lib/features.ts): saved bookings stay in the database, unseen.
    FEATURES.bookings ? supabase.from('trip_bookings').select(BOOKING_COLUMNS).eq('trip_id', trip.id) : Promise.resolve({ data: null }),
  ]);
  const byId = new Map(places.map((p) => [p.id, p]));
  const events: IcsEvent[] = [];
  for (const d of days) {
    if (!d.date) continue;
    const stops = d.stops.map((s) => ({ s, place: byId.get(s.savedPlaceId) })).filter((x) => x.place);
    const times = dayTimeline(d.startTime ?? '09:00', null,
      stops.map(({ s, place }) => ({ categoryKey: place!.categoryKey, durationMin: s.durationMin })), stops.map(() => 15 * 60));
    stops.forEach(({ s, place }, i) => {
      events.push({
        uid: `stop-${s.id}`, title: place!.label, date: d.date!, time: s.plannedTime ?? null,
        minutes: times[i]?.stayMin || 30,
        description: [s.note ?? place!.note, `https://www.google.com/maps/search/?api=1&query=${place!.lat},${place!.lng}&query_place_id=${place!.googlePlaceId}`].filter(Boolean).join('\n'),
        location: place!.label,
      });
    });
  }
  for (const b of (bookingRows ?? []) as unknown as Booking[]) {
    if (!b.starts_on) continue;
    events.push({
      uid: `booking-${b.id}`, title: `${kindOf(b.kind).icon} ${b.title}`, date: b.starts_on,
      time: b.start_time ? b.start_time.slice(0, 5) : null, minutes: 60, endDate: b.ends_on,
      description: [b.confirmation ? `אישור: ${b.confirmation}` : null, b.note].filter(Boolean).join('\n') || null,
    });
  }
  const safe = trip.title.replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 40) || 'trip';
  return new Response(buildIcs(`YallaTrip · ${trip.title}`, events), {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': `inline; filename="yallatrip.ics"; filename*=UTF-8''${encodeURIComponent(`YallaTrip ${safe}`)}.ics`,
      'cache-control': 'private, no-store',
    },
  });
}
