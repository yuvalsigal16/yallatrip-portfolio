import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { distanceMeters } from '@/lib/geo';
import { legsFromJson } from '@/lib/trips/rules';

export type TravelStats = {
  trips: number;
  destinations: string[];
  plannedStops: number;
  next: { id: string; title: string; destination: string; startDate: string; daysAway: number } | null;
  /** One pin per trip: 'been' once the trip is over, 'going' before that (or with no dates). */
  pins: TripPin[];
  /** The passport: one stamp per destination, oldest first. */
  stamps: Stamp[];
  /** Days on the road (trips that already started, up to today). */
  daysTraveled: number;
  /** Flying distance from Israel through every destination and back, for trips with known places. */
  kmTraveled: number;
};

export type Stamp = { tripId: string; name: string; date: string | null; status: 'been' | 'going' };

export type TripPin = {
  id: string; title: string; destination: string; lat: number; lng: number;
  status: 'been' | 'going'; startDate: string | null; endDate: string | null;
};

type TripRow = {
  id: string; title: string; destination_name: string; start_date: string | null; end_date: string | null;
  center_lat: number | null; center_lng: number | null;
  owner_id: string; destinations: unknown; trip_members: { user_id: string; status: string }[] | null;
};

const dayMs = 86_400_000;
const utcDay = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));

type Leg = { name: string; start: string | null; end: string | null; lat?: number; lng?: number };

/** Numbers for the profile page, from the user's own trips only. */
export async function getTravelStats(supabase: SupabaseClient, userId: string, today = new Date()): Promise<TravelStats> {
  const { data } = await supabase
    .from('trips')
    .select('id, title, destination_name, start_date, end_date, center_lat, center_lng, owner_id, destinations, trip_members(user_id, status)')
    .eq('is_snapshot', false);
  // My own trips and the ones shared with me (not other people's public trips).
  const trips = ((data ?? []) as unknown as TripRow[]).filter((t) =>
    t.owner_id === userId || (t.trip_members ?? []).some((m) => m.user_id === userId && m.status === 'accepted'));
  const ids = trips.map((t) => t.id);

  // No Google look-ups here: only places already known on the trips.
  const stops = ids.length
    ? await supabase.from('trip_places').select('id', { count: 'exact', head: true }).in('trip_id', ids)
    : { count: 0 };
  const legsByTrip = new Map<string, Leg[]>(trips.map((t) => [t.id, legsFromJson(t.destinations).map((l) => ({
    name: l.name, start: l.start, end: l.end, ...(typeof l.lat === 'number' && typeof l.lng === 'number' ? { lat: l.lat, lng: l.lng } : {}),
  }))]));

  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const upcoming = trips
    .filter((t) => t.start_date && utcDay(t.start_date) >= todayUtc)
    .sort((a, b) => a.start_date!.localeCompare(b.start_date!))[0];

  const seen = new Map<string, string>();
  for (const t of trips) {
    // A trip across several places (Argentina, then Brazil) counts every one of them.
    const legs = legsFromJson(t.destinations).map((l) => l.name);
    for (const name of legs.length ? legs : [t.destination_name]) {
      const key = (name ?? '').trim().toLowerCase();
      if (key && !seen.has(key)) seen.set(key, name.trim());
    }
  }

  const statusOf = (end: string | null, start: string | null) =>
    (end ?? start) && utcDay((end ?? start)!) < todayUtc ? 'been' as const : 'going' as const;

  // The passport: a stamp for every destination of every trip.
  const stamps: Stamp[] = trips.flatMap((t) => {
    const legs = legsByTrip.get(t.id) ?? [];
    const list = legs.length ? legs : [{ name: t.destination_name, start: t.start_date, end: t.end_date }];
    return list.map((l) => ({ tripId: t.id, name: l.name, date: l.start ?? t.start_date, status: statusOf(l.end ?? t.end_date, l.start ?? t.start_date) }));
  }).sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'));

  // Days already on the road.
  const daysTraveled = trips.reduce((sum, t) => {
    if (!t.start_date || utcDay(t.start_date) > todayUtc) return sum;
    const end = Math.min(utcDay(t.end_date ?? t.start_date), todayUtc);
    return sum + Math.max(0, Math.round((end - utcDay(t.start_date)) / dayMs) + 1);
  }, 0);

  // Flying distance: from Israel, through each destination in order, and home again (straight lines).
  const HOME = { lat: 32.0, lng: 34.87 };
  const kmTraveled = Math.round(trips.reduce((sum, t) => {
    const legs = (legsByTrip.get(t.id) ?? []).filter((l) => l.lat !== undefined && l.lng !== undefined) as { lat: number; lng: number }[];
    const pts = legs.length ? legs : t.center_lat !== null && t.center_lng !== null ? [{ lat: t.center_lat, lng: t.center_lng }] : [];
    if (!pts.length) return sum;
    const path = [HOME, ...pts, HOME];
    return sum + path.slice(1).reduce((s2, p, i) => s2 + distanceMeters(path[i]!, p), 0);
  }, 0) / 1000);

  return {
    stamps,
    daysTraveled,
    kmTraveled,
    trips: trips.length,
    destinations: [...seen.values()],
    plannedStops: stops.count ?? 0,
    next: upcoming
      ? { id: upcoming.id, title: upcoming.title, destination: upcoming.destination_name, startDate: upcoming.start_date!,
          daysAway: Math.round((utcDay(upcoming.start_date!) - todayUtc) / dayMs) }
      : null,
    // One pin per destination: every stop of a multi-destination trip, else the trip's center.
    pins: trips.flatMap((t): TripPin[] => {
      const status = (end: string | null, start: string | null) =>
        (end ?? start) && utcDay((end ?? start)!) < todayUtc ? 'been' as const : 'going' as const;
      const legs = (legsByTrip.get(t.id) ?? []).filter((l) => l.lat !== undefined && l.lng !== undefined);
      if (legs.length) {
        return legs.map((l) => ({
          id: t.id, title: t.title, destination: l.name, lat: l.lat!, lng: l.lng!,
          status: status(l.end ?? t.end_date, l.start ?? t.start_date), startDate: l.start ?? t.start_date, endDate: l.end ?? t.end_date,
        }));
      }
      if (t.center_lat === null || t.center_lng === null) return [];
      return [{
        id: t.id, title: t.title, destination: t.destination_name, lat: t.center_lat, lng: t.center_lng,
        status: status(t.end_date, t.start_date), startDate: t.start_date, endDate: t.end_date,
      }];
    }),
  };
}
