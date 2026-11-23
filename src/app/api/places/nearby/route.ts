import { NextResponse } from 'next/server';
import { badRequest, consumeMonthly, consumeQuota, handle, readJson, requireUser } from '@/lib/api/guard';
import { NEARBY_TEXT } from '@/lib/categories';
import { parseNearby } from '@/lib/validation';
import { nearby } from '@/lib/google/places';
import { mayUsePlanTools } from '@/lib/plans-access';

// "What now?" and the rainy day are paid-plan tools: closed only when the admin turns subscriptions on.
const PLAN_KINDS: ReadonlySet<string> = new Set(['now', 'now_kids', 'rainy', 'rainy_kids']);

// POST /api/places/nearby  { lat, lng, category, radius? }
// "Near you": real places of one category around a point, closest first.
export async function POST(req: Request) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const parsed = parseNearby(await readJson(req));
    if (!parsed.ok) badRequest(parsed.error);
    if (PLAN_KINDS.has(parsed.value.category) && !(await mayUsePlanTools(supabase))) {
      return NextResponse.json({ error: 'זה חלק מהמנוי' }, { status: 403 });
    }
    await consumeQuota(supabase, 'nearby');
    // Kosher food and Chabad are searched by words (Text Search); the other kinds by type (Nearby Search).
    await consumeMonthly(Object.hasOwn(NEARBY_TEXT, parsed.value.category) ? 'text_enterprise' : 'nearby_enterprise');
    const places = await nearby(parsed.value);
    return NextResponse.json({ places });
  });
}
