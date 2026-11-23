import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

// Next.js 16 "proxy" (formerly "middleware"): runs before matching requests.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Every page except static files, images, the API, the app's start screen and service worker (API routes check the user themselves).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/|launch$|sw\\.js$|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
