import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionUser, destinationAfterSignIn } from '@/lib/auth/session';
import { safeNextPath } from '@/lib/auth/rules';
import { AcceptTermsForm } from './AcceptTermsForm';

export const metadata: Metadata = { title: 'אישור תנאי השימוש · YallaTrip' };

/**
 * First sign-in of a new account that has not accepted the terms yet
 * (for example "Sign in with Google" from the login page). Nothing else opens until it does.
 */
export default async function AcceptTermsPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const next = safeNextPath(sp.next);
  const { supabase, user } = await getSessionUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('terms_accepted_at').eq('id', user.id).maybeSingle();
  if (!profile || profile.terms_accepted_at) redirect(await destinationAfterSignIn(supabase, user.id, next));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-4xl font-bold">רגע לפני שמתחילים</h1>
        <p className="mt-2 text-ink-2">
          זו הפעם הראשונה שלך ב-YallaTrip. כדי להשלים את ההרשמה, צריך לאשר את תנאי השימוש ומדיניות הפרטיות. זה נעשה פעם אחת בלבד.
        </p>
      </div>
      <AcceptTermsForm next={next} />
    </div>
  );
}
