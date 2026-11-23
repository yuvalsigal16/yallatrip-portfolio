'use server';

import { createClient } from '@/lib/supabase/server';
import { getTrip } from '@/lib/trips/queries';
import { getTripPlan } from '@/lib/planning/queries';
import { getMapPlaces } from '@/lib/places/queries';
import { countriesFor } from '@/lib/countries/info';
import { tripLengthDays } from '@/lib/trips/rules';
import { isUuid } from '@/lib/validation';
import { mayUsePlanTools } from '@/lib/plans-access';

export type TripStory = {
  title: string;
  cover: string | null;
  days: number;
  countries: number;
  cities: number;
  /** Places ticked "I was here"; when none were ticked, the places planned into the days. */
  places: number;
  placesVisited: boolean;
  /** The route, in the order of the days and their stops. */
  path: { lat: number; lng: number }[];
};

/** "סיכום הטיול לשיתוף": the numbers and the route line. The picture itself is drawn on the phone. */
export async function getTripStory(tripId: string): Promise<{ ok: true; story: TripStory } | { ok: false; error: string }> {
  if (!isUuid(tripId)) return { ok: false, error: 'בקשה לא תקינה' };
  const supabase = await createClient();
  const trip = await getTrip(supabase, tripId);
  if (!trip) return { ok: false, error: 'הטיול לא נמצא' };
  if (!(await mayUsePlanTools(supabase, tripId))) return { ok: false, error: 'זה חלק מהמנוי' };
  const [days, places] = await Promise.all([getTripPlan(supabase, tripId), getMapPlaces(supabase, tripId)]);
  const where = new Map(places.map((p) => [p.id, p]));
  const stops = days.flatMap((d) => d.stops);
  const path = stops.map((s) => where.get(s.savedPlaceId)).filter((p): p is NonNullable<typeof p> => !!p).map((p) => ({ lat: p.lat, lng: p.lng }));
  const visited = new Set([...stops.filter((s) => s.done).map((s) => s.savedPlaceId), ...places.filter((p) => p.status === 'visited').map((p) => p.id)]);
  const planned = new Set(stops.map((s) => s.savedPlaceId));
  const names = [...trip.destinations.map((d) => d.name), trip.destination_name];
  return {
    ok: true,
    story: {
      title: trip.title,
      cover: trip.cover_url,
      days: (trip.start_date && trip.end_date ? tripLengthDays(trip.start_date, trip.end_date) : null) ?? days.length,
      countries: Math.max(1, countriesFor(names).length),
      cities: Math.max(1, trip.destinations.length),
      places: visited.size || planned.size,
      placesVisited: visited.size > 0,
      path,
    },
  };
}
