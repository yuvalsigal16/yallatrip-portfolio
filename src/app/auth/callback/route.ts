import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { destinationAfterSignIn } from '@/lib/auth/session';
import { safeNextPath } from '@/lib/auth/rules';

// GET /auth/callback?code=...&next=...
// Landing point for: Google sign-in, the "confirm your email" link, and the "reset password" link.
// Swaps the one-time code for a session, then sends the user on.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next');
  const fromGoogle = url.searchParams.get('provider') === 'google';
  const fail = NextResponse.redirect(new URL(`/login?error=${fromGoogle ? 'google' : 'callback'}`, url.origin));

  if (!code) return fail;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return fail;

  // Came from the sign-up page, where the terms of use and privacy policy were accepted.
  if (url.searchParams.get('terms') === '1') await supabase.rpc('accept_terms');

  // A password-reset link goes straight to the "choose a new password" page.
  const target =
    safeNextPath(next, '') === '/reset-password'
      ? '/reset-password'
      : await destinationAfterSignIn(supabase, data.user.id, next);

  return NextResponse.redirect(new URL(target, url.origin));
}
