'use client';

import { useActionState } from 'react';
import { Alert } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import type { FormState } from '@/lib/auth/rules';
import { requestInfluencer } from '@/app/profile/actions';

/**
 * Paid routes are for travel influencers and bloggers YallaTrip works with.
 * Shows the request form, or where the request stands.
 */
export function InfluencerRequest({ status }: { status: 'none' | 'pending' | 'approved' }) {
  const [state, action] = useActionState(requestInfluencer, {} as FormState);
  if (status === 'approved') {
    return <p className="text-sm">אושרת כמשפיען/ית. <a href="/creator" className="font-bold">לאזור היוצרים ←</a></p>;
  }
  if (status === 'pending' || state.success) {
    return <p className="rounded-xl bg-sand-2 px-3 py-2 text-sm font-semibold">{state.success ?? 'הבקשה שלך ממתינה לאישור חד-פעמי. אחרי האישור אפשר לפרסם מסלולים בלי לחכות.'}</p>;
  }
  return (
    <form action={action} className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-sm font-bold">קישור לאינסטגרם, טיקטוק, יוטיוב או לבלוג (לא חובה)
        <input name="link" dir="ltr" maxLength={300} placeholder="https://instagram.com/..." className="h-11 rounded-lg border border-line bg-white px-3 text-base font-normal" />
      </label>
      {state.error && <Alert>{state.error}</Alert>}
      <div><SubmitButton full={false} variant="secondary" pendingText="שולחים...">אני משפיען/ית או בלוגר/ית טיולים</SubmitButton></div>
    </form>
  );
}
