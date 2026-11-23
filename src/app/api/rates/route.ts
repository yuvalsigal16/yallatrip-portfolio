import { NextResponse } from 'next/server';
import { handle, requireUser } from '@/lib/api/guard';
import { getRates } from '@/lib/rates';

// GET /api/rates?base=ILS -> { rates: { USD: 0.27, ... }, date }  (one unit of base, in each currency)
// Free daily rates; cached for a day, so this costs nothing per user.
export async function GET(req: Request) {
  return handle(async () => {
    await requireUser();
    const base = new URL(req.url).searchParams.get('base') ?? 'ILS';
    const r = await getRates(base.toUpperCase());
    if (!r) return NextResponse.json({ error: 'שערי המטבע לא זמינים כרגע' }, { status: 503 });
    return NextResponse.json(r, { headers: { 'Cache-Control': 'private, max-age=3600' } });
  });
}
