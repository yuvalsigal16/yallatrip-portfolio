import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BudgetLevel, TransportMode, TripVisibility } from '@/types/database';
import { isUuid } from '@/lib/validation';
import { legsFromJson, type TripLeg } from '@/lib/trips/rules';

// Reads for the trip screens. Every query runs as the signed-in user,
// so Row Level Security returns only their own trips.

export type TripSummary = {
  id: string;
  title: string;
  destination_name: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  visibility: TripVisibility;
  savedCount: number;
  scheduledCount: number;
  /** Shared with at least one person who accepted the invitation. */
  shared: boolean;
  isOwner: boolean;
  /** The owner's own cover photo, if any. */
  cover_url: string | null;
};

export type TripPerson = { id: string; name: string | null; avatar: string | null; is_owner: boolean; status: 'pending' | 'accepted' };

type CountRel = { count: number }[] | null;
const countOf = (rel: CountRel) => rel?.[0]?.count ?? 0;

/** My own trips and trips shared with me (not other people's public trips). */
export async function getMyTrips(supabase: SupabaseClient, userId: string): Promise<TripSummary[]> {
  const { data, error } = await supabase
    .from('trips')
    .select('id, owner_id, title, destination_name, start_date, end_date, created_at, visibility, cover_url, saved_places!saved_places_trip_id_fkey(count), trip_places(count), trip_members(user_id, status)')
    .eq('is_snapshot', false)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`getMyTrips: ${error.message}`);
  type Member = { user_id: string; status: string };
  const members = (t: Record<string, unknown>) => ((t.trip_members as Member[] | null) ?? []);
  return (data ?? []).filter((t: Record<string, unknown>) =>
    t.owner_id === userId || members(t).some((m) => m.user_id === userId && m.status === 'accepted'),
  ).map((t: Record<string, unknown>) => ({
    id: t.id as string,
    title: t.title as string,
    destination_name: t.destination_name as string,
    start_date: (t.start_date as string | null) ?? null,
    end_date: (t.end_date as string | null) ?? null,
    created_at: t.created_at as string,
    visibility: t.visibility as TripVisibility,
    savedCount: countOf(t.saved_places as CountRel),
    scheduledCount: countOf(t.trip_places as CountRel),
    shared: members(t).some((m) => m.status === 'accepted'),
    isOwner: t.owner_id === userId,
    cover_url: (t.cover_url as string | null) ?? null,
  }));
}

/** Can the signed-in user open this trip for editing (owner, or accepted member)? */
export async function canEditTrip(supabase: SupabaseClient, tripId: string): Promise<boolean> {
  if (!isUuid(tripId)) return false;
  const { data } = await supabase.rpc('can_edit_trip', { p_trip_id: tripId });
  return data === true;
}

/** The trip's people: owner first, then members (accepted or still invited). */
export async function getTripPeople(supabase: SupabaseClient, tripId: string): Promise<TripPerson[]> {
  const { data } = await supabase.rpc('trip_people', { p_trip_id: tripId });
  return (Array.isArray(data) ? data : []) as TripPerson[];
}

export type TripInvite = {
  trip_id: string; title: string; destination: string; start_date: string | null; end_date: string | null;
  from_name: string | null; from_avatar: string | null;
};

export async function getMyInvites(supabase: SupabaseClient): Promise<TripInvite[]> {
  const { data } = await supabase.rpc('my_trip_invites', {});
  return (Array.isArray(data) ? data : []) as TripInvite[];
}

export type TripDayRow = { id: string; day_index: number; date: string | null; title: string | null; stopCount: number };

export type TripDetail = {
  id: string;
  title: string;
  destination_name: string;
  destination_place_id: string | null;
  center_lat: number | null;
  center_lng: number | null;
  start_date: string | null;
  end_date: string | null;
  travelers_count: number;
  transport_modes: TransportMode[];
  travel_styles: string[];
  budget_level: BudgetLevel | null;
  visibility: TripVisibility;
  savedCount: number;
  days: TripDayRow[];
  /** Countries/cities of a multi-destination trip, in order (may be empty). */
  destinations: TripLeg[];
  /** The owner's own cover photo, if any. */
  cover_url: string | null;
};

/** One trip with its days, or null if it does not exist or is not yours. */
export async function getTrip(supabase: SupabaseClient, id: string): Promise<TripDetail | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await supabase
    .from('trips')
    .select(`id, title, destination_name, destination_place_id, center_lat, center_lng, start_date, end_date,
             travelers_count, transport_modes, travel_styles, budget_level, visibility, destinations, cover_url,
             saved_places!saved_places_trip_id_fkey(count), trip_days(id, day_index, date, title, trip_places(count))`)
    .eq('id', id)
    .order('day_index', { referencedTable: 'trip_days', ascending: true })
    .maybeSingle();
  if (error) throw new Error(`getTrip: ${error.message}`);
  if (!data) return null;
  const t = data as unknown as Record<string, unknown>;
  const days = ((t.trip_days as Record<string, unknown>[] | null) ?? []).map((d) => ({
    id: d.id as string,
    day_index: d.day_index as number,
    date: (d.date as string | null) ?? null,
    title: (d.title as string | null) ?? null,
    stopCount: countOf(d.trip_places as CountRel),
  }));
  return {
    id: t.id as string,
    title: t.title as string,
    destination_name: t.destination_name as string,
    destination_place_id: (t.destination_place_id as string | null) ?? null,
    center_lat: (t.center_lat as number | null) ?? null,
    center_lng: (t.center_lng as number | null) ?? null,
    start_date: (t.start_date as string | null) ?? null,
    end_date: (t.end_date as string | null) ?? null,
    travelers_count: t.travelers_count as number,
    transport_modes: (t.transport_modes as TransportMode[]) ?? [],
    travel_styles: (t.travel_styles as string[]) ?? [],
    budget_level: (t.budget_level as BudgetLevel | null) ?? null,
    visibility: t.visibility as TripVisibility,
    savedCount: countOf(t.saved_places as CountRel),
    days: days.sort((a, b) => a.day_index - b.day_index),
    destinations: legsFromJson(t.destinations),
    cover_url: (t.cover_url as string | null) ?? null,
  };
}

export type Preferences = {
  travel_styles: string[]; budget_level: BudgetLevel | null; default_transport: TransportMode[];
  keeps_shabbat?: boolean; keeps_kosher?: boolean;
};

export async function getPreferences(supabase: SupabaseClient, userId: string): Promise<Preferences | null> {
  const { data } = await supabase
    .from('user_preferences')
    .select('travel_styles, budget_level, default_transport, keeps_shabbat, keeps_kosher')
    .eq('user_id', userId)
    .maybeSingle();
  return (data as unknown as Preferences | null) ?? null;
}
