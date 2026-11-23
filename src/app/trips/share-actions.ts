'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { GENERIC_ERROR } from '@/lib/auth/errors';
import { isShareToken, isVisibility, type Visibility } from '@/lib/sharing/rules';
import { isUuid } from '@/lib/validation';

export async function setTripVisibility(input: { tripId: string; visibility: Visibility }):
  Promise<{ ok: true; data: { token: string | null } } | { ok: false; error: string }> {
  const { tripId, visibility } = input ?? {};
  if (!isUuid(tripId) || !isVisibility(visibility)) return { ok: false, error: 'בקשה לא תקינה' };
  const supabase = await createClient();
  const { data, error } = await supabase.from('trips').update({ visibility }).eq('id', tripId).select('share_token').maybeSingle();
  if (error || !data) return { ok: false, error: GENERIC_ERROR };
  revalidatePath(`/trips/${tripId}/settings`);
  return { ok: true, data: { token: (data as unknown as { share_token: string | null }).share_token } };
}

/** "Copy to my trips" on a shared page. Visitors are sent to sign in first, then back here. */
export async function cloneSharedTrip(fd: FormData): Promise<void> {
  const token = fd.get('token');
  if (!isShareToken(token)) redirect('/');
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/login?next=${encodeURIComponent(`/s/${token}`)}`);
  const { data, error } = await supabase.rpc('clone_shared_trip', { p_token: token });
  if (error || typeof data !== 'string') redirect(`/s/${token}?error=copy`);
  revalidatePath('/trips');
  redirect(`/trips/${data}?created=1`);
}
