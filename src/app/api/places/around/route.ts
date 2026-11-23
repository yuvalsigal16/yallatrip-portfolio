import { NextResponse } from 'next/server';
import { badRequest, consumeMonthly, consumeQuota, handle, readJson, requireUser } from '@/lib/api/guard';
import { parseAround } from '@/lib/validation';
import { aroundPlaces } from '@/lib/google/places';

// POST /api/places/around  { lat, lng, kind }
// "✨ מה יש בסביבה": one kind of place around a place, best-loved first. 10 a day per user, and a monthly
// ceiling for the whole site below Google's free cap.
export async function POST(req: Request) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const parsed = parseAround(await readJson(req));
    if (!parsed.ok) badRequest(parsed.error);
    await consumeQuota(supabase, 'around');
    await consumeMonthly('nearby_pro');
    const places = await aroundPlaces(parsed.value.center, parsed.value.kind);
    return NextResponse.json({ places });
  });
}
