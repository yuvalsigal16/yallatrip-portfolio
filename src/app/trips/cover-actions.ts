'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { publicEnv } from '@/lib/env';
import { isUuid } from '@/lib/validation';

type Result = { ok: true } | { ok: false; error: string };

/** Sets (or clears, with null) the trip's own cover photo. Only a photo uploaded into this trip's cover folder is accepted. */
export async function setTripCover(input: { tripId: string; url: string | null }): Promise<Result> {
  const { tripId, url } = input ?? {};
  if (!isUuid(tripId)) return { ok: false, error: 'טיול לא תקין' };
  const prefix = `${publicEnv().supabaseUrl}/storage/v1/object/public/trip-photos/${tripId}/cover/`;
  if (url !== null && (typeof url !== 'string' || !url.startsWith(prefix) || url.length > 500)) return { ok: false, error: 'תמונה לא תקינה' };
  const supabase = await createClient();
  const { data: before } = await supabase.from('trips').select('cover_url').eq('id', tripId).maybeSingle();
  const { data, error } = await supabase.from('trips').update({ cover_url: url }).eq('id', tripId).select('id').maybeSingle();
  if (error || !data) return { ok: false, error: 'רק מי שיצר/ה את הטיול יכול/ה להחליף את התמונה' };
  // The old file is no longer needed.
  const old = (before as { cover_url: string | null } | null)?.cover_url;
  if (old && old !== url && old.startsWith(prefix)) {
    await supabase.storage.from('trip-photos').remove([old.slice(old.indexOf(`${tripId}/cover/`))]);
  }
  revalidatePath('/trips');
  revalidatePath(`/trips/${tripId}`);
  return { ok: true };
}
