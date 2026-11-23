'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { GENERIC_ERROR } from '@/lib/auth/errors';
import { isUuid } from '@/lib/validation';

// Sharing a trip with other YallaTrip users: search by name, invite, accept or decline, remove, leave.
// Every check happens in the database functions (only the owner invites; only the invitee answers).

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };
export type FoundUser = { id: string; display_name: string | null; avatar_url: string | null };

export async function searchUsers(input: { q: string }): Promise<Result<FoundUser[]>> {
  const q = typeof input?.q === 'string' ? input.q.trim().slice(0, 60) : '';
  if (q.length < 2) return { ok: true, data: [] };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('search_users', { p_q: q });
  if (error) return { ok: false, error: GENERIC_ERROR };
  return { ok: true, data: (data ?? []) as FoundUser[] };
}

export async function inviteToTrip(input: { tripId: string; userId: string }): Promise<Result> {
  const { tripId, userId } = input ?? {};
  if (!isUuid(tripId) || !isUuid(userId)) return { ok: false, error: 'בקשה לא תקינה' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('invite_to_trip', { p_trip_id: tripId, p_user: userId });
  if (error) {
    return { ok: false, error: error.code === '42501' ? 'רק מי שיצר/ה את הטיול יכול/ה להזמין'
      : error.code === '22023' ? 'אפשר לשתף טיול עם עד 10 אנשים' : GENERIC_ERROR };
  }
  revalidatePath(`/trips/${tripId}/settings`);
  return { ok: true, data: null };
}

export async function removeFromTrip(input: { tripId: string; userId: string }): Promise<Result> {
  const { tripId, userId } = input ?? {};
  if (!isUuid(tripId) || !isUuid(userId)) return { ok: false, error: 'בקשה לא תקינה' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('remove_trip_member', { p_trip_id: tripId, p_user: userId });
  if (error) return { ok: false, error: GENERIC_ERROR };
  revalidatePath(`/trips/${tripId}/settings`);
  revalidatePath('/trips');
  return { ok: true, data: null };
}

/** Accept or decline an invitation (a form on the trips page). Accepting opens the trip. */
export async function answerInvite(fd: FormData): Promise<void> {
  const tripId = fd.get('tripId');
  const accept = fd.get('answer') === 'accept';
  if (typeof tripId !== 'string' || !isUuid(tripId)) redirect('/trips');
  const supabase = await createClient();
  const { error } = await supabase.rpc('respond_to_trip_invite', { p_trip_id: tripId, p_accept: accept });
  revalidatePath('/trips');
  if (error) redirect('/trips?invite=error');
  redirect(accept ? `/trips/${tripId}?joined=1` : '/trips?invite=declined');
}

/** A member leaves a shared trip (it stays with its owner). */
export async function leaveTrip(fd: FormData): Promise<void> {
  const tripId = fd.get('tripId');
  if (typeof tripId !== 'string' || !isUuid(tripId)) redirect('/trips');
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');
  await supabase.rpc('remove_trip_member', { p_trip_id: tripId, p_user: auth.user.id });
  revalidatePath('/trips');
  redirect('/trips?left=1');
}

/** A link the owner can send (WhatsApp, etc.): whoever opens it while signed in joins the trip. Valid for 14 days; a new link cancels the old one. */
export async function createInviteLink(input: { tripId: string }): Promise<Result<string>> {
  if (!isUuid(input?.tripId)) return { ok: false, error: 'בקשה לא תקינה' };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_trip_invite_link', { p_trip: input.tripId });
  if (error || typeof data !== 'string') {
    return { ok: false, error: error?.code === '42501' ? 'רק מי שיצר/ה את הטיול יכול/ה להזמין' : GENERIC_ERROR };
  }
  return { ok: true, data };
}

/** Form action on the invite page: join the trip the link belongs to, and open it. */
export async function joinByLink(fd: FormData): Promise<void> {
  const token = fd.get('token');
  if (typeof token !== 'string' || !/^[0-9a-f]{36}$/.test(token)) redirect('/trips');
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('join_trip_by_link', { p_token: token });
  if (error || typeof data !== 'string') redirect(`/join/${token}?error=${error?.code === '22023' ? 'full' : 'invalid'}`);
  revalidatePath('/trips');
  redirect(`/trips/${data}?joined=1`);
}
