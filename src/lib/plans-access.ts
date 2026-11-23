import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { FEATURES } from '@/lib/features';

/**
 * The tools that will be part of a paid plan ("⭐ במנוי"): what now, rainy day, I'm here, and the trip story.
 * `active`: the admin's switch "מנויים פעילים" (off until card payments exist). While off, the tools are open to
 * everyone and only carry a small "⭐ במנוי" mark. `has`: this traveller has a plan for this trip (or a yearly one).
 * Before the database has the switch, or when it can't be read, everything stays open.
 */
export type PlanAccess = { active: boolean; has: boolean };

export async function getPlanAccess(supabase: SupabaseClient, tripId: string | null): Promise<PlanAccess> {
  // "תוכניות ומחירים" switched off: everything is free and open.
  if (!FEATURES.plans) return { active: false, has: true };
  const { data: on, error } = await supabase.rpc('subscriptions_active');
  if (error || on !== true) return { active: false, has: true };
  const { data: has } = await supabase.rpc('has_plan', { p_trip: tripId });
  return { active: true, has: has === true };
}

/** For the server routes behind these tools: false only when the switch is on and there is no plan. */
export async function mayUsePlanTools(supabase: SupabaseClient, tripId: string | null = null): Promise<boolean> {
  const a = await getPlanAccess(supabase, tripId);
  return !a.active || a.has;
}
