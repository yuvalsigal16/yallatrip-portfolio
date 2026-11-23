import { NextResponse } from 'next/server';
import { badRequest, consumeQuota, handle, readJson, requireUser } from '@/lib/api/guard';
import { parseDayRoute } from '@/lib/validation';
import { dayRoute } from '@/lib/google/routes';

// POST /api/routes/day  { points: [{lat,lng}...] in visiting order, mode: walk|transit|drive }
// -> { legs: [{durationSec, distanceMeters}], polyline }  (legs[i] = stop i -> stop i+1)
export async function POST(req: Request) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const parsed = parseDayRoute(await readJson(req));
    if (!parsed.ok) badRequest(parsed.error);
    await consumeQuota(supabase, 'route');
    return NextResponse.json(await dayRoute(parsed.value));
  });
}
