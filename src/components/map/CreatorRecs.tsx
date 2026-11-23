'use client';

import { useActionState, useEffect, useState } from 'react';
import { recommendationsFor } from '@/app/recommendation-actions';
import { reportContent } from '@/app/market-actions';
import type { FormState } from '@/lib/auth/rules';
import type { CreatorRec } from '@/lib/recommendations';

/** "דיווח" on a creator's recommendation: goes to the reports on the admin page. */
function ReportRec({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(reportContent, {} as FormState);
  if (state.success) return <p className="mt-1 text-xs font-bold text-sea">{state.success}</p>;
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="min-h-10 text-xs font-bold text-ink-2 underline">דיווח</button>;
  return (
    <form action={action} className="mt-2 flex flex-col gap-2">
      <input type="hidden" name="targetType" value="recommendation" />
      <input type="hidden" name="targetId" value={id} />
      <input type="hidden" name="back" value="/trips" />
      <textarea name="reason" rows={2} maxLength={1000} placeholder="מה הבעיה? למשל: המקום סגור" defaultValue={state.values?.reason}
        className="rounded-lg border border-line bg-white px-3 py-2 text-base" />
      {(state.fieldErrors?.reason || state.error) && <p className="text-xs font-bold text-danger">{state.fieldErrors?.reason ?? state.error}</p>}
      <div className="flex gap-2">
        <button className="min-h-10 rounded-full bg-ink px-4 text-sm font-bold text-white">שליחה</button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-10 px-3 text-sm font-bold text-ink-2">ביטול</button>
      </div>
    </form>
  );
}

/** One recommendation: "⭐ מומלץ ע״י [creator]" and what they wrote. */
export function RecNote({ rec }: { rec: CreatorRec }) {
  return (
    <div className="rounded-xl border border-[#F2D58A] bg-[#FFF8E6] p-3" data-tour="p-creator-rec">
      <p className="text-sm font-extrabold text-[#8A5A00]">
        ⭐ מומלץ ע״י {rec.slug ? <a href={`/creators/${rec.slug}`} target="_blank" className="relative text-[#8A5A00] after:absolute after:-inset-y-2.5 after:inset-x-0 after:content-['']">{rec.creator}</a> : rec.creator}
      </p>
      <p className="mt-1 break-words text-[15px]">{rec.body}</p>
      <ReportRec id={rec.id} />
    </div>
  );
}

/** On a place card: every creator recommendation of this place (even a single one). From our own table, no Google call. */
export function CreatorRecs({ googlePlaceId }: { googlePlaceId: string }) {
  const [recs, setRecs] = useState<CreatorRec[]>([]);
  useEffect(() => {
    let cancelled = false;
    setRecs([]);
    recommendationsFor(googlePlaceId).then((r) => !cancelled && setRecs(r)).catch(() => {});
    return () => { cancelled = true; };
  }, [googlePlaceId]);
  if (recs.length === 0) return null;
  return <div className="flex flex-col gap-2">{recs.map((r) => <RecNote key={r.id} rec={r} />)}</div>;
}
