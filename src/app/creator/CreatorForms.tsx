'use client';

import { useActionState, useEffect, useState } from 'react';
import { Alert, Field } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import type { FormState } from '@/lib/auth/rules';
import { CREATOR_LINKS, creatorShare, formatPrice, parsePrice, tierFor, type PriceTiers } from '@/lib/market/rules';
import { PAID_ROUTES } from '@/lib/features';
import { becomeCreator, publishRoute, updateCreatorProfile, updateRoute } from '@/app/market-actions';

/** Links that show you're a real creator / blogger: Instagram, Facebook, TikTok, YouTube, a website. */
function CreatorLinksFields({ values, saved, errors }: { values?: Record<string, string>; saved?: Record<string, string> | null; errors?: Partial<Record<string, string>> }) {
  return (
      <div className="grid gap-3 sm:grid-cols-2">
        {CREATOR_LINKS.map((l) => (
          <Field key={l.key} label={l.label} name={l.key} dir="ltr" inputMode="url" placeholder={l.placeholder}
            defaultValue={values?.[l.key] ?? saved?.[l.key] ?? ''} error={errors?.[l.key]} />
        ))}
      </div>
  );
}

export function BecomeCreatorForm({ suggestedName }: { suggestedName: string }) {
  const [state, action] = useActionState(becomeCreator, {} as FormState);
  return (
    <form action={action} className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-6" noValidate>
      {state.error && <Alert>{state.error}</Alert>}
      <Field label="שם תצוגה" name="displayName" defaultValue={state.values?.displayName ?? suggestedName} error={state.fieldErrors?.displayName} />
      <fieldset className="flex flex-col gap-3 rounded-2xl border border-line p-4">
        <legend className="px-1 text-sm font-bold">הדף שלך</legend>
        <p className="-mt-1 text-sm text-ink-2">
          כתובת דף ב-YallaTrip, או קישור לאינסטגרם, פייסבוק, טיקטוק, יוטיוב או לאתר שלך. מספיק אחד. הקישורים מראים שאת/ה יוצר/ת או בלוגר/ית, ומופיעים בדף שלך.
        </p>
        <Field label="כתובת דף ב-YallaTrip (לא חובה אם יש קישור)" name="slug" dir="ltr" defaultValue={state.values?.slug} error={state.fieldErrors?.slug}
          hint="באנגלית, למשל noa-travels. בלי כתובת, ניצור אחת לבד מהקישור שלך." />
        <CreatorLinksFields values={state.values} errors={state.fieldErrors} />
      </fieldset>
      <label className="flex flex-col gap-1.5 text-sm font-bold">קצת עליך (לא חובה)
        <textarea name="bio" rows={3} maxLength={1000} defaultValue={state.values?.bio} className="rounded-xl border border-line px-3 py-2 text-base font-normal" />
      </label>
      <p className="text-sm text-ink-2">בהצטרפות את/ה מאשר/ת את תנאי היוצרים: המסלולים שלך מקוריים, ואת/ה אחראי/ת לתוכן שלהם.</p>
      <div><SubmitButton full={false} pendingText="יוצרים...">הצטרפות כיוצר/ת</SubmitButton></div>
    </form>
  );
}

export function CreatorProfileForm({ displayName, bio, links }: { displayName: string; bio: string | null; links?: Record<string, string> | null }) {
  const [state, action] = useActionState(updateCreatorProfile, {} as FormState);
  return (
    <form action={action} className="flex flex-col gap-3">
      <Field label="שם תצוגה" name="displayName" defaultValue={state.values?.displayName ?? displayName} error={state.fieldErrors?.displayName} />
      <fieldset className="flex flex-col gap-3 rounded-2xl border border-line p-4">
        <legend className="px-1 text-sm font-bold">הדף שלך ברשתות</legend>
        <p className="-mt-1 text-sm text-ink-2">אינסטגרם, פייסבוק, טיקטוק, יוטיוב או אתר. מופיעים בדף הציבורי שלך.</p>
        <CreatorLinksFields values={state.values} saved={links} errors={state.fieldErrors} />
      </fieldset>
      <label className="flex flex-col gap-1.5 text-sm font-bold">קצת עליך
        <textarea name="bio" rows={3} maxLength={1000} defaultValue={state.values?.bio ?? bio ?? ''} className="rounded-xl border border-line px-3 py-2 text-base font-normal" />
      </label>
      {state.success && <Alert kind="success">{state.success}</Alert>}
      {state.error && <Alert>{state.error}</Alert>}
      <div><SubmitButton full={false} variant="secondary" pendingText="שומרים...">שמירה</SubmitButton></div>
    </form>
  );
}

type PriceProps = { defaultPrice: string; defaultFree: boolean; tiers: PriceTiers; days: number | null; error?: string };

function PriceFields(props: PriceProps) {
  // While paid routes are off, every route is free and no price is asked.
  if (!PAID_ROUTES) return <input type="hidden" name="free" value="on" />;
  return <PaidPriceFields {...props} />;
}

function PaidPriceFields({ defaultPrice, defaultFree, tiers, days, error }: PriceProps) {
  const [price, setPrice] = useState(defaultPrice);
  const [free, setFree] = useState(defaultFree);
  const tier = days === null ? null : tierFor(days, tiers);
  const agorot = parsePrice(price);
  const share = agorot && tier ? creatorShare(agorot, tier.rate) : null;
  const over = !!(agorot && tier && agorot > tier.maxAgorot);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-3">
        <Field label="מחיר (₪)" name="price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} disabled={free}
          error={free ? undefined : error} className="w-40" />
        <label className="flex min-h-12 items-center gap-2 font-bold">
          <input type="checkbox" name="free" checked={free} onChange={(e) => setFree(e.target.checked)} className="h-5 w-5 accent-[#0C2D4A]" /> חינם
        </label>
      </div>
      {!free && (
        <div role="note" className="rounded-xl border border-[#F2D9A6] bg-[#FFF8EA] p-3 text-sm">
          <p className="font-extrabold">שימו לב: זה מסלול בתשלום</p>
          {tier ? (
            <p className="mt-0.5 text-ink-2">
              {days} ימים = {tier.label}: מחיר עד {formatPrice(tier.maxAgorot)}, ו-YallaTrip גובה עמלה של {Math.round(tier.rate * 100)}% מכל רכישה. השאר עובר אליך.
              {share && !over && <> במחיר הזה: {formatPrice(share.creator)} אליך, {formatPrice(share.platform)} עמלת YallaTrip.</>}
              {over && <b className="text-danger"> המחיר גבוה מהמקסימום למסלול באורך הזה.</b>}
            </p>
          ) : (
            <p className="mt-0.5 text-ink-2">בחרו טיול, ונראה את המחיר המקסימלי והעמלה לפי מספר הימים.</p>
          )}
          <p className="mt-1 text-ink-2">רכישת מסלול היא סופית: לקונים אין החזר כספי, והם מאשרים זאת לפני התשלום.</p>
        </div>
      )}
    </div>
  );
}

export function PublishForm({ trips, tiers }: { trips: { id: string; title: string; stops: number; days: number; shared: boolean }[]; tiers: PriceTiers }) {
  const [state, action] = useActionState(publishRoute, {} as FormState);
  const [tripId, setTripId] = useState('');
  useEffect(() => { if (state.values?.tripId) setTripId(state.values.tripId); }, [state]);
  const e = state.fieldErrors ?? {};
  const chosen = trips.find((t) => t.id === tripId);
  if (!trips.length) return <p className="text-ink-2">כדי לפרסם, צריך טיול עם לפחות 3 מקומות משובצים בימים. <a href="/trips">לטיולים שלי</a></p>;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.error && <Alert>{state.error}</Alert>}
      <label className="flex flex-col gap-1.5 text-sm font-bold">איזה טיול לפרסם?
        {/* Remounted after each submit: the form clears its fields after sending, and the chosen trip should stay. */}
        <select key={JSON.stringify(state)} name="tripId" defaultValue={state.values?.tripId ?? ''} onChange={(ev) => setTripId(ev.target.value)} className="h-12 rounded-xl border border-line bg-white px-3 text-base font-normal">
          <option value="" disabled>בחרו טיול…</option>
          {trips.map((t) => (
            <option key={t.id} value={t.id} disabled={t.stops < 3 || t.shared}>
              {t.title} ({t.days} ימים · {t.stops} תחנות{t.shared ? ' · טיול משותף, אי אפשר לפרסם' : t.stops < 3 ? ' · צריך לפחות 3' : ''})
            </option>
          ))}
        </select>
        {e.tripId && <span className="font-semibold text-danger">{e.tripId}</span>}
      </label>
      <Field label="שם המסלול" name="title" maxLength={100} defaultValue={state.values?.title} error={e.title} />
      <label className="flex flex-col gap-1.5 text-sm font-bold">תיאור
        <textarea name="description" rows={5} maxLength={3000} defaultValue={state.values?.description}
          placeholder="למי המסלול מתאים, מה הקצב, מה מיוחד בו" className="rounded-xl border border-line px-3 py-2 text-base font-normal" />
        {e.description && <span className="font-semibold text-danger">{e.description}</span>}
      </label>
      <PriceFields defaultPrice={state.values?.price ?? '49'} defaultFree={state.values?.free === 'on'} tiers={tiers} days={chosen ? chosen.days : null} error={e.price} />
      <p className="text-sm text-ink-2">
        {PAID_ROUTES ? '' : 'המסלול יהיה זמין בחינם לכל מי שמשתמש ב-YallaTrip. '}מה שמתפרסם הוא עותק קפוא של הטיול. שינויים שתעשו אחר כך בטיול שלכם לא ישנו את מה שפורסם. הערות אישיות על מקומות לא מתפרסמות.
        המסלול עולה לחנות מיד.
      </p>
      <div><SubmitButton full={false} pendingText="שולחים...">שליחה לפרסום</SubmitButton></div>
    </form>
  );
}

export function RouteEditForm({ route, tiers }: {
  route: { id: string; title: string; description: string; price_agorot: number; status: string; days_count: number }; tiers: PriceTiers;
}) {
  const [state, action] = useActionState(updateRoute, {} as FormState);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="routeId" value={route.id} />
      <Field label="שם" name="title" defaultValue={state.values?.title ?? route.title} error={e.title} />
      <label className="flex flex-col gap-1 text-sm font-bold">תיאור
        <textarea name="description" rows={4} defaultValue={state.values?.description ?? route.description} className="rounded-xl border border-line px-3 py-2 text-base font-normal" />
        {e.description && <span className="font-semibold text-danger">{e.description}</span>}
      </label>
      <PriceFields defaultPrice={route.price_agorot ? String(route.price_agorot / 100) : '49'} defaultFree={route.price_agorot === 0} tiers={tiers} days={route.days_count} error={e.price} />
      {state.success && <Alert kind="success">{state.success}</Alert>}
      {state.error && <Alert>{state.error}</Alert>}
      <div className="flex flex-wrap gap-2">
        <SubmitButton full={false} name="intent" value="save" pendingText="שומרים...">שמירה</SubmitButton>
        {route.status !== 'unpublished' && <SubmitButton full={false} variant="danger" name="intent" value="unpublish">הסרה מהחנות</SubmitButton>}
      </div>
    </form>
  );
}
