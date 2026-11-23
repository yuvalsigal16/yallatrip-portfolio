import 'server-only';
import { NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { googleErrorMessage } from '@/lib/google/client';

export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

/** Daily per-user limits on calls that cost money at Google. */
export const DAILY_LIMITS = {
  autocomplete: 400,
  details: 300,
  nearby: 200,
  matrix: 100,
  photo: 300,
  route: 200,
  ai: 20,
  /** "✨ מה יש בסביבה" on a place card. */
  around: 10,
} as const;
export type QuotaEndpoint = keyof typeof DAILY_LIMITS;

/** The signed-in user, or a 401. */
export async function requireUser(): Promise<{ supabase: SupabaseClient; user: User }> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new HttpError(401, 'צריך להתחבר כדי להשתמש בזה');
  return { supabase, user: data.user };
}

/** Counts the call against the user's daily quota (in the database), or a 429. */
export async function consumeQuota(supabase: SupabaseClient, endpoint: QuotaEndpoint): Promise<void> {
  const { data, error } = await supabase.rpc('consume_api_quota', {
    p_endpoint: endpoint,
    p_daily_limit: DAILY_LIMITS[endpoint],
  });
  if (error) {
    console.error('[quota]', error.message);
    throw new HttpError(500, 'שגיאה זמנית, נסו שוב');
  }
  if (data !== true) throw new HttpError(429, 'הגעתם למכסה היומית של הפעולה הזו. היא תתאפס מחר.');
}

/**
 * A ceiling for the whole site each month, one per Google price tier, below the tier's free monthly cap
 * (Nearby Search Pro 5,000, Nearby Search Enterprise 1,000, Text Search Enterprise 1,000; Place Details
 * Enterprise 1,000 for a full place card, Pro 5,000 for name and position, Photos 1,000), so these cost nothing.
 * Travellers with a plan (trip pass or yearly) are not held by the place-card ceilings.
 */
export const MONTHLY_LIMITS = {
  nearby_pro: 4500,
  nearby_enterprise: 900,
  text_enterprise: 900,
  details_enterprise: 900,
  details_pro: 4500,
  photos: 900,
} as const;
export type MonthlySku = keyof typeof MONTHLY_LIMITS;

/** Counts `n` searches of this tier against the month, or a 429 once the month is used up. Counted by the server only. */
export async function consumeMonthly(sku: MonthlySku, n = 1, full = 'החיפוש בסביבה יחזור בתחילת החודש'): Promise<void> {
  for (let i = 0; i < n; i++) {
    if (!(await tryMonthly(sku))) throw new HttpError(429, full);
  }
}

/** Counts one call of this tier against the month: false (nothing counted) once the month is used up. */
export async function tryMonthly(sku: MonthlySku): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc('consume_monthly_quota', { p_sku: sku, p_limit: MONTHLY_LIMITS[sku] });
  if (error) {
    console.error('[monthly quota]', error.message);
    throw new HttpError(500, 'שגיאה זמנית, נסו שוב');
  }
  return data === true;
}

/** A traveller with a plan (trip pass or yearly): the place-card ceilings don't apply. */
export async function hasAnyPlan(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.rpc('has_plan', { p_trip: null });
  return !error && data === true;
}

/** Name and position of a place (Place Details Pro): counted against the month unless the traveller has a plan. */
export async function consumePlaceLookup(supabase: SupabaseClient): Promise<void> {
  if (await hasAnyPlan(supabase)) return;
  if (!(await tryMonthly('details_pro'))) throw new HttpError(429, 'הוספת מקומות חדשים תחזור בתחילת החודש');
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, 'בקשה לא תקינה');
  }
}

/** Runs a handler and turns any failure into a clean JSON error. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    const g = googleErrorMessage(e);
    if (g) return NextResponse.json({ error: g.message }, { status: g.status });
    console.error('[api]', e);
    return NextResponse.json({ error: 'שגיאה לא צפויה' }, { status: 500 });
  }
}

export function badRequest(message: string): never {
  throw new HttpError(400, message);
}
