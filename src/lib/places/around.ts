import type { CategoryKey } from '@/lib/places/categories';

/**
 * "✨ מה יש בסביבה" on a place card: four kinds of places around it, each searched once at Google only when
 * chosen. Types come from Google's Places API (New) "Table A". The radius suits the kind: transport is
 * wanted close by, a place to sleep can be further.
 */
export const AROUND_KINDS = {
  eat: {
    label: 'מה אוכלים', save: 'restaurant', radius: 800,
    types: ['restaurant', 'cafe', 'coffee_shop', 'bakery', 'bar'],
  },
  sleep: {
    label: 'איפה ישנים', save: 'hotel', radius: 2000,
    types: ['hotel', 'hostel', 'guest_house', 'bed_and_breakfast', 'private_guest_room', 'resort_hotel'],
  },
  getthere: {
    label: 'איך מגיעים', save: 'transport', radius: 500,
    types: ['bus_station', 'bus_stop', 'subway_station', 'train_station', 'light_rail_station', 'transit_station', 'parking'],
  },
  see: {
    label: 'אטרקציות', save: 'attraction', radius: 1500,
    types: ['tourist_attraction', 'museum', 'historical_landmark', 'art_gallery', 'park'],
  },
} as const satisfies Record<string, { label: string; save: CategoryKey; radius: number; types: readonly string[] }>;

export type AroundKind = keyof typeof AROUND_KINDS;

export function isAroundKind(v: unknown): v is AroundKind {
  return typeof v === 'string' && Object.hasOwn(AROUND_KINDS, v);
}
