'use client';

import { useActionState } from 'react';
import { Alert, Field } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import type { FormState } from '@/lib/auth/rules';
import { requestPasswordReset } from '../actions';

export default function ForgotPasswordPage() {
  const [state, action] = useActionState(requestPasswordReset, {} as FormState);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-4xl font-bold">איפוס סיסמה</h1>
        <p className="mt-2 text-ink-2">נשלח אליך קישור לבחירת סיסמה חדשה.</p>
      </div>
      {state.success ? (
        <Alert kind="success">{state.success}</Alert>
      ) : (
        <form action={action} className="flex flex-col gap-4" noValidate>
          {state.error && <Alert>{state.error}</Alert>}
          <Field label="אימייל" name="email" type="email" autoComplete="email" inputMode="email" dir="ltr" required
            defaultValue={state.values?.email} error={state.fieldErrors?.email} />
          <SubmitButton pendingText="שולחים...">שליחת קישור</SubmitButton>
        </form>
      )}
      <a href="/login" className="text-center font-bold">חזרה להתחברות</a>
    </div>
  );
}
