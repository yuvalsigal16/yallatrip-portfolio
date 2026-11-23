import { NextResponse } from 'next/server';
import { badRequest, consumeMonthly, consumeQuota, handle, readJson, requireUser } from '@/lib/api/guard';
import { parseDayRoute } from '@/lib/validation';
import { routeLine } from '@/lib/google/routes';
import { placesAlongRoute } from '@/lib/google/places';
import { decodePolyline } from '@/lib/planning/rules';
import { offRoute } from '@/lib/planning/along';

// POST /api/routes/along  { points: [{lat,lng}...] (the day in order), mode, kind: food|sights|rest }
// -> { places: [{ googlePlaceId, name, rating, ratingCount, openNow, lat, lng, offMeters, detourMin, after }] }
// Restaurants, sights or rest stops on the day's route or a small detour from it, in the order you pass them.
const KINDS = {
  food: { q: 'restaurant', type: 'restaurant' },
  sights: { q: 'tourist attraction', type: 'tourist_attraction' },
  rest: { q: 'cafe rest stop gas station', type: undefined },
  hotels: { q: 'hotel', type: 'lodging' },
  cool: { q: 'scenic viewpoint park landmark', type: undefined },
  market: { q: 'supermarket', type: 'supermarket' },
} as const;
type Kind = keyof typeof KINDS;
// kind "best": the map's automatic layer — only highly rated places of every kind, a few of each.
const BEST: Kind[] = ['food', 'sights', 'hotels', 'cool', 'market'];

export async function POST(req: Request) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const body = await readJson(req);
    const parsed = parseDayRoute(body);
    if (!parsed.ok) badRequest(parsed.error);
    const kind = (body as { kind?: unknown })?.kind;
    if (typeof kind !== 'string' || !(kind in KINDS || kind === 'best')) badRequest('סוג עצירה לא מוכר');
    const { points, mode } = parsed.value;

    await consumeQuota(supabase, 'route');
    const encoded = await routeLine(points, mode);
    if (!encoded) return NextResponse.json({ places: [] });
    const line = decodePolyline(encoded);

    await consumeQuota(supabase, 'nearby');
    const kinds: Kind[] = kind === 'best' ? BEST : [kind as Kind];
    await consumeMonthly('text_enterprise', kinds.length);
    const lists = await Promise.all(kinds.map(async (kk) => {
      const k = KINDS[kk];
      const list = await placesAlongRoute(encoded, k.q, k.type).catch(() => []);
      if (kind !== 'best') return list.map((p) => ({ ...p, kind: kk }));
      // Only the well-loved ones: 4.3★ and up with enough reviews (supermarkets: 4★ is already good), best first, up to 6 per kind.
      const minRating = kk === 'market' ? 4 : 4.3;
      return list
        .filter((p) => (p.rating ?? 0) >= minRating && (p.ratingCount ?? 0) >= 30)
        .sort((a, b) => (b.rating! * Math.log10(b.ratingCount! + 1)) - (a.rating! * Math.log10(a.ratingCount! + 1)))
        .slice(0, 6)
        .map((p) => ({ ...p, kind: kk }));
    }));
    const seen = new Set<string>();
    const found = lists.flat().filter((p) => !seen.has(p.googlePlaceId) && !!seen.add(p.googlePlaceId));

    // How far off the road each place is, and roughly how many minutes the detour adds (there and back).
    const maxOff = mode === 'walk' ? 400 : 2500;
    const perMin = mode === 'walk' ? 75 : 500;
    const places = found
      .map((p) => {
        const off = offRoute(line, points, p.location!);
        return {
          googlePlaceId: p.googlePlaceId, kind: p.kind, name: p.name ?? 'מקום', rating: p.rating, ratingCount: p.ratingCount, openNow: p.openNow,
          lat: p.location!.lat, lng: p.location!.lng,
          offMeters: Math.round(off.meters), detourMin: Math.max(1, Math.round((2 * off.meters) / perMin)),
          progress: off.progress, after: off.after,
        };
      })
      .filter((p) => p.offMeters <= maxOff)
      .sort((a, b) => a.progress - b.progress)
      .slice(0, kind === 'best' ? 24 : 12)
      .map(({ progress: _progress, ...p }) => p);
    return NextResponse.json({ places });
  });
}
