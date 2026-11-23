// Which Google place types each YallaTrip category searches for in "near you".
// Category keys match public.categories.key in the database.
// Types come from Google's Places API (New) "Table A" list.

export const NEARBY_TYPES = {
  restaurant: ['restaurant'],
  cafe: ['cafe', 'coffee_shop'],
  attraction: ['tourist_attraction', 'museum', 'historical_landmark'],
  shopping: ['shopping_mall', 'clothing_store', 'market'],
  nightlife: ['bar', 'night_club'],
  parking: ['parking'],
  park: ['park'],
  hotel: ['lodging'],
  beach: ['beach'],
  culture: ['performing_arts_theater', 'art_gallery', 'concert_hall'],
  nature: ['national_park', 'state_park', 'hiking_area'],
  airport: ['airport'],
  supermarket: ['supermarket', 'grocery_store', 'convenience_store'],
  // Public transport tabs in "near here" (all saved under the transport category).
  train: ['train_station'],
  bus: ['bus_station', 'bus_stop'],
  metro: ['subway_station', 'light_rail_station'],
  // The wide groups of "near here" (each result then says what it is).
  food: ['restaurant', 'cafe', 'coffee_shop'],
  todo: ['tourist_attraction', 'museum', 'historical_landmark', 'art_gallery', 'performing_arts_theater', 'park', 'national_park', 'hiking_area', 'beach'],
  fun: ['shopping_mall', 'market', 'clothing_store', 'bar', 'night_club'],
  transit: ['train_station', 'subway_station', 'light_rail_station', 'bus_station', 'parking'],
  // Trips with children, rainy days, and "what now?" (ranked by popularity, not distance).
  kids: ['amusement_park', 'amusement_center', 'aquarium', 'zoo', 'bowling_alley'],
  rainy: ['museum', 'art_gallery', 'aquarium', 'shopping_mall', 'movie_theater', 'bowling_alley', 'spa'],
  rainy_kids: ['aquarium', 'amusement_center', 'bowling_alley', 'museum', 'movie_theater', 'shopping_mall'],
  now: ['tourist_attraction', 'museum', 'park', 'cafe', 'restaurant', 'art_gallery', 'shopping_mall'],
  now_kids: ['amusement_park', 'amusement_center', 'aquarium', 'zoo', 'park', 'bowling_alley', 'ice_cream_shop'],
} as const satisfies Record<string, readonly string[]>;

/**
 * Searches Google has no place type for, so they go by words (Text Search) around the point:
 * kosher food and the nearest Chabad house, for the Israeli traveller. `maxMeters` drops results
 * that are really in another city.
 */
export const NEARBY_TEXT = {
  kosher: { query: 'kosher restaurant', radius: 5000, maxMeters: 10000 },
  chabad: { query: 'Chabad', radius: 50000, maxMeters: 60000 },
} as const satisfies Record<string, { query: string; radius: number; maxMeters: number }>;

/** Categories where the best-loved places matter more than the closest ones. */
export const BY_POPULARITY: ReadonlySet<string> = new Set(['kids', 'rainy', 'rainy_kids', 'now', 'now_kids']);

export type NearbyCategory = keyof typeof NEARBY_TYPES | keyof typeof NEARBY_TEXT;

export function isNearbyCategory(v: unknown): v is NearbyCategory {
  return typeof v === 'string' && (Object.hasOwn(NEARBY_TYPES, v) || Object.hasOwn(NEARBY_TEXT, v));
}
