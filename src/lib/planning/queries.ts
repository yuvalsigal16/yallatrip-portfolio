import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { FEATURES } from '@/lib/features';

export type Stop = {
  id: string;
  savedPlaceId: string;
  position: number;
  plannedTime: string | null; // HH:MM
  /** Ticked "I was here" on this line of the day (a place can appear in a day more than once). */
  done?: boolean;
  /** Places the traveller is still choosing between for this slot ("this or that"); picked on the day itself. */
  alts?: { id: string; savedPlaceId: string }[];
  durationMin: number | null;
  note: string | null;
  /** How the traveller goes on to the next stop, when they chose (walk or drive). */
  transportToNext?: 'walk' | 'drive' | 'transit' | null;
};

export type PlanDay = {
  id: string;
  dayIndex: number;
  date: string | null;
  title: string | null;
  startTime: string | null; // HH:MM
  /** The saved place the day starts from (hotel, airport...), if chosen. */
  startPlaceId: string | null;
  /** The traveller's own note for the day. */
  notes?: string | null;
  /** How the traveller goes from the starting point to the first stop, when they chose. */
  startTransport?: 'walk' | 'drive' | 'transit' | null;
  stops: Stop[];
};

const hhmm = (t: unknown) => (typeof t === 'string' ? t.slice(0, 5) : null);

/** Every day of the trip with its stops in order. */
export async function getTripPlan(supabase: SupabaseClient, tripId: string): Promise<PlanDay[]> {
  const { data, error } = await supabase
    .from('trip_days')
    .select('id, day_index, date, title, start_time, notes, start_saved_place_id, start_transport, trip_places(id, saved_place_id, position, planned_time, duration_min, note, transport_to_next, done_at, trip_place_alts(id, saved_place_id, created_at))')
    .eq('trip_id', tripId)
    .order('day_index', { ascending: true });
  if (error) throw new Error(`getTripPlan: ${error.message}`);
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((d) => ({
    id: d.id as string,
    dayIndex: d.day_index as number,
    date: (d.date as string | null) ?? null,
    title: (d.title as string | null) ?? null,
    startTime: hhmm(d.start_time),
    startPlaceId: (d.start_saved_place_id as string | null) ?? null,
    notes: (d.notes as string | null) ?? null,
    startTransport: d.start_transport === 'walk' ? 'walk' as const : d.start_transport === 'transit' ? 'transit' as const : d.start_transport === 'car' || d.start_transport === 'taxi' ? 'drive' as const : null,
    stops: ((d.trip_places as Record<string, unknown>[] | null) ?? [])
      .map((s) => ({
        id: s.id as string,
        savedPlaceId: s.saved_place_id as string,
        position: s.position as number,
        plannedTime: hhmm(s.planned_time),
        done: s.done_at != null,
        // "מתלבטים בין שניים" switched off: saved alternatives stay in the database, unseen.
        alts: (FEATURES.alternatives ? (s.trip_place_alts as Record<string, unknown>[] | null) ?? [] : [])
          .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
          .map((a) => ({ id: a.id as string, savedPlaceId: a.saved_place_id as string })),
        durationMin: (s.duration_min as number | null) ?? null,
        note: (s.note as string | null) ?? null,
        transportToNext: s.transport_to_next === 'walk' ? 'walk' as const : s.transport_to_next === 'transit' ? 'transit' as const : s.transport_to_next === 'car' || s.transport_to_next === 'taxi' ? 'drive' as const : null,
      }))
      .sort((a, b) => a.position - b.position),
  }));
}
