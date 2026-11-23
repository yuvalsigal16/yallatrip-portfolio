import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { publicEnv } from '@/lib/env';

/**
 * Server-only client with the secret key. It bypasses Row Level Security, so it is used
 * for exactly one job: writing the shared places table after the server has looked the
 * place up at Google. Never import this in anything that reaches the browser.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!key) throw new Error('Missing environment variable SUPABASE_SECRET_KEY (Supabase -> Project Settings -> API keys).');
  return createClient(publicEnv().supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
