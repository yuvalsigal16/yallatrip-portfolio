'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { TourKind } from './steps';

/** A guide was finished or skipped: don't open it by itself again. */
export async function markTourSeen(kind: TourKind): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('mark_tour', { p_key: kind });
  if (error) console.error('[markTourSeen]', error.message);
}

/** "הדרכה" on My trips: every guide starts again, screen by screen. */
export async function restartTours(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('reset_tours');
  if (error) console.error('[restartTours]', error.message);
  redirect('/trips');
}
