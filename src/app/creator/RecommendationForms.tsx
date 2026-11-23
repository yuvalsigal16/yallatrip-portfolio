'use client';

import { useActionState, useState } from 'react';
import { Alert } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { ChoiceChip, ChoiceGroup } from '@/components/ChoiceChip';
import { PlaceSearch } from '@/components/map/PlaceSearch';
import type { FormState } from '@/lib/auth/rules';
import { REC_CATEGORIES, type RecCategory } from '@/lib/recommendations';
import { deleteRecommendation, saveRecommendation } from '@/app/recommendation-actions';

export type MyRec = { id: string; name: string; category: RecCategory; body: string; hidden: boolean };

const noBias = () => null;

function Fields({ category, body, error }: { category?: RecCategory; body?: string; error?: string }) {
  return (
    <>
      <ChoiceGroup title="איזה מקום?">
        {REC_CATEGORIES.map((c) => (
          <ChoiceChip key={c.key} type="radio" name="category" value={c.key} label={`${c.icon} ${c.label}`} defaultChecked={(category ?? 'food') === c.key} />
        ))}
      </ChoiceGroup>
      <label className="flex flex-col gap-1.5 text-sm font-bold">מה כדאי לדעת? משפט או שניים
        <textarea name="body" rows={3} maxLength={500} defaultValue={body} required
          placeholder="למשל: הקרבונרה הכי טובה ברומא. להזמין מקום מראש."
          className="rounded-lg border border-line bg-white px-3 py-2 text-base font-normal" />
      </label>
      {error && <p className="text-sm font-bold text-danger">{error}</p>}
    </>
  );
}

/** "+ המלצה על מקום": find the place with the site's search, choose what it is, and write a sentence or two. */
export function AddRecommendation() {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<{ id: string; token: string; label: string } | null>(null);
  const [state, action] = useActionState(async (p: FormState, fd: FormData) => {
    const r = await saveRecommendation(p, fd);
    if (r.success) { setPlace(null); setOpen(false); }
    return r;
  }, {} as FormState);
  if (!open) {
    return (
      <div className="flex flex-col gap-2">
        {state.success && <Alert kind="success">{state.success}</Alert>}
        <button type="button" onClick={() => setOpen(true)} data-tour="rec-add"
          className="min-h-12 w-fit rounded-full bg-gradient-to-l from-[#1B73C9] to-[#2E9BDB] px-6 font-bold text-white shadow-[0_8px_20px_-8px_rgba(27,115,201,.7)]">
          + המלצה על מקום
        </button>
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-5 rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-bold">איזה מקום?</p>
        {place ? (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-[#EAF4FC] px-4 py-3">
            <span className="min-w-0 truncate font-extrabold">{place.label}</span>
            <button type="button" onClick={() => setPlace(null)} className="min-h-10 shrink-0 px-2 text-sm font-bold text-[#1B73C9]">החלפה</button>
          </div>
        ) : (
          <PlaceSearch placeholder="מסעדה, בית קפה, מלון, אטרקציה…" getBias={noBias}
            onPick={(id, token, label) => setPlace({ id, token, label: label ?? 'המקום שנבחר' })} />
        )}
        {place && <><input type="hidden" name="placeId" value={place.id} /><input type="hidden" name="sessionToken" value={place.token} /></>}
      </div>
      <Fields body={state.values?.body} error={state.fieldErrors?.body} />
      {state.error && <Alert>{state.error}</Alert>}
      <div className="flex flex-wrap gap-2">
        <SubmitButton full={false} pendingText="מפרסמים...">פרסום ההמלצה</SubmitButton>
        <button type="button" onClick={() => { setOpen(false); setPlace(null); }} className="min-h-12 rounded-full px-5 font-bold text-ink-2">ביטול</button>
      </div>
    </form>
  );
}

/** One of my recommendations: edit the text or the kind of place, or delete it. */
export function MyRecommendation({ rec }: { rec: MyRec }) {
  const [state, action] = useActionState(saveRecommendation, {} as FormState);
  const [delState, del] = useActionState(deleteRecommendation, {} as FormState);
  const cat = REC_CATEGORIES.find((c) => c.key === rec.category);
  if (delState.success) return null;
  return (
    <details className="rounded-2xl border border-line bg-white p-4">
      <summary className="flex min-h-10 cursor-pointer flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 font-extrabold">⭐ {rec.name}</span>
        <span className="text-sm text-ink-2">{cat?.icon} {cat?.label}</span>
        {rec.hidden && <span className="rounded-full bg-danger-tint px-2 py-0.5 text-xs font-bold text-[#8E3313]">הוסתרה</span>}
      </summary>
      <form action={action} className="mt-4 flex flex-col gap-4">
        <input type="hidden" name="id" value={rec.id} />
        <Fields category={rec.category} body={state.values?.body ?? rec.body} error={state.fieldErrors?.body} />
        {state.error && <Alert>{state.error}</Alert>}
        {state.success && <Alert kind="success">{state.success}</Alert>}
        <div><SubmitButton full={false} variant="secondary" pendingText="שומרים...">שמירה</SubmitButton></div>
      </form>
      <form action={del} className="mt-2" onSubmit={(e) => { if (!confirm('למחוק את ההמלצה?')) e.preventDefault(); }}>
        <input type="hidden" name="id" value={rec.id} />
        <button className="min-h-10 text-sm font-bold text-[#B42318]">מחיקת ההמלצה</button>
        {delState.error && <Alert>{delState.error}</Alert>}
      </form>
    </details>
  );
}
