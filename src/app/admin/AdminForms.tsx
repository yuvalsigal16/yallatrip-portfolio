'use client';

import { useActionState } from 'react';
import { Alert } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import type { FormState } from '@/lib/auth/rules';
import type { PriceTiers } from '@/lib/market/rules';
import { adminSetRecommendationHidden } from '@/app/recommendation-actions';
import { adminSetSubscriptions, adminDecideInfluencer, adminRecordPayout, adminResolveReport, adminSetCommission, adminSetRole, adminSetRouteStatus } from '@/app/admin-actions';

const Msg = ({ s }: { s: FormState }) => (
  <>{s.error && <Alert>{s.error}</Alert>}{s.success && <Alert kind="success">{s.success}</Alert>}</>
);

export function RouteReviewForm({ routeId }: { routeId: string }) {
  const [state, action] = useActionState(adminSetRouteStatus, {} as FormState);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="routeId" value={routeId} />
      <label className="flex flex-col gap-1 text-sm font-bold">הערה ליוצר/ת (חובה בדחייה)
        <input name="note" maxLength={500} className="h-10 rounded-lg border border-line px-3 font-normal" />
      </label>
      {state.fieldErrors?.note && <p className="text-sm font-semibold text-danger">{state.fieldErrors.note}</p>}
      <Msg s={state} />
      <div className="flex gap-2">
        <SubmitButton full={false} name="status" value="published" pendingText="...">אישור ופרסום</SubmitButton>
        <SubmitButton full={false} variant="danger" name="status" value="rejected" pendingText="...">דחייה</SubmitButton>
      </div>
    </form>
  );
}

export function UnpublishForm({ routeId }: { routeId: string }) {
  const [state, action] = useActionState(adminSetRouteStatus, {} as FormState);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="routeId" value={routeId} />
      <input type="hidden" name="status" value="unpublished" />
      <input name="note" placeholder="סיבה" maxLength={500} className="h-9 rounded-lg border border-line px-2 text-sm" />
      <SubmitButton full={false} variant="danger" pendingText="...">הורדה מהחנות</SubmitButton>
      <Msg s={state} />
    </form>
  );
}

export function RoleForm({ userId, role }: { userId: string; role: string }) {
  const [state, action] = useActionState(adminSetRole, {} as FormState);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <select name="role" defaultValue={role} aria-label="הרשאה" className="h-9 rounded-lg border border-line bg-white px-2 text-sm">
        <option value="user">משתמש/ת</option><option value="creator">יוצר/ת</option><option value="admin">מנהל/ת</option>
      </select>
      <SubmitButton full={false} variant="secondary" pendingText="...">עדכון</SubmitButton>
      {(state.error || state.success) && <span className="text-xs font-bold">{state.error ?? state.success}</span>}
    </form>
  );
}

export function CommissionForm({ tiers }: { tiers: PriceTiers }) {
  const [state, action] = useActionState(adminSetCommission, {} as FormState);
  const fe = state.fieldErrors ?? {};
  const pct = (r: number) => Math.round(r * 1000) / 10;
  const input = 'h-10 w-24 rounded-lg border border-line px-2 font-normal';
  const row = (label: string, name: string, def: number, unit: string, step = 1) => (
    <label className="flex flex-wrap items-center gap-2 text-sm font-bold">{label}
      <input name={name} type="number" min={0} step={step} defaultValue={def} className={input} />{unit}
      {fe[name] && <span className="w-full font-semibold text-danger">{fe[name]}</span>}
    </label>
  );
  return (
    <form action={action} className="flex flex-col gap-3">
      {row('מסלול קצר = עד', 'shortDays', tiers.shortMaxDays, 'ימים')}
      <fieldset className="flex flex-col gap-2 rounded-xl border border-line p-3">
        <legend className="px-1 text-sm font-extrabold">מסלול קצר / סוף שבוע</legend>
        {row('מחיר מקסימלי', 'shortMax', tiers.shortMax / 100, '₪')}
        {row('עמלת YallaTrip', 'shortRate', pct(tiers.shortRate), '%', 0.5)}
      </fieldset>
      <fieldset className="flex flex-col gap-2 rounded-xl border border-line p-3">
        <legend className="px-1 text-sm font-extrabold">מסלול ארוך / טיול מורכב</legend>
        {row('מחיר מקסימלי', 'longMax', tiers.longMax / 100, '₪')}
        {row('עמלת YallaTrip', 'longRate', pct(tiers.longRate), '%', 0.5)}
      </fieldset>
      <Msg s={state} />
      <div><SubmitButton full={false} variant="secondary" pendingText="...">שמירה</SubmitButton></div>
    </form>
  );
}

export function PayoutForm({ creatorId, due }: { creatorId: string; due: string }) {
  const [state, action] = useActionState(adminRecordPayout, {} as FormState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="creatorId" value={creatorId} />
      <input name="amount" defaultValue={due} inputMode="decimal" aria-label="סכום ב-₪" className="h-9 w-24 rounded-lg border border-line px-2" />
      <input name="reference" placeholder="אסמכתה" maxLength={200} className="h-9 w-40 rounded-lg border border-line px-2" />
      <SubmitButton full={false} variant="secondary" pendingText="...">רישום תשלום</SubmitButton>
      {(state.error || state.success || state.fieldErrors?.amount) && <span className="text-xs font-bold">{state.error ?? state.success ?? state.fieldErrors?.amount}</span>}
    </form>
  );
}

export function ReportResolveForm({ reportId, reviewId }: { reportId: string; reviewId?: string }) {
  const [state, action] = useActionState(adminResolveReport, {} as FormState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="reportId" value={reportId} />
      {reviewId && <label className="flex items-center gap-1 text-sm font-bold"><input type="checkbox" name="hideReview" value={reviewId} /> להסתיר את הביקורת</label>}
      <SubmitButton full={false} variant="secondary" name="status" value="resolved" pendingText="...">טופל</SubmitButton>
      <SubmitButton full={false} variant="ghost" name="status" value="dismissed" pendingText="...">לא רלוונטי</SubmitButton>
      {(state.error || state.success) && <span className="text-xs font-bold">{state.error ?? state.success}</span>}
    </form>
  );
}

export function InfluencerDecisionForm({ userId }: { userId: string }) {
  const [state, action] = useActionState(adminDecideInfluencer, {} as FormState);
  if (state.success) return <span className="text-sm font-bold text-sea">{state.success}</span>;
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <SubmitButton full={false} name="decision" value="approve" pendingText="...">אישור</SubmitButton>
      <SubmitButton full={false} variant="secondary" name="decision" value="decline" pendingText="...">דחייה</SubmitButton>
      {state.error && <span className="text-xs font-bold text-danger">{state.error}</span>}
    </form>
  );
}

/** The one switch for the paid plan's tools. Turning it on asks first: it closes the tools for everyone without a plan. */
export function SubscriptionsSwitch({ on }: { on: boolean }) {
  const [state, action] = useActionState(adminSetSubscriptions, {} as FormState);
  return (
    <form action={action} className="flex flex-col gap-2"
      onSubmit={(e) => { if (!on && !confirm('להדליק את המנויים? הכלים במנוי ייסגרו לכל מי שאין לו/ה מנוי.')) e.preventDefault(); }}>
      <input type="hidden" name="on" value={on ? 'false' : 'true'} />
      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded-full px-3 py-1 text-sm font-extrabold ${on ? 'bg-sea-tint text-sea' : 'bg-sand-2 text-ink-2'}`}>{on ? 'דולק' : 'כבוי'}</span>
        <SubmitButton full={false} variant="secondary" pendingText="...">{on ? 'לכבות' : 'להדליק'}</SubmitButton>
      </div>
      <Msg s={state} />
    </form>
  );
}

/** Hide a creator's recommendation from everyone, or show it again. */
export function RecHideForm({ id, hidden }: { id: string; hidden: boolean }) {
  const [state, action] = useActionState(adminSetRecommendationHidden, {} as FormState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="hidden" value={hidden ? 'false' : 'true'} />
      <SubmitButton full={false} variant={hidden ? 'secondary' : 'danger'} pendingText="...">{hidden ? 'להציג שוב' : 'להסתיר'}</SubmitButton>
      {(state.error || state.success) && <span className="text-xs font-bold">{state.error ?? state.success}</span>}
    </form>
  );
}
