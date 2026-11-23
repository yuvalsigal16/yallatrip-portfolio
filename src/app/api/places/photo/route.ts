import { NextResponse } from 'next/server';
import { badRequest, consumeQuota, handle, hasAnyPlan, HttpError, requireUser, tryMonthly } from '@/lib/api/guard';
import { isPhotoName } from '@/lib/validation';
import { photoUrl } from '@/lib/google/places';

// GET /api/places/photo?name=places/.../photos/...&w=800
// Redirects to the image on Google's servers, so the API key never reaches the browser.
export async function GET(req: Request) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const url = new URL(req.url);
    const name = url.searchParams.get('name');
    const w = Number(url.searchParams.get('w') ?? 800);
    if (!isPhotoName(name)) badRequest('תמונה לא תקינה');
    if (!Number.isInteger(w) || w < 100 || w > 1600) badRequest('רוחב לא תקין');
    await consumeQuota(supabase, 'photo');
    // The month's photos used up (and no plan): no picture until the start of the month; the card shows its colour instead.
    if (!(await hasAnyPlan(supabase)) && !(await tryMonthly('photos'))) throw new HttpError(429, 'התמונות יחזרו בתחילת החודש');
    const target = await photoUrl(name, w);
    if (!target) throw new HttpError(404, 'אין תמונה');
    return NextResponse.redirect(target, 302);
  });
}
