import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PlaceStatus } from '@/types/database';

/** A saved place as the map and lists need it. Plain data, safe to hand to the browser. */
export type MapPlace = {
  id: string;
  googlePlaceId: string;
  lat: number;
  lng: number;
  label: string;
  categoryKey: string | null;
  isMust: boolean;
  status: PlaceStatus;
  note: string | null;
};

export async function getMapPlaces(supabase: SupabaseClient, tripId: string): Promise<MapPlace[]> {
  const { data, error } = await supabase
    .from('saved_places_on_map')
    .select('id, google_place_id, lat, lng, label, category_key, is_must, status, personal_note, created_at')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`getMapPlaces: ${error.message}`);
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    googlePlaceId: r.google_place_id as string,
    lat: r.lat as number,
    lng: r.lng as number,
    label: r.label as string,
    categoryKey: (r.category_key as string | null) ?? null,
    isMust: Boolean(r.is_must),
    status: r.status as PlaceStatus,
    note: (r.personal_note as string | null) ?? null,
  }));
}
