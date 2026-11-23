'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { siteUrl } from '@/lib/site';
import { authErrorMessage, GENERIC_ERROR } from '@/lib/auth/errors';
import { destinationAfterSignIn } from '@/lib/auth/session';
import { emailError, parseLogin, parseNewPassword, parseSignup, safeNextPath, type FormState } from '@/lib/auth/rules';

const field = (fd: FormData, name: string) => {
  const v = fd.get(name);
  return typeof v === 'string' ? v : '';
};

// ---------- email + password sign-in ----------
export async function signIn(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = field(fd, 'email');
  const parsed = parseLogin({ email, password: field(fd, 'password') });
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, values: { email } };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.value);
  if (error || !data.user) return { error: authErrorMessage(error), values: { email } };

  redirect(await destinationAfterSignIn(supabase, data.user.id, field(fd, 'next')));
}

// ---------- sign-up ----------
const PHOTO_TYPES: Record<string, string> = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg' };

/**
 * Saves the photo picked on the sign-up form. The account may not be signed in yet
 * (email confirmation), so this uses the server-only client, and only for the id Supabase
 * has just created. A failed photo never blocks the sign-up: it can be added later.
 */
async function saveSignupPhoto(userId: string, value: FormDataEntryValue | null) {
  if (!value || typeof value === 'string') return;
  const ext = PHOTO_TYPES[value.type];
  if (!ext || value.size === 0 || value.size > 1024 * 1024) return;
  try {
    const admin = createAdminClient();
    const path = `${userId}/${Date.now()}.${ext}`;
    const up = await admin.storage.from('avatars').upload(path, value, { contentType: value.type, upsert: false });
    if (up.error) throw up.error;
    const url = admin.storage.from('avatars').getPublicUrl(path).data.publicUrl;
    const { error } = await admin.from('profiles').update({ avatar_url: url }).eq('id', userId);
    if (error) throw error;
  } catch (e) {
    console.warn('[signup photo]', e instanceof Error ? e.message : e);
  }
}

/** Records that the new account accepted the terms of use and privacy policy on the sign-up form. */
async function markTermsAccepted(userId: string) {
  try {
    const { error } = await createAdminClient().from('profiles')
      .update({ terms_accepted_at: new Date().toISOString() }).eq('id', userId).is('terms_accepted_at', null);
    if (error) throw error;
  } catch (e) {
    console.warn('[signup terms]', e instanceof Error ? e.message : e);
  }
}

/** A creator request ticked on the sign-up form: waits for the admin's approval, like the one from the profile. */
async function saveCreatorRequest(userId: string, fd: FormData) {
  if (fd.get('influencer') !== 'on') return;
  const raw = fd.get('influencerLink');
  const link = typeof raw === 'string' ? raw.trim().slice(0, 300) || null : null;
  try {
    const { error } = await createAdminClient().from('profiles')
      .update({ influencer_requested_at: new Date().toISOString(), influencer_link: link })
      .eq('id', userId).eq('role', 'user').is('influencer_requested_at', null);
    if (error) throw error;
  } catch (e) {
    console.warn('[signup creator request]', e instanceof Error ? e.message : e);
  }
}

export async function signUp(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = { name: field(fd, 'name'), email: field(fd, 'email'), influencer: field(fd, 'influencer'), influencerLink: field(fd, 'influencerLink') };
  const parsed = parseSignup({ ...values, password: field(fd, 'password'), confirm: field(fd, 'confirm') });
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors, values };
  if (field(fd, 'terms') !== '1') return { error: 'כדי להירשם, צריך לאשר את תנאי השימוש ומדיניות הפרטיות', values };

  const supabase = await createClient();
  const next = safeNextPath(field(fd, 'next'));
  const { data, error } = await supabase.auth.signUp({
    email: parsed.value.email,
    password: parsed.value.password,
    options: {
      data: { full_name: parsed.value.name },
      emailRedirectTo: `${await siteUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return { error: authErrorMessage(error), values };

  // A new account (not an email that was already registered) -> keep the photo chosen in the form.
  if (data.user && data.user.identities?.length) {
    await markTermsAccepted(data.user.id);
    await saveSignupPhoto(data.user.id, fd.get('avatar'));
    await saveCreatorRequest(data.user.id, fd);
  }

  // Email confirmation off -> signed in already. On -> check your inbox.
  // (For an email that already has an account, Supabase answers the same way on purpose.)
  if (data.session && data.user) redirect(await destinationAfterSignIn(supabase, data.user.id, next));
  return {
    success: `שלחנו מייל אישור אל ${parsed.value.email}. לחצו על הקישור שבו כדי להשלים את ההרשמה.`,
  };
}

// ---------- Google ----------
export async function signInWithGoogle(fd: FormData): Promise<void> {
  const supabase = await createClient();
  const next = safeNextPath(field(fd, 'next'));
  // Accepted the terms on the sign-up page -> recorded when Google sends the person back.
  const terms = field(fd, 'terms') === '1' ? '&terms=1' : '';
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${await siteUrl()}/auth/callback?provider=google${terms}&next=${encodeURIComponent(next)}`,
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error || !data.url) redirect('/login?error=google');
  redirect(data.url);
}

// ---------- forgot password ----------
export async function requestPasswordReset(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = field(fd, 'email').trim().toLowerCase();
  const e = emailError(email);
  if (e) return { fieldErrors: { email: e }, values: { email } };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteUrl()}/auth/callback?next=/reset-password`,
  });
  // Rate limits are worth reporting; anything else gets the same answer,
  // so nobody can use this form to check which emails are registered.
  if (error && (error.status === 429 || error.code?.startsWith('over_'))) {
    return { error: authErrorMessage(error), values: { email } };
  }
  return { success: 'אם יש חשבון עם האימייל הזה, שלחנו אליו קישור לאיפוס סיסמה.' };
}

// ---------- choose a new password (after the reset link) ----------
export async function updatePassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = parseNewPassword({ password: field(fd, 'password'), confirm: field(fd, 'confirm') });
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: 'פג תוקף הקישור. בקשו קישור חדש לאיפוס סיסמה' };

  const { error } = await supabase.auth.updateUser({ password: parsed.value.password });
  if (error) return { error: authErrorMessage(error) };
  redirect('/trips?password=updated');
}

// ---------- sign out ----------
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) console.error('[signOut]', error.message ?? GENERIC_ERROR);
  redirect('/login');
}
