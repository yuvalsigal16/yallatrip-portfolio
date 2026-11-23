import type { CategoryKey } from './categories';

// "Near here" shows a few wide groups instead of many narrow chips; each result then says what it
// actually is ("מסעדה", "בית קפה", "מוזיאון"...) and is saved under the matching category.

export type NearbyGroup = { key: string; label: string; save: CategoryKey; note?: string };

/** key = what the server searches for (see NEARBY_TYPES / NEARBY_TEXT in lib/categories.ts). */
export const NEARBY_GROUPS: NearbyGroup[] = [
  { key: 'food', label: 'אוכל ושתייה', save: 'restaurant' },
  { key: 'todo', label: 'מה לעשות', save: 'attraction' },
  { key: 'fun', label: 'קניות ובילוי', save: 'shopping' },
  { key: 'supermarket', label: 'סופר מרקט', save: 'supermarket' },
  { key: 'hotel', label: 'לינה', save: 'hotel' },
  { key: 'transit', label: 'תחבורה וחניה', save: 'transport' },
  { key: 'chabad', label: 'בית חב״ד', save: 'attraction' },
];

const DETAIL: Record<string, { label: string; save: CategoryKey }> = {
  restaurant: { label: 'מסעדה', save: 'restaurant' },
  cafe: { label: 'בית קפה', save: 'cafe' },
  coffee_shop: { label: 'בית קפה', save: 'cafe' },
  bakery: { label: 'מאפייה', save: 'cafe' },
  tourist_attraction: { label: 'אטרקציה', save: 'attraction' },
  museum: { label: 'מוזיאון', save: 'culture' },
  historical_landmark: { label: 'אתר היסטורי', save: 'attraction' },
  art_gallery: { label: 'גלריה', save: 'culture' },
  performing_arts_theater: { label: 'תיאטרון', save: 'culture' },
  park: { label: 'פארק', save: 'park' },
  national_park: { label: 'שמורת טבע', save: 'nature' },
  hiking_area: { label: 'מסלול הליכה', save: 'nature' },
  beach: { label: 'חוף', save: 'beach' },
  shopping_mall: { label: 'קניון', save: 'shopping' },
  market: { label: 'שוק', save: 'shopping' },
  clothing_store: { label: 'חנות בגדים', save: 'shopping' },
  bar: { label: 'בר', save: 'nightlife' },
  night_club: { label: 'מועדון', save: 'nightlife' },
  lodging: { label: 'מלון', save: 'hotel' },
  hotel: { label: 'מלון', save: 'hotel' },
  train_station: { label: 'תחנת רכבת', save: 'transport' },
  subway_station: { label: 'תחנת מטרו', save: 'transport' },
  light_rail_station: { label: 'רכבת קלה', save: 'transport' },
  bus_station: { label: 'תחנת אוטובוס', save: 'transport' },
  parking: { label: 'חניון', save: 'parking' },
  supermarket: { label: 'סופר מרקט', save: 'supermarket' },
  grocery_store: { label: 'מכולת', save: 'supermarket' },
  convenience_store: { label: 'מכולת', save: 'supermarket' },
  hypermarket: { label: 'היפרמרקט', save: 'supermarket' },
  discount_supermarket: { label: 'סופר מרקט', save: 'supermarket' },
  synagogue: { label: 'בית כנסת', save: 'attraction' },
};

const FOOD = new Set(['restaurant', 'cafe']);

/** What a found place is, in a word, and the category it is saved under. Types Google adds ("italian_restaurant") fall back by their ending. */
export function nearbyDetail(primaryType: string | null, fallback: CategoryKey): { label: string | null; save: CategoryKey; food: boolean } {
  const t = primaryType ?? '';
  const d = DETAIL[t] ?? (t.endsWith('_restaurant') ? DETAIL.restaurant : t.endsWith('_store') || t.endsWith('_shop') ? { label: 'חנות', save: 'shopping' as CategoryKey } : undefined);
  const save = d?.save ?? fallback;
  return { label: d?.label ?? null, save, food: FOOD.has(save) };
}

/** Google has no "kosher" field: the only sign in an ordinary search is the place's own name. */
export const looksKosher = (name: string | null) => !!name && /kosher|glatt|mehadrin|כשר|גלאט|מהדרין|בד[״"']ץ/i.test(name);
