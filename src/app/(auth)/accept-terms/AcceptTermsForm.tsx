'use client';

import { useActionState, useState } from 'react';
import { Alert } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import type { FormState } from '@/lib/auth/rules';
import { TermsCheckbox } from '../TermsCheckbox';
import { acceptTerms, declineTerms } from './actions';

export function AcceptTermsForm({ next }: { next: string }) {
  const [accepted, setAccepted] = useState(false);
  const [state, action] = useActionState(acceptTerms, {} as FormState);
  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        {state.error && <Alert>{state.error}</Alert>}
        <TermsCheckbox checked={accepted} onChange={setAccepted} name="terms" />
        <SubmitButton pendingText="שומרים..." disabled={!accepted}>אישור והמשך</SubmitButton>
      </form>
      <form action={declineTerms}>
        <SubmitButton variant="ghost" pendingText="מבטלים...">לא מאשר/ת, ביטול ההרשמה</SubmitButton>
      </form>
    </div>
  );
}
