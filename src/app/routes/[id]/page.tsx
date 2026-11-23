import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PublicHeader } from '@/components/PublicHeader';
import { Footer } from '@/components/Footer';
import { Alert, buttonBase, buttonStyles } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { getSessionUser } from '@/lib/auth/session';
import { getCatalogRoute, getMyCopy, getMyCreator, getReviews, getRoutePreview } from '@/lib/market/queries';
import { formatPrice, stars } from '@/lib/market/rules';
import { categoryMeta } from '@/lib/places/categories';
import { getPaymentProvider } from '@/lib/payments';
import { buyRoute, getFreeRoute } from '@/app/market-actions';
import { ReportForm, ReviewForm } from './RouteForms';

type P = { params: Promise<{ id: string }>; searchParams: Promise<{ purchase?: string; error?: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { supabase } = await getSessionUser();
  const r = await getCatalogRoute(supabase, (await params).id);
  return r ? { title: `${r.title} · YallaTrip`, description: r.description.slice(0, 160) } : { title: 'מסלול · YallaTrip' };
}

const ERRORS: Record<string, string> = {
  'payments-off': 'התשלומים עוד לא הופעלו באתר. נסו שוב בקרוב.',
  checkout: 'לא הצלחנו לפתוח את דף התשלום. נסו שוב.',
  own: 'זה המסלול שלך. אפשר לראות אותו באזור היוצרים.',
  get: 'לא הצלחנו להוסיף את המסלול. נסו שוב.',
  'no-refund': 'כדי לקנות, צריך לסמן שקראת ואישרת שאין החזר כספי על מסלול שנרכש.',
};

export default async function RoutePage({ params, searchParams }: P) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, user } = await getSessionUser();
  const r = await getCatalogRoute(supabase, id);
  if (!r) notFound();
  const [days, reviews, mine, creator] = await Promise.all([
    getRoutePreview(supabase, id), getReviews(supabase, id), getMyCopy(supabase, id), user ? getMyCreator(supabase, user.id) : null,
  ]);
  // The creator looking at their own route: it stays as it is in the store, and they edit it from the creator area.
  const own = !!creator && creator.slug === r.creator_slug;
  const paymentsOn = !!getPaymentProvider();

  return (
    <>
      <PublicHeader signedIn={!!user} />
      <main className="mx-auto grid max-w-[1100px] gap-8 px-5 py-10 sm:px-10 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-6">
          <div>
            <a href="/routes" className="text-sm font-bold">← כל המסלולים</a>
            <p className="mt-3 text-sm font-bold text-terracotta">{r.destination_name} · {r.days_count} ימים · {r.places_count} מקומות</p>
            <h1 className="mt-1 font-display text-4xl font-black sm:text-5xl">{r.title}</h1>
            <p className="mt-2 text-ink-2">מאת <a href={`/creators/${r.creator_slug}`} className="font-bold">{r.creator_name}</a>
              {r.rating_count > 0 && <> · <span className="text-[#C98A1B]">{stars(r.rating_avg)}</span> {r.rating_avg.toFixed(1)} ({r.rating_count})</>}
            </p>
          </div>

          {sp.purchase === 'success' && !mine && <Alert kind="info">התשלום התקבל. מכינים את העותק שלך, זה לוקח כמה שניות. <a href={`/routes/${id}?purchase=success`}>רענון</a></Alert>}
          {sp.purchase === 'cancelled' && <Alert kind="info">התשלום בוטל. לא חויבת.</Alert>}
          {sp.error && ERRORS[sp.error] && <Alert>{ERRORS[sp.error]}</Alert>}

          <p className="whitespace-pre-line text-lg leading-relaxed">{r.description}</p>

          <section aria-labelledby="days-h" className="flex flex-col gap-3">
            <h2 id="days-h" className="font-display text-2xl font-bold">מה במסלול</h2>
            {days.map((d) => (
              <div key={d.day_index} className="rounded-2xl border border-line bg-white p-4">
                <div className="flex items-baseline justify-between">
                  <b>יום {d.day_index}{d.title && ` · ${d.title}`}</b>
                  <span className="text-sm text-muted">{d.stop_count} תחנות</span>
                </div>
                {d.stops ? (
                  <ol className="mt-2 flex flex-col gap-1 text-sm">
                    {d.stops.map((s, i) => <li key={i}><span style={{ color: categoryMeta(s.category_key).color }}>●</span> {s.label}</li>)}
                  </ol>
                ) : (
                  <p className="mt-1 text-sm text-ink-2">{d.categories.map((c) => categoryMeta(c).name).join(' · ') || '—'}</p>
                )}
              </div>
            ))}
            {!mine && <p className="text-sm text-muted">היום הראשון מוצג במלואו. את כל השאר מקבלים בעותק לטיול שלך.</p>}
          </section>

          <section aria-labelledby="rev-h" className="flex flex-col gap-3">
            <h2 id="rev-h" className="font-display text-2xl font-bold">מה מטיילים אומרים</h2>
            {mine && <ReviewForm routeId={id} current={mine.reviewed} />}
            {reviews.length === 0 ? <p className="text-ink-2">עוד אין דירוגים.</p> : reviews.map((rv) => (
              <article key={rv.id} className="rounded-2xl border border-line bg-white p-4">
                <p><span className="text-[#C98A1B]">{stars(rv.rating)}</span> <b>{rv.author_first_name}</b></p>
                {rv.body && <p className="mt-1 whitespace-pre-line">{rv.body}</p>}
                {user && <div className="mt-2"><ReportForm targetType="review" targetId={rv.id} back={`/routes/${id}`} /></div>}
              </article>
            ))}
          </section>
        </div>

        <aside className="h-fit rounded-3xl border border-line bg-white p-6 lg:sticky lg:top-6">
          <p className="font-display text-4xl font-black">{formatPrice(r.price_agorot)}</p>
          <p className="mt-1 text-sm text-ink-2">נכנס לטיולים שלך ונפתח לעריכה מיד: ימים, שעות, מקומות והערות. אפשר לשנות הכול.</p>
          <div className="mt-5">
            {own ? (
              <div className="flex flex-col gap-2">
                <p className="rounded-xl bg-sand-2 p-3 text-sm font-semibold">זה המסלול שלך. בחנות הוא מוצג כמו שהוא; עריכה ועדכון דרך אזור היוצרים.</p>
                <a href="/creator" className={`${buttonBase} ${buttonStyles.primary} w-full no-underline`}>עריכה באזור היוצרים</a>
              </div>
            ) : mine?.copiedTripId ? (
              <a href={`/trips/${mine.copiedTripId}`} className={`${buttonBase} ${buttonStyles.primary} w-full no-underline`}>פתיחת העותק שלי</a>
            ) : r.price_agorot === 0 ? (
              <form action={getFreeRoute}><input type="hidden" name="routeId" value={id} />
                <SubmitButton pendingText="מוסיפים...">הוספה לטיולים שלי ועריכה</SubmitButton></form>
            ) : paymentsOn ? (
              <form action={buyRoute} className="flex flex-col gap-3"><input type="hidden" name="routeId" value={id} />
                <label className="flex items-start gap-2 rounded-xl border border-[#F2D9A6] bg-[#FFF8EA] p-3 text-sm font-semibold">
                  <input type="checkbox" name="noRefund" value="1" required className="mt-0.5 h-5 w-5 shrink-0 accent-[#0C2D4A]" />
                  <span>ידוע לי שזה תוכן דיגיטלי שנפתח לי מיד אחרי התשלום, ולכן <b>אין החזר כספי</b> על מסלול שנרכש.</span>
                </label>
                <SubmitButton pendingText="פותחים תשלום...">קנייה ב-{formatPrice(r.price_agorot)}</SubmitButton></form>
            ) : (
              <p className="rounded-xl bg-sand-2 p-3 text-sm font-semibold">הרכישה תיפתח בקרוב.</p>
            )}
          </div>
          {!user && <p className="mt-3 text-xs text-muted">נבקש להתחבר לפני שמוסיפים.</p>}
          {r.price_agorot > 0 && !own && !mine?.copiedTripId && (
            <p className="mt-4 text-xs font-bold text-ink-2">אין החזר כספי על רכישת מסלול. <a href="/terms#refunds">תנאי הרכישה</a></p>
          )}
          {paymentsOn && r.price_agorot > 0 && <p className="mt-2 text-xs text-muted">התשלום מאובטח אצל ספק התשלומים. אנחנו לא שומרים פרטי כרטיס אשראי.</p>}
          {user && <div className="mt-4"><ReportForm targetType="route" targetId={id} back={`/routes/${id}`} /></div>}
        </aside>
      </main>
      <Footer />
    </>
  );
}
