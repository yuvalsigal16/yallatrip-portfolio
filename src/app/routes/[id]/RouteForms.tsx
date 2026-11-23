'use client';

import { useActionState, useState } from 'react';
import { Alert } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import type { FormState } from '@/lib/auth/rules';
import { reportContent, submitReview } from '@/app/market-actions';

export function ReviewForm({ routeId, current }: { routeId: string; current: { rating: number; body: string | null } | null }) {
  const [state, action] = useActionState(submitReview, {} as FormState);
  const [rating, setRating] = useState(current?.rating ?? 0);
  return (
    <form action={action} className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-5">
      <input type="hidden" name="routeId" value={routeId} />
      <input type="hidden" name="rating" value={rating || ''} />
      <p className="font-extrabold">{current ? 'הדירוג שלך' : 'איך היה המסלול?'}</p>
      <div className="flex gap-1" role="radiogroup" aria-label="דירוג">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} כוכבים`} onClick={() => setRating(n)}
            className={`h-11 w-11 rounded-lg text-2xl ${n <= rating ? 'text-[#C98A1B]' : 'text-line'}`}>★</button>
        ))}
      </div>
      {state.fieldErrors?.rating && <p className="text-sm font-semibold text-danger">{state.fieldErrors.rating}</p>}
      <label className="flex flex-col gap-1 text-sm font-bold">כמה מילים (לא חובה)
        <textarea name="body" rows={3} maxLength={2000} defaultValue={state.values?.body ?? current?.body ?? ''}
          className="rounded-xl border border-line px-3 py-2 text-base font-normal" />
      </label>
      {state.error && <Alert>{state.error}</Alert>}
      {state.success && <Alert kind="success">{state.success}</Alert>}
      <div><SubmitButton full={false} pendingText="שומרים...">{current ? 'עדכון הדירוג' : 'שליחת דירוג'}</SubmitButton></div>
    </form>
  );
}

export function ReportForm({ targetType, targetId, back }: { targetType: 'route' | 'review' | 'creator'; targetId: string; back: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(reportContent, {} as FormState);
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="text-sm font-bold text-muted underline">דיווח על בעיה</button>;
  return (
    <form action={action} className="flex flex-col gap-2 rounded-xl bg-sand-2 p-3">
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />
      <input type="hidden" name="back" value={back} />
      {state.success ? <Alert kind="success">{state.success}</Alert> : (
        <>
          <label className="flex flex-col gap-1 text-sm font-bold">מה הבעיה?
            <textarea name="reason" rows={2} maxLength={1000} defaultValue={state.values?.reason} className="rounded-lg border border-line px-3 py-2 font-normal" />
          </label>
          {state.fieldErrors?.reason && <p className="text-sm font-semibold text-danger">{state.fieldErrors.reason}</p>}
          {state.error && <Alert>{state.error}</Alert>}
          <div className="flex gap-2"><SubmitButton full={false} variant="secondary" pendingText="שולחים...">שליחה</SubmitButton>
            <button type="button" onClick={() => setOpen(false)} className="px-3 font-bold">ביטול</button></div>
        </>
      )}
    </form>
  );
}
