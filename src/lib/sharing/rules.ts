// Links out to Google Maps for a shared trip (free, no API key: plain URLs).

type Pt = { lat: number; lng: number; google_place_id?: string | null };

/** Opens one place in Google Maps. */
export function googlePlaceUrl(p: Pt & { label?: string }): string {
  const qs = new URLSearchParams({ api: '1', query: p.label ? `${p.label}` : `${p.lat},${p.lng}` });
  if (p.google_place_id) qs.set('query_place_id', p.google_place_id);
  return `https://www.google.com/maps/search/?${qs}`;
}

/** Opens a whole day as directions in Google Maps (up to 9 waypoints, Google's limit for these links). */
export function googleDirectionsUrl(stops: Pt[], mode: 'walk' | 'transit' | 'drive' = 'walk'): string | null {
  if (stops.length < 2) return null;
  const s = stops.slice(0, 11);
  const ll = (p: Pt) => `${p.lat},${p.lng}`;
  const qs = new URLSearchParams({
    api: '1',
    origin: ll(s[0]!),
    destination: ll(s[s.length - 1]!),
    travelmode: mode === 'walk' ? 'walking' : mode === 'transit' ? 'transit' : 'driving',
  });
  if (s.length > 2) qs.set('waypoints', s.slice(1, -1).map(ll).join('|'));
  return `https://www.google.com/maps/dir/?${qs}`;
}

export const VISIBILITY = [
  { key: 'private', label: 'פרטי', help: 'רק את/ה רואה את הטיול' },
  { key: 'link', label: 'עם קישור', help: 'רק מי שקיבל ממך את הקישור יכול לצפות ולהוסיף לטיולים שלו. לא מופיע ברשימות' },
  { key: 'public', label: 'ציבורי', help: 'מופיע לכולם ב"מסלולים", בלי צורך בקישור. כל אחד יכול להוסיף אותו לטיולים שלו ולערוך' },
] as const;
export type Visibility = (typeof VISIBILITY)[number]['key'];

export function isVisibility(v: unknown): v is Visibility {
  return v === 'private' || v === 'link' || v === 'public';
}

export function isShareToken(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
}
