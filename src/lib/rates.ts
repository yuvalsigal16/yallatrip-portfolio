import 'server-only';

/**
 * Today's exchange rates, from a free public source (ExchangeRate-API "open access", no key, updated daily).
 * Cached for a day on our side, so the source is asked at most once a day per base currency.
 * Returns how many units of each currency one unit of `base` buys, or null when the source is down.
 */
export async function getRates(base: string): Promise<{ rates: Record<string, number>; date: string } | null> {
  if (!/^[A-Z]{3}$/.test(base)) return null;
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${base}`, { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const j = (await res.json()) as { result?: string; rates?: Record<string, number>; time_last_update_utc?: string };
    if (j.result !== 'success' || !j.rates) return null;
    return { rates: j.rates, date: j.time_last_update_utc ?? '' };
  } catch {
    return null;
  }
}

/** How much one unit of `code` is worth in `home` (e.g. 1 USD = 3.7 ILS), or null. */
export function unitIn(rates: Record<string, number>, code: string): number | null {
  const r = rates[code];
  return r && r > 0 ? 1 / r : null;
}
