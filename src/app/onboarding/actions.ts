'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { parseOnboarding, parseYesNo, safeNextPath, type FormState } from '@/lib/auth/rules';
import { GENERIC_ERROR } from '@/lib/auth/errors';

// Saves the answers (or none, when skipping) and marks onboarding done.
export async function completeOnboarding(_prev: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient();
  const skip = fd.get('intent') === 'skip';
  const answers = parseOnboarding(fd.getAll('styles'), null, fd.getAll('transport'));

  const { error } = await supabase.rpc(
    'complete_onboarding',
    skip
      ? {}
      : {
          p_travel_styles: answers.travelStyles,
          p_transport: answers.transport.length ? answers.transport : null,
          p_keeps_shabbat: parseYesNo(fd.get('shabbat')),
          p_keeps_kosher: parseYesNo(fd.get('kosher')),
        },
  );
  if (error) {
    console.error('[onboarding]', error.message);
    return { error: GENERIC_ERROR };
  }
  const next = fd.get('next');
  redirect(safeNextPath(typeof next === 'string' ? next : null));
}
