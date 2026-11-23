'use client';

import { useActionState } from 'react';
import { Alert } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { TRANSPORTS, TRAVEL_STYLES, type FormState } from '@/lib/auth/rules';
import { completeOnboarding } from './actions';
import { ChoiceChip as Choice, ChoiceGroup as Question } from '@/components/ChoiceChip';
import { ObservanceQuestions } from '@/components/ObservanceQuestions';

export function OnboardingForm({ next }: { next: string }) {
  const [state, action] = useActionState(completeOnboarding, {} as FormState);
  return (
    <form action={action} className="mt-10 flex flex-col gap-9">
      <input type="hidden" name="next" value={next} />
      {state.error && <Alert>{state.error}</Alert>}


      <Question title="מה הכי חשוב לך בטיול?" help="אפשר לבחור כמה">
        {TRAVEL_STYLES.map((s) => <Choice key={s.key} type="checkbox" name="styles" value={s.key} label={s.label} />)}
      </Question>

      <Question title="איך בדרך כלל זזים ביעד?" help="לחישוב זמני הגעה בין מקומות">
        {TRANSPORTS.map((t) => (
          <Choice key={t.key} type="checkbox" name="transport" value={t.key} label={t.label}
            defaultChecked={t.key === 'walk' || t.key === 'transit'} />
        ))}
      </Question>

      <ObservanceQuestions />

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <SubmitButton name="intent" value="skip" variant="ghost" full={false}>דילוג</SubmitButton>
        <SubmitButton name="intent" value="save" full={false} pendingText="שומרים...">המשך</SubmitButton>
      </div>
    </form>
  );
}
