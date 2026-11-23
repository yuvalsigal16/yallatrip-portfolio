import { NextResponse } from 'next/server';
import { badRequest, consumeQuota, handle, readJson, requireUser } from '@/lib/api/guard';
import { parseAutocomplete } from '@/lib/validation';
import { autocomplete } from '@/lib/google/places';

// POST /api/places/autocomplete  { input, sessionToken, bias? }
// Search-as-you-type for places and destinations.
export async function POST(req: Request) {
  return handle(async () => {
    const { supabase } = await requireUser();
    const parsed = parseAutocomplete(await readJson(req));
    if (!parsed.ok) badRequest(parsed.error);
    await consumeQuota(supabase, 'autocomplete');
    const suggestions = await autocomplete(parsed.value);
    return NextResponse.json({ suggestions });
  });
}
