'use client';

import { useActionState } from 'react';
import { Alert, Field } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { DestinationsList } from '@/components/trips/DestinationsList';
import { destinationRows, mergeEcho, StyleSection, WhoAndHowSection, type TripDefaults } from '@/components/trips/TripFormSections';
import type { FormState } from '@/lib/auth/rules';
import { deleteTrip, duplicateTrip, updateTrip } from '../../actions';
import { leaveTrip } from '../../members-actions';

const card = 'flex flex-col gap-6 rounded-2xl border border-line bg-white p-4 sm:p-6';

export function TripSettingsForm({ tripId, defaults }: { tripId: string; defaults: TripDefaults }) {
  const [state, action] = useActionState(updateTrip, {} as FormState);
  const d = mergeEcho(defaults, state.values);
  const e = state.fieldErrors ?? {};

  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <input type="hidden" name="tripId" value={tripId} />
      {state.error && <Alert>{state.error}</Alert>}

      <section className={card}>
        <h2 className="text-lg font-extrabold">פרטים</h2>
        <Field label="שם הטיול" name="title" defaultValue={d.title} maxLength={120} error={e.title}
          hint="למשל: רומא עם אמא" />
        <DestinationsList defaultItems={destinationRows(d)} defaultNoDates={d.noDates} errors={e} />
      </section>

      <section className={card}><WhoAndHowSection d={d} errors={e} /></section>
      <section className={card}><StyleSection d={d} errors={e} /></section>

      {/* Shortening the trip: explain what happens and ask again */}
      {state.warning && (
        <div className="flex flex-col gap-3">
          <Alert kind="info">{state.warning}</Alert>
          <input type="hidden" name="confirmShrink" value="1" />
        </div>
      )}
      <div>
        <SubmitButton full={false} pendingText="שומרים...">{state.warning ? 'כן, לשמור' : 'שמירת השינויים'}</SubmitButton>
      </div>
    </form>
  );
}

export function DeleteTripForm({ tripId }: { tripId: string }) {
  const [state, action] = useActionState(deleteTrip, {} as FormState);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="tripId" value={tripId} />
      {state.error && <Alert>{state.error}</Alert>}
      <label className="flex min-h-11 cursor-pointer items-center gap-2.5 font-semibold">
        <input type="checkbox" name="confirm" className="h-5 w-5 accent-[#B42318]" />
        כן, למחוק את הטיול לצמיתות
      </label>
      {state.fieldErrors?.confirm && <p className="text-sm font-semibold text-danger">{state.fieldErrors.confirm}</p>}
      <div><SubmitButton variant="danger" full={false} pendingText="מוחקים...">מחיקת הטיול</SubmitButton></div>
    </form>
  );
}

/** A copy of the trip for me: same places, days and stops; new name, and new dates if I want. */
export function DuplicateTripForm({ tripId, title, hasDates }: { tripId: string; title: string; hasDates: boolean }) {
  const [state, action] = useActionState(duplicateTrip, {} as FormState);
  const v = state.values ?? {};
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="tripId" value={tripId} />
      {state.error && <Alert>{state.error}</Alert>}
      <Field label="שם הטיול החדש" name="title" maxLength={120} defaultValue={v.title ?? `${title} – עותק`} />
      <Field label={hasDates ? 'תאריך יציאה חדש (לא חובה)' : 'תאריך יציאה (לא חובה)'} name="startDate" type="date"
        defaultValue={v.startDate ?? ''} error={state.fieldErrors?.startDate}
        hint={hasDates ? 'כל הימים יזוזו יחד. בלי תאריך, העותק יקבל את אותם תאריכים.' : 'בלי תאריך, העותק יישאר בלי תאריכים.'} />
      <div><SubmitButton full={false} variant="secondary" pendingText="משכפלים...">יצירת עותק</SubmitButton></div>
    </form>
  );
}

/** Leaving a shared trip asks first: coming back needs a new invitation. */
export function LeaveTripForm({ tripId }: { tripId: string }) {
  return (
    <form action={leaveTrip} onSubmit={(e) => { if (!window.confirm('לצאת מהטיול המשותף? כדי לחזור אליו צריך הזמנה חדשה.')) e.preventDefault(); }}>
      <input type="hidden" name="tripId" value={tripId} />
      <button type="submit" className="min-h-11 rounded-full border border-[#F4C7C3] bg-white px-5 font-bold text-danger hover:bg-[#FEF3F2]">יציאה מהטיול</button>
    </form>
  );
}
