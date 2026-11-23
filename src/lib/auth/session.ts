import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { DEFAULT_AFTER_LOGIN, safeNextPath } from '@/lib/auth/rules';

export type ProfileSummary = {
  display_name: string | null; onboarding_completed_at: string | null; terms_accepted_at: string | null; tours_seen: string[] | null; role: 'user' | 'creator' | 'admin'; avatar_url: string | null;
};

/** The current user, or null. Verified with Supabase, not just read from the cookie. Asked once per page view. */
export const getSessionUser = cache(async (): Promise<{ supabase: SupabaseClient; user: User | null }> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user ?? null };
});

/** For the menus: where the user's request to become a content creator stands. */
export const creatorRequest = cache(async (): Promise<'none' | 'pending'> => {
  const { supabase, user } = await getSessionUser();
  if (!user) return 'none';
  const { data } = await supabase.from('profiles').select('influencer_requested_at').eq('id', user.id).maybeSingle();
  return (data as { influencer_requested_at: string | null } | null)?.influencer_requested_at ? 'pending' : 'none';
});

async function loadProfile(supabase: SupabaseClient, userId: string): Promise<ProfileSummary | null> {
  const { data } = await supabase
    .from('profiles')
    .select('display_name, onboarding_completed_at, terms_accepted_at, tours_seen, role, avatar_url')
    .eq('id', userId)
    .maybeSingle();
  return (data as unknown as ProfileSummary | null) ?? null;
}

/** For pages: a signed-in user, or off to /login (and back here afterwards). */
export async function requirePageUser(currentPath: string) {
  const { supabase, user } = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(currentPath)}`);
  return { supabase, user };
}

/** For app pages: signed in AND finished (or skipped) onboarding. */
export async function requireOnboardedUser(currentPath: string) {
  const { supabase, user } = await requirePageUser(currentPath);
  const profile = await loadProfile(supabase, user.id);
  if (profile && !profile.terms_accepted_at) redirect(`/accept-terms?next=${encodeURIComponent(currentPath)}`);
  if (!profile?.onboarding_completed_at) redirect(`/onboarding?next=${encodeURIComponent(currentPath)}`);
  return { supabase, user, profile };
}

/** Where to go right after signing in: onboarding first, then where they were headed. */
export async function destinationAfterSignIn(supabase: SupabaseClient, userId: string, next: unknown) {
  const target = safeNextPath(next, DEFAULT_AFTER_LOGIN);
  const profile = await loadProfile(supabase, userId);
  // First sign-in without having accepted the terms (e.g. "Sign in with Google" on the login page).
  if (profile && !profile.terms_accepted_at) return `/accept-terms?next=${encodeURIComponent(target)}`;
  if (!profile?.onboarding_completed_at) return `/onboarding?next=${encodeURIComponent(target)}`;
  return target;
}
