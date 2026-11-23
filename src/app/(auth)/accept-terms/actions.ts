'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { destinationAfterSignIn } from '@/lib/auth/session';
import { GENERIC_ERROR } from '@/lib/auth/errors';
import type { FormState } from '@/lib/auth/rules';

/** Accept the terms of use and privacy policy (once), then continue to onboarding or where they were going. */
export async function acceptTerms(_prev: FormState, fd: FormData): Promise<FormState> {
  if (fd.get('terms') !== '1') return { error: 'כדי להמשיך, צריך לסמן את האישור' };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');
  const { error } = await supabase.rpc('accept_terms');
  if (error) {
    console.error('[acceptTerms]', error.message);
    return { error: GENERIC_ERROR };
  }
  const next = fd.get('next');
  redirect(await destinationAfterSignIn(supabase, auth.user.id, typeof next === 'string' ? next : null));
}

/**
 * Not accepting: the account that was just opened is removed, so nobody is registered without accepting.
 * Only for an account that never accepted (every existing account already has).
 */
export async function declineTerms(): Promise<void> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user) {
    const { data: profile } = await supabase.from('profiles').select('terms_accepted_at').eq('id', auth.user.id).maybeSingle();
    if (profile && !profile.terms_accepted_at) {
      const { error } = await supabase.rpc('delete_my_account');
      if (error) console.error('[declineTerms]', error.message);
    }
    await supabase.auth.signOut();
  }
  redirect('/');
}
