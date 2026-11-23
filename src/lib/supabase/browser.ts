import { createBrowserClient } from '@supabase/ssr';
import { publicEnv } from '@/lib/env';

/** Supabase client for Client Components. Same RLS rules as the server client. */
export function createClient() {
  const { supabaseUrl, supabaseKey } = publicEnv();
  return createBrowserClient(supabaseUrl, supabaseKey);
}
