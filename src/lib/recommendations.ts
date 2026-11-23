/** Creators' recommendations on single places ("⭐ מומלץ ע״י …"), free for everyone. */
export const REC_CATEGORIES = [
  { key: 'food', label: 'אוכל', icon: '🍽️' },
  { key: 'sleep', label: 'לינה', icon: '🛏️' },
  { key: 'see', label: 'אטרקציה', icon: '🏛️' },
  { key: 'other', label: 'אחר', icon: '📍' },
] as const;
export type RecCategory = (typeof REC_CATEGORIES)[number]['key'];

export function isRecCategory(v: unknown): v is RecCategory {
  return REC_CATEGORIES.some((c) => c.key === v);
}

export type CreatorRec = {
  id: string;
  googlePlaceId: string;
  name: string;
  lat: number;
  lng: number;
  category: RecCategory;
  body: string;
  /** The creator's public name, and their page (/creators/slug). */
  creator: string;
  slug: string | null;
  distanceMeters?: number;
};
