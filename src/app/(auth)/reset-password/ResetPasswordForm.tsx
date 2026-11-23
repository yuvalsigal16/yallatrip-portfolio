'use client';

import { useActionState } from 'react';
import { Alert, Field } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { PASSWORD_MIN, type FormState } from '@/lib/auth/rules';
import { updatePassword } from '../actions';

export function ResetPasswordForm() {
  const [state, action] = useActionState(updatePassword, {} as FormState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.error && <Alert>{state.error}</Alert>}
      <Field label="סיסמה חדשה" name="password" type="password" autoComplete="new-password" dir="ltr" required
        hint={`לפחות ${PASSWORD_MIN} תווים, עם אותיות וספרות`} error={state.fieldErrors?.password} />
      <Field label="אימות סיסמה" name="confirm" type="password" autoComplete="new-password" dir="ltr" required
        error={state.fieldErrors?.confirm} />
      <SubmitButton pendingText="שומרים...">שמירת הסיסמה</SubmitButton>
    </form>
  );
}
