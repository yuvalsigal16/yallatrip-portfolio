import { NextResponse } from 'next/server';
import { badRequest, consumeQuota, handle, hasAnyPlan, HttpError, requireUser, tryMonthly } from '@/lib/api/guard';
import { parseDetails } from '@/lib/validation';
import { placeDetails } from '@/lib/google/places';

// GET /api/places/{googlePlaceId}?level=basic|card&sessionToken=...
// "basic" = what we need to save a place; "card" = everything the place card shows.
// Once the month's full cards are used up (and the traveller has no plan), the card comes back with name and
// address only ("limited"): rating, hours and photo return at the start of the month.
export async function GET(req: Request, { params }: { params: Promise<{ placeId: string }> }) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const { placeId } = await params;
    const url = new URL(req.url);
    const parsed = parseDetails(placeId, url.searchParams.get('level'), url.searchParams.get('sessionToken'));
    if (!parsed.ok) badRequest(parsed.error);
    await consumeQuota(supabase, 'details');
    const unlimited = await hasAnyPlan(supabase);
    let level = parsed.value.level;
    let limited = false;
    if (!unlimited && level === 'card' && !(await tryMonthly('details_enterprise'))) {
      level = 'basic';
      limited = true;
    }
    if (!unlimited && level === 'basic' && !(await tryMonthly('details_pro'))) {
      throw new HttpError(429, 'פרטי המקום יחזרו בתחילת החודש');
    }
    const place = await placeDetails({ ...parsed.value, level });
    if (!place) throw new HttpError(404, 'המקום לא נמצא');
    return NextResponse.json({ place, limited });
  });
}
