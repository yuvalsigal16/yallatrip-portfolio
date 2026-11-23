import { NextResponse } from 'next/server';
import { badRequest, consumeQuota, handle, readJson, requireUser } from '@/lib/api/guard';
import { parseMatrix } from '@/lib/validation';
import { routeMatrix } from '@/lib/google/routes';

// POST /api/routes/matrix  { origins: [{lat,lng}], destinations: [{lat,lng}], mode: walk|transit|drive }
// Travel times between stops: the "12 דק׳ הליכה" lines, and later "arrange the day".
export async function POST(req: Request) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const parsed = parseMatrix(await readJson(req));
    if (!parsed.ok) badRequest(parsed.error);
    await consumeQuota(supabase, 'matrix');
    const elements = await routeMatrix(parsed.value);
    return NextResponse.json({ elements });
  });
}
