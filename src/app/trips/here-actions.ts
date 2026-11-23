'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/validation';

const okCountry = (c: unknown): c is string => typeof c === 'string' && /^[A-Z]{2}$/.test(c);

/** "להופיע לישראלים אחרים": this traveller will be seen in this country on the trip's dates. */
export async function joinHere(form: FormData): Promise<void> {
  const tripId = form.get('tripId'), country = form.get('country');
  const note = String(form.get('note') ?? '').trim().slice(0, 200) || null;
  if (typeof tripId !== 'string' || !isUuid(tripId) || !okCountry(country)) return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: trip } = await supabase.from('trips').select('start_date, end_date').eq('id', tripId).maybeSingle();
  const t = trip as { start_date: string | null; end_date: string | null } | null;
  if (!t?.start_date || !t.end_date) return;
  const { error } = await supabase.from('israelis_here').upsert(
    { user_id: user.id, trip_id: tripId, country, starts_on: t.start_date, ends_on: t.end_date, note },
    { onConflict: 'user_id,trip_id,country' },
  );
  if (error) console.error('[joinHere]', error.message);
  revalidatePath(`/trips/${tripId}/know`);
}

/** Stop being seen in this country for this trip. */
export async function leaveHere(form: FormData): Promise<void> {
  const tripId = form.get('tripId'), country = form.get('country');
  if (typeof tripId !== 'string' || !isUuid(tripId) || !okCountry(country)) return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from('israelis_here').delete().eq('user_id', user.id).eq('trip_id', tripId).eq('country', country);
  if (error) console.error('[leaveHere]', error.message);
  revalidatePath(`/trips/${tripId}/know`);
}
