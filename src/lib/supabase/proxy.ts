import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { publicEnv } from '@/lib/env';
import { DEFAULT_AFTER_LOGIN, isAuthOnlyPage, isProtectedPath } from '@/lib/auth/rules';
import { isOffPath } from '@/lib/features';

/**
 * Runs before every page request:
 * 1. refreshes the Supabase session cookie so users stay signed in;
 * 2. sends visitors away from protected pages, and signed-in users away from /login;
 * 3. sends everyone away from the pages of a feature that is switched off (src/lib/features.ts).
 * Pages still check the user themselves; this is the first gate, not the only one.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { supabaseUrl, supabaseKey } = publicEnv();

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Must be called right after creating the client: it refreshes the session.
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  const path = request.nextUrl.pathname;

  const redirectTo = (target: string) => {
    const url = request.nextUrl.clone();
    const [pathname, query] = target.split('?');
    url.pathname = pathname ?? '/';
    url.search = query ? `?${query}` : '';
    const res = NextResponse.redirect(url);
    // keep any refreshed session cookies on the redirect
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  if (isOffPath(path)) return redirectTo('/trips');
  if (!user && isProtectedPath(path)) {
    return redirectTo(`/login?next=${encodeURIComponent(path + request.nextUrl.search)}`);
  }
  if (user && isAuthOnlyPage(path)) {
    return redirectTo(DEFAULT_AFTER_LOGIN);
  }
  return response;
}
