import 'server-only';
import { headers } from 'next/headers';

/**
 * The site's public address, for links in emails and Google sign-in.
 * Set NEXT_PUBLIC_SITE_URL in production; locally it falls back to the request.
 * On a Vercel preview it is the preview's own address, so signing in there comes back to the preview
 * (and not to the real site). Supabase must allow that address in its Redirect URLs.
 */
export async function siteUrl(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv && process.env.VERCEL_ENV !== 'preview') return fromEnv.replace(/\/+$/, '');
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}
