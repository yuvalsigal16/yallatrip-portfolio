'use client';

import { useActionState } from 'react';
import { Alert, Field } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import type { FormState } from '@/lib/auth/rules';
import { signIn } from '../actions';

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(signIn, {} as FormState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      {state.error && <Alert>{state.error}</Alert>}
      <Field label="אימייל" name="email" type="email" autoComplete="email" inputMode="email" dir="ltr"
        required defaultValue={state.values?.email} error={state.fieldErrors?.email} />
      <Field label="סיסמה" name="password" type="password" autoComplete="current-password" dir="ltr"
        required error={state.fieldErrors?.password} />
      <a href="/forgot-password" className="-mt-1 w-fit text-sm font-bold">שכחתי סיסמה</a>
      <SubmitButton pendingText="מתחברים...">התחברות</SubmitButton>
    </form>
  );
}
