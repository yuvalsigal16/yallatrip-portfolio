import 'server-only';
import { serverEnv } from '@/lib/env';

export class GoogleApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly service = 'Google') {
    super(message);
    this.name = 'GoogleApiError';
  }
}

/** Which Google Maps Platform product a URL belongs to, by the name shown in Google Cloud Console. */
export function serviceOf(url: string): string {
  if (url.includes('places.googleapis.com')) return 'Places API (New)';
  if (url.includes('routes.googleapis.com')) return 'Routes API';
  return 'Google Maps Platform';
}

/**
 * A clear Hebrew message for a failed Google call.
 * Setup problems (no key, API not enabled, key not allowed) say what to fix;
 * the details are in docs/google-maps-setup.md and in `npm run check:google`.
 */
export function googleErrorMessage(e: unknown): { status: number; message: string } | null {
  if (e instanceof Error && e.message.startsWith('Missing environment variable GOOGLE_MAPS_SERVER_KEY')) {
    return { status: 503, message: 'החיבור ל-Google Places עוד לא הוגדר: חסר המפתח GOOGLE_MAPS_SERVER_KEY בהגדרות האתר.' };
  }
  if (!(e instanceof GoogleApiError)) return null;
  if (e.status === 401 || e.status === 403) {
    return { status: 503, message: `Google לא אישר את הבקשה ל-${e.service}. צריך להפעיל את ${e.service} ב-Google Cloud ולאשר אותו במפתח השרת.` };
  }
  if (e.status === 400 && e.message.includes('API key')) {
    return { status: 503, message: 'מפתח ה-Google של האתר לא תקין. צריך לבדוק את GOOGLE_MAPS_SERVER_KEY.' };
  }
  if (e.status === 429) return { status: 503, message: 'הגענו למכסת הבקשות של Google להיום. נסו שוב מאוחר יותר.' };
  return { status: 502, message: 'שירות המפות לא זמין כרגע, נסו שוב בעוד רגע' };
}

type GoogleRequest = {
  method?: 'GET' | 'POST';
  body?: unknown;
  fieldMask?: string;
  /** Seconds to cache a GET response on the server. Omit for no caching. */
  revalidate?: number;
};

/** Calls a Google Maps Platform endpoint with the server key. Never runs in the browser. */
export async function googleFetch(url: string, req: GoogleRequest = {}): Promise<unknown> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': serverEnv().googleServerKey,
  };
  if (req.fieldMask) headers['X-Goog-FieldMask'] = req.fieldMask;

  const res = await fetch(url, {
    method: req.method ?? 'GET',
    headers,
    body: req.body === undefined ? undefined : JSON.stringify(req.body),
    signal: AbortSignal.timeout(8000),
    ...(req.revalidate ? { next: { revalidate: req.revalidate } } : { cache: 'no-store' as const }),
  });

  if (!res.ok) {
    // Log Google's message on the server; the browser gets a generic one.
    const detail = await res.text().catch(() => '');
    console.error(`[google] ${res.status} ${url} ${detail.slice(0, 500)}`);
    const keyInvalid = res.status === 400 && /API key not valid|API_KEY_INVALID/.test(detail);
    throw new GoogleApiError(res.status, keyInvalid ? 'Google returned 400: API key not valid' : `Google returned ${res.status}`, serviceOf(url));
  }
  return res.json();
}
