// Category look & feel for the browser (pins, chips, cards).
// Keys, names and colors match supabase/seed.sql (a test checks they stay in sync).

export type CategoryKey =
  | 'must' | 'attraction' | 'restaurant' | 'cafe' | 'shopping' | 'nightlife'
  | 'hotel' | 'parking' | 'park' | 'beach' | 'culture' | 'photo' | 'nature' | 'airport' | 'transport' | 'supermarket';

export type CategoryMeta = { key: CategoryKey; name: string; color: string; tint: string; icon: string };

// icon = inner SVG markup for a 24×24, stroke-based icon (drawn in white on the pin)
export const CATEGORIES: CategoryMeta[] = [
  { key: 'must', name: 'מקום חובה', color: '#9A6412', tint: '#F6EBD6',
    icon: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>' },
  { key: 'attraction', name: 'אטרקציה', color: '#0E6B6B', tint: '#DDEFEE',
    icon: '<path d="M3 21h18M5 21V10M19 21V10M9.7 21V10M14.3 21V10M2 10l10-6 10 6z"/>' },
  { key: 'restaurant', name: 'מסעדה', color: '#C2481F', tint: '#FBE9E1',
    icon: '<path d="M7 3v18M5 3v5a2 2 0 0 0 4 0V3M17 21V3c-2 0-3.5 2.5-3.5 6s1.5 4 3.5 4"/>' },
  { key: 'cafe', name: 'בית קפה', color: '#7A5230', tint: '#F1E6DC',
    icon: '<path d="M4 9h13v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 10.5h1.5a2 2 0 0 1 0 4H17M8 3v3M12 3v3"/>' },
  { key: 'shopping', name: 'שופינג', color: '#7B4BA6', tint: '#EEE5F6',
    icon: '<path d="M5 8h14l-1 13H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>' },
  { key: 'nightlife', name: 'חיי לילה', color: '#2F3E7A', tint: '#E2E6F3',
    icon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>' },
  { key: 'hotel', name: 'מלון', color: '#17202B', tint: '#E6E8EB',
    icon: '<path d="M3 18V6M3 13h18v5M21 18v-2"/><path d="M3 13v-2.5h7V13M10 10.5h8a3 3 0 0 1 3 3"/>' },
  { key: 'parking', name: 'חניה', color: '#4A5563', tint: '#E9EBEE',
    icon: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M10 17V7h3a3 3 0 0 1 0 6h-3"/>' },
  { key: 'park', name: 'פארק', color: '#3F7F4A', tint: '#E3F0E3',
    icon: '<path d="M12 21v-5"/><path d="M6 16h12L12 3z"/>' },
  { key: 'beach', name: 'חוף', color: '#1D6E99', tint: '#DDECF5',
    icon: '<path d="M2 14c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M2 19c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/><circle cx="17" cy="6" r="2.5"/>' },
  { key: 'culture', name: 'הופעה / תרבות', color: '#A33A6B', tint: '#F6E1EB',
    icon: '<path d="M3 7h18v3.5a2 2 0 0 0 0 3.5V17H3v-3a2 2 0 0 0 0-3.5z"/><path d="M14 7v10"/>' },
  { key: 'photo', name: 'מקום צילום', color: '#5E6B22', tint: '#EDF0DC',
    icon: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7l1.5-3h5L16 7"/><circle cx="12" cy="13.5" r="3.5"/>' },
  { key: 'nature', name: 'טבע', color: '#2E6B3A', tint: '#E0EEDF',
    icon: '<path d="M2 20l7-12 4 6 3-4 6 10z"/><path d="M7.5 10.5l1.5 1.5 1.5-1.5"/>' },
  { key: 'transport', name: 'תחבורה ציבורית', color: '#B45309', tint: '#FBEBD9',
    icon: '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 10h14M8.5 17L7 21M15.5 17l1.5 4"/><circle cx="9" cy="13.5" r="1"/><circle cx="15" cy="13.5" r="1"/>' },
  { key: 'supermarket', name: 'סופר מרקט', color: '#087F5B', tint: '#DCF2EA',
    icon: '<path d="M2.5 3.5h2.5l2.2 11h10.6l2-8H6.2"/><circle cx="9" cy="19" r="1.6"/><circle cx="17" cy="19" r="1.6"/>' },
  { key: 'airport', name: 'נמל תעופה', color: '#3B5B8C', tint: '#E1E8F3',
    icon: '<path d="M10.5 3.5a1.5 1.5 0 0 1 3 0V9l7 4v2l-7-2v4.5l2.5 2V21L12 20l-4 1v-1.5l2.5-2V13l-7 2v-2l7-4z"/>' },
];

export const UNCATEGORIZED: CategoryMeta = {
  key: 'attraction', name: 'בלי קטגוריה', color: '#6B7280', tint: '#EFE9DD',
  icon: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
};

const BY_KEY = new Map(CATEGORIES.map((c) => [c.key, c]));

export function categoryMeta(key: string | null | undefined): CategoryMeta {
  return (key && BY_KEY.get(key as CategoryKey)) || UNCATEGORIZED;
}

export function isCategoryKey(v: unknown): v is CategoryKey {
  return typeof v === 'string' && BY_KEY.has(v as CategoryKey);
}

// Google place types -> our category, most specific first.
const TYPE_TO_CATEGORY: [string[], CategoryKey][] = [
  [['airport', 'international_airport', 'airstrip'], 'airport'],
  [['train_station', 'subway_station', 'light_rail_station', 'bus_station', 'bus_stop', 'transit_station', 'tram_stop'], 'transport'],
  [['lodging', 'hotel', 'hostel', 'motel', 'resort_hotel', 'bed_and_breakfast', 'guest_house'], 'hotel'],
  [['supermarket', 'grocery_store', 'convenience_store', 'food_store', 'asian_grocery_store', 'discount_supermarket', 'hypermarket', 'warehouse_store'], 'supermarket'],
  [['cafe', 'coffee_shop', 'bakery', 'tea_house'], 'cafe'],
  [['bar', 'night_club', 'pub', 'wine_bar', 'cocktail_bar'], 'nightlife'],
  [['parking', 'parking_lot', 'parking_garage'], 'parking'],
  [['beach'], 'beach'],
  [['national_park', 'state_park', 'hiking_area', 'nature_preserve', 'natural_feature', 'wildlife_park', 'wildlife_refuge', 'mountain_peak', 'canyon', 'lake', 'waterfall', 'campground'], 'nature'],
  [['park', 'botanical_garden', 'garden', 'dog_park'], 'park'],
  [['performing_arts_theater', 'concert_hall', 'opera_house', 'movie_theater', 'art_gallery', 'cultural_center', 'philharmonic_hall'], 'culture'],
  [['shopping_mall', 'clothing_store', 'market', 'store', 'department_store', 'book_store', 'shoe_store', 'jewelry_store', 'gift_shop'], 'shopping'],
  [['observation_deck', 'scenic_spot', 'viewpoint'], 'photo'],
  [['restaurant', 'food', 'meal_takeaway', 'pizza_restaurant', 'italian_restaurant', 'fast_food_restaurant', 'ice_cream_shop', 'dessert_shop'], 'restaurant'],
  [['tourist_attraction', 'museum', 'historical_landmark', 'monument', 'church', 'place_of_worship', 'zoo', 'aquarium', 'amusement_park', 'castle', 'historical_place'], 'attraction'],
];

/** A sensible default category for a Google place. The user can always change it. */
export function guessCategory(primaryType: string | null | undefined, types: string[] = []): CategoryKey {
  const all = [primaryType, ...types].filter((t): t is string => typeof t === 'string');
  for (const t of all) {
    for (const [list, key] of TYPE_TO_CATEGORY) if (list.includes(t)) return key;
    if (t.endsWith('_restaurant')) return 'restaurant';
    if (t.endsWith('_store') || t.endsWith('_shop')) return 'shopping';
  }
  return 'attraction';
}

/** The pin's HTML: a colored circle with a white icon (and a number, for day stops later). */
export function pinSvg(meta: CategoryMeta, opts: { size?: number; selected?: boolean; hotel?: boolean; start?: boolean; number?: number } = {}): string {
  const size = opts.size ?? (opts.selected ? 44 : 32);
  const r = size / 2 - 2;
  const shape = opts.hotel || opts.start
    ? `<rect x="2" y="2" width="${size - 4}" height="${size - 4}" rx="${size / 4}" fill="#0C2D4A" stroke="#fff" stroke-width="2.5"/>`
    : `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="${meta.color}" stroke="#fff" stroke-width="2.5"/>`;
  if (opts.number !== undefined && !opts.hotel) {
    const fs = Math.round(size * 0.46);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="display:block;filter:drop-shadow(0 2px 3px rgba(0,0,0,.25))">${shape}<text x="50%" y="50%" dy="0.36em" text-anchor="middle" style="font-family:var(--font-heebo),sans-serif" font-weight="800" font-size="${fs}" fill="#fff">${opts.number}</text></svg>`;
  }
  const icon = opts.hotel ? categoryMeta('hotel').icon : meta.icon;
  const iconSize = size * 0.5;
  const off = (size - iconSize) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="display:block;filter:drop-shadow(0 2px 3px rgba(0,0,0,.25))">${shape}<svg x="${off}" y="${off}" width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${icon}</svg></svg>`;
}
