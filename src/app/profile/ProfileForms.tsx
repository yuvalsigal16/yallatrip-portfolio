'use client';

import { useActionState } from 'react';
import { Alert, Field } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { DELETE_CONFIRM_WORD, TRANSPORTS, TRAVEL_STYLES, type FormState } from '@/lib/auth/rules';
import { ChoiceChip as Choice, ChoiceGroup as Question } from '@/components/ChoiceChip';
import { deleteAccount, sendFeedback, updateDisplayName, updatePreferences } from './actions';
import { ObservanceQuestions } from '@/components/ObservanceQuestions';

export function NameForm({ current }: { current: string }) {
  const [state, action] = useActionState(updateDisplayName, {} as FormState);
  return (
    <form action={action} className="flex flex-col gap-3">
      <Field label="שם" name="name" autoComplete="name" defaultValue={state.values?.name ?? current}
        error={state.fieldErrors?.name} />
      {state.success && <Alert kind="success">{state.success}</Alert>}
      {state.error && <Alert>{state.error}</Alert>}
      <div><SubmitButton full={false} pendingText="שומרים...">שמירה</SubmitButton></div>
    </form>
  );
}

export function PreferencesForm({ styles, transport, shabbat, kosher }: {
  styles: string[]; transport: string[]; shabbat: boolean; kosher: boolean;
}) {
  const [state, action] = useActionState(updatePreferences, {} as FormState);
  return (
    <form action={action} className="flex flex-col gap-7">
      <Question title="מה הכי חשוב לך בטיול?" help="קובע מה יופיע ב'✦ מומלץ לך'. אפשר לבחור כמה">
        {TRAVEL_STYLES.map((s) => <Choice key={s.key} type="checkbox" name="styles" value={s.key} label={s.label} defaultChecked={styles.includes(s.key)} />)}
      </Question>
      <Question title="איך בדרך כלל זזים ביעד?" help="רכב או מונית: זמני הדרך יחושבו בנסיעה">
        {TRANSPORTS.map((t) => <Choice key={t.key} type="checkbox" name="transport" value={t.key} label={t.label} defaultChecked={transport.includes(t.key)} />)}
      </Question>
      <ObservanceQuestions shabbat={shabbat} kosher={kosher} />
      {state.success && <Alert kind="success">{state.success}</Alert>}
      {state.error && <Alert>{state.error}</Alert>}
      <div><SubmitButton full={false} pendingText="שומרים...">שמירת ההעדפות</SubmitButton></div>
    </form>
  );
}

export function FeedbackForm() {
  const [state, action] = useActionState(sendFeedback, {} as FormState);
  if (state.success) return <Alert kind="success">{state.success}</Alert>;
  return (
    <form action={action} className="flex flex-col gap-2">
      <label htmlFor="feedback-message" className="text-sm text-ink-2">משהו לא עובד, או יש לך רעיון? ספרו לנו במשפט או שניים.</label>
      <textarea id="feedback-message" name="message" rows={3} maxLength={1000} defaultValue={state.values?.message}
        className="rounded-lg border border-line bg-white px-3 py-2 text-base" />
      {state.fieldErrors?.message && <p className="text-sm font-bold text-danger">{state.fieldErrors.message}</p>}
      {state.error && <Alert>{state.error}</Alert>}
      <div><SubmitButton full={false} variant="secondary" pendingText="שולחים...">שליחה</SubmitButton></div>
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, action] = useActionState(deleteAccount, {} as FormState);
  return (
    <form action={action} className="flex flex-col gap-3">
      {state.error && <Alert>{state.error}</Alert>}
      <Field label={`לאישור, כתבו "${DELETE_CONFIRM_WORD}"`} name="confirm" autoComplete="off"
        error={state.fieldErrors?.confirm} />
      <div><SubmitButton variant="danger" full={false} pendingText="מוחקים...">מחיקת החשבון לצמיתות</SubmitButton></div>
    </form>
  );
}
