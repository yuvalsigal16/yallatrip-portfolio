import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { FEATURES } from '@/lib/features';

/** The store ("מסלולים") shows in the menus and on My trips only once it has at least this many routes. */
export const ROUTES_MIN = 3;

/** Whether the store has enough routes to show. Asked once per page view. */
export const storeIsOpen = cache(async (): Promise<boolean> => {
  if (!FEATURES.routes) return false;
  const supabase = await createClient();
  const { count, error } = await supabase.from('routes_catalog').select('id', { count: 'exact', head: true });
  if (error) return false;
  return (count ?? 0) >= ROUTES_MIN;
});
