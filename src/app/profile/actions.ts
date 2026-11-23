'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { DELETE_CONFIRM_WORD, nameError, parseOnboarding, parseYesNo, type FormState } from '@/lib/auth/rules';
import { GENERIC_ERROR } from '@/lib/auth/errors';
import { isOwnAvatarUrl } from '@/lib/avatar';
import { removeTripFiles } from '@/lib/trips/files';

export async function updateDisplayName(_prev: FormState, fd: FormData): Promise<FormState> {
  const raw = fd.get('name');
  const name = typeof raw === 'string' ? raw.trim() : '';
  const err = nameError(name);
  if (err) return { fieldErrors: { name: err }, values: { name } };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login?next=/profile');

  const { error } = await supabase.from('profiles').update({ display_name: name }).eq('id', auth.user.id);
  if (error) return { error: GENERIC_ERROR, values: { name } };
  revalidatePath('/profile');
  return { success: 'השם עודכן', values: { name } };
}

/** Travel style, usual transport, Shabbat and kosher: the answers from sign-up, editable any time. */
export async function updatePreferences(_prev: FormState, fd: FormData): Promise<FormState> {
  const a = parseOnboarding(fd.getAll('styles'), null, fd.getAll('transport'));
  const supabase = await createClient();
  const { error } = await supabase.rpc('complete_onboarding', {
    p_travel_styles: a.travelStyles,
    p_transport: a.transport.length ? a.transport : ['walk'],
    p_keeps_shabbat: parseYesNo(fd.get('shabbat')),
    p_keeps_kosher: parseYesNo(fd.get('kosher')),
  });
  if (error) return { error: GENERIC_ERROR };
  revalidatePath('/profile');
  return { success: 'ההעדפות נשמרו. טיולים חדשים יתחילו מהן.' };
}

/** Sets (or clears, with null) the profile photo. Only a photo in the user's own folder is accepted. */
export async function setAvatar(url: string | null): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: 'צריך להתחבר מחדש' };
  if (url !== null && !isOwnAvatarUrl(url, auth.user.id)) return { ok: false, error: GENERIC_ERROR };
  const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', auth.user.id);
  if (error) return { ok: false, error: GENERIC_ERROR };
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function deleteAccount(_prev: FormState, fd: FormData): Promise<FormState> {
  if (fd.get('confirm') !== DELETE_CONFIRM_WORD) {
    return { fieldErrors: { confirm: `כדי לאשר, כתבו "${DELETE_CONFIRM_WORD}"` } };
  }
  const supabase = await createClient();
  // Remove the profile photos first; the account itself is deleted by the database.
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user) {
    const { data: files } = await supabase.storage.from('avatars').list(auth.user.id, { limit: 100 });
    if (files?.length) await supabase.storage.from('avatars').remove(files.map((f) => `${auth.user!.id}/${f.name}`));
    // and the photos in every trip they own (albums, review photos)
    const { data: trips } = await supabase.from('trips').select('id').eq('owner_id', auth.user.id);
    for (const t of (trips ?? []) as { id: string }[]) await removeTripFiles(supabase, t.id);
  }
  const { error } = await supabase.rpc('delete_my_account', {});
  if (error) {
    console.error('[deleteAccount]', error.message);
    return { error: GENERIC_ERROR };
  }
  await supabase.auth.signOut();
  redirect('/?deleted=1');
}

/** "I'm a travel influencer / blogger": asks the admin for permission to publish paid routes. */
export async function requestInfluencer(_prev: FormState, fd: FormData): Promise<FormState> {
  const raw = fd.get('link');
  const link = typeof raw === 'string' ? raw.trim().slice(0, 300) : '';
  const supabase = await createClient();
  const { error } = await supabase.rpc('request_influencer', { p_link: link || null });
  if (error) return { error: GENERIC_ERROR };
  revalidatePath('/profile');
  revalidatePath('/creator');
  return { success: 'הבקשה נשלחה. אחרי אישור יפתח לך אזור היוצרים.' };
}

/** "דיווח על בעיה או רעיון": a short message to the team, shown on the admin page with the open reports. */
export async function sendFeedback(_prev: FormState, fd: FormData): Promise<FormState> {
  const raw = fd.get('message');
  const message = typeof raw === 'string' ? raw.trim() : '';
  if (message.length < 5 || message.length > 1000) return { fieldErrors: { message: 'כתבו לנו במשפט מה קרה או מה הרעיון (5–1,000 תווים)' }, values: { message } };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login?next=/profile');
  const { error } = await supabase.from('reports').insert({ reporter_id: auth.user.id, target_type: 'feedback', reason: message });
  if (error) return { error: GENERIC_ERROR, values: { message } };
  return { success: 'קיבלנו, תודה! אנחנו קוראים כל הודעה.' };
}
