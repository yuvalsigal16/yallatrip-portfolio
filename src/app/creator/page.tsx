import type { Metadata } from 'next';
import { AppHeader } from '@/components/AppHeader';
import { HERO_PHOTOS, PageHero } from '@/components/PageHero';
import { Alert } from '@/components/ui';
import { requireOnboardedUser } from '@/lib/auth/session';
import { getMyBalance, getMyCreator, getMyRoutes, getPriceTiers } from '@/lib/market/queries';
import { formatPrice, tierFor } from '@/lib/market/rules';
import { PAID_ROUTES } from '@/lib/features';
import { BecomeCreatorForm, CreatorProfileForm, PublishForm, RouteEditForm } from './CreatorForms';
import { InfluencerRequest } from '@/components/InfluencerRequest';
import { AddRecommendation, MyRecommendation, type MyRec } from './RecommendationForms';
import { CreatorTour } from './CreatorTour';

export const metadata: Metadata = { title: 'אזור יוצרים · YallaTrip' };

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'בבדיקה', cls: 'bg-[#FFF4E5] text-[#8A4B00]' },
  published: { label: 'בחנות', cls: 'bg-sea-tint text-sea' },
  rejected: { label: 'נדחה', cls: 'bg-danger-tint text-[#8E3313]' },
  unpublished: { label: 'הוסר', cls: 'bg-sand-2 text-ink-2' },
};

export default async function CreatorDashboard({ searchParams }: { searchParams: Promise<{ welcome?: string; published?: string }> }) {
  const sp = await searchParams;
  const { supabase, user, profile } = await requireOnboardedUser('/creator');
  const creator = await getMyCreator(supabase, user.id);

  // Publishing (and pricing) routes is for travel influencers and bloggers the admin approved.
  if (profile?.role === 'user') {
    const { data: req } = await supabase.from('profiles').select('influencer_requested_at').eq('id', user.id).maybeSingle();
    const pending = Boolean((req as { influencer_requested_at: string | null } | null)?.influencer_requested_at);
    return (
      <>
        <AppHeader name={profile?.display_name ?? null} role={profile?.role} avatar={profile?.avatar_url ?? null} />
        <PageHero photo={HERO_PHOTOS.creator} width="max-w-[640px]" overlap title="מסלולים בתשלום" subtitle={<>
          פרסום מסלולים בחנות, עם מחיר, פתוח למשפיענים ובלוגרים של טיולים שעובדים עם YallaTrip.
          רוצה לשתף טיול בחינם עם כולם? בהגדרות הטיול בוחרים &quot;ציבורי&quot;, והוא מופיע מיד ב&quot;מסלולים&quot;.
        </>} />
        <main className="relative mx-auto -mt-12 flex max-w-[640px] flex-col gap-5 px-5 pb-16 sm:px-8">
          <div className="rounded-2xl border border-line bg-white p-5">
            <InfluencerRequest status={pending ? 'pending' : 'none'} />
          </div>
        </main>
      </>
    );
  }

  if (!creator) {
    return (
      <>
        <AppHeader name={profile?.display_name ?? null} role={profile?.role} avatar={profile?.avatar_url ?? null} />
        <PageHero photo={HERO_PHOTOS.creator} width="max-w-[640px]" title={PAID_ROUTES ? 'למכור מסלולים ב-YallaTrip' : 'לפרסם מסלולים ב-YallaTrip'} subtitle={PAID_ROUTES
          ? 'בנית טיול מעולה? אחרים ישמחו לקבל אותו מוכן. מפרסמים מסלול, קובעים מחיר (או חינם), ומקבלים את רוב ההכנסה.'
          : 'בנית טיול מעולה? אחרים ישמחו לקבל אותו מוכן. מפרסמים אותו כמסלול, ומטיילים אחרים מעתיקים אותו לטיול שלהם ומתאימים לעצמם.'} />
        <main className="mx-auto max-w-[640px] px-5 py-10 sm:px-8">
          <div><BecomeCreatorForm suggestedName={profile?.display_name ?? ''} /></div>
        </main>
      </>
    );
  }

  const [routes, balance, tiers, tripsRes, recsRes] = await Promise.all([
    getMyRoutes(supabase, user.id),
    getMyBalance(supabase),
    getPriceTiers(supabase),
    supabase.from('trips').select('id, title, trip_places(count), trip_days(count), trip_members(count)').eq('owner_id', user.id).eq('is_snapshot', false).order('created_at', { ascending: false }),
    supabase.from('place_recommendations').select('id, name, category, body, hidden').eq('creator_id', user.id).order('created_at', { ascending: false }),
  ]);
  const recs = (recsRes.data ?? []) as unknown as MyRec[];
  const trips = ((tripsRes.data ?? []) as unknown as { id: string; title: string; trip_places: { count: number }[]; trip_days: { count: number }[]; trip_members: { count: number }[] }[])
    .map((t) => ({ id: t.id, title: t.title, stops: t.trip_places?.[0]?.count ?? 0, days: t.trip_days?.[0]?.count ?? 0, shared: (t.trip_members?.[0]?.count ?? 0) > 0 }));
  const short = tierFor(0, tiers);
  const long = tierFor(tiers.shortMaxDays + 1, tiers);
  const balanceDue = (balance?.earned_agorot ?? 0) - (balance?.paid_out_agorot ?? 0);

  return (
    <>
      <AppHeader name={profile?.display_name ?? null} role={profile?.role} avatar={profile?.avatar_url ?? null} />
      <PageHero photo={HERO_PHOTOS.creator} width="max-w-[960px]" title="אזור יוצרים" subtitle={<>הדף הציבורי שלך:{' '}
        <a href={`/creators/${creator.slug}`} dir="ltr" className="font-bold text-white underline decoration-white/50 underline-offset-4">/creators/{creator.slug}</a></>} />
      <main className="mx-auto flex max-w-[960px] flex-col gap-8 px-5 py-10 sm:px-8">
        <CreatorTour />
        {sp.welcome && <Alert kind="success">ברוכים הבאים! עכשיו אפשר לפרסם את המסלול הראשון.</Alert>}
        {sp.published && <Alert kind="success">המסלול עלה לחנות.</Alert>}

        {PAID_ROUTES && (<>
        <section className="grid gap-3 sm:grid-cols-3" aria-label="הכנסות">
          {[
            ['מכירות', String(balance?.sales_count ?? 0)],
            ['הכנסות (אחרי עמלה)', formatPrice(balance?.earned_agorot ?? 0).replace('חינם', '₪0')],
            ['יתרה לתשלום אליך', formatPrice(balanceDue).replace('חינם', '₪0')],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-line bg-white p-5">
              <p className="text-sm font-bold text-ink-2">{k}</p>
              <p className="mt-1 font-display text-3xl font-black">{v}</p>
            </div>
          ))}
        </section>
        <p className="-mt-4 text-sm text-muted">צוות YallaTrip מעביר אליך את היתרה ומתאם איתך את פרטי ההעברה והחשבונית. כל תשלום שבוצע יורד מהיתרה כאן.</p>
        </>)}

        {/* Single places, free for everyone: on the place's card and first in "✨ מה יש בסביבה". */}
        <section className="flex flex-col gap-4" aria-labelledby="recs-h">
          <div>
            <h2 id="recs-h" className="font-display text-2xl font-bold">ההמלצות שלי</h2>
            <p className="mt-1 text-ink-2">ממליצים על מקום אחד, בלי לבנות טיול שלם. מטיילים יראו &quot;⭐ מומלץ ע״י {creator.display_name}&quot; בכרטיס של המקום ובחיפוש &quot;מה יש בסביבה&quot;.</p>
          </div>
          <AddRecommendation />
          {recs.map((r) => <MyRecommendation key={r.id} rec={r} />)}
        </section>

        <section className="flex flex-col gap-4" data-tour="c-routes">
          <h2 className="font-display text-2xl font-bold">המסלולים שלי</h2>
          {routes.length === 0 && <p className="text-ink-2">עוד לא פרסמת מסלולים.</p>}
          {routes.map((r) => (
            <details key={r.id} className="rounded-2xl border border-line bg-white p-5">
              <summary className="flex cursor-pointer flex-wrap items-center gap-3">
                <span className="flex-1 font-extrabold">{r.title}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS[r.status]?.cls}`}>{STATUS[r.status]?.label}</span>
                <span className="text-sm text-ink-2">{PAID_ROUTES ? `${formatPrice(r.price_agorot)} · ${r.sales} ${r.price_agorot ? 'מכירות' : 'הורדות'}` : `${r.sales} העתקות`}</span>
              </summary>
              {r.status === 'rejected' && r.review_note && <div className="mt-3"><Alert>סיבת הדחייה: {r.review_note}</Alert></div>}
              <div className="mt-4">
                {r.status === 'published' && <p className="mb-3 text-sm"><a href={`/routes/${r.id}`}>צפייה בדף המסלול</a></p>}
                <RouteEditForm route={r} tiers={tiers} />
              </div>
            </details>
          ))}
        </section>

        {PAID_ROUTES && (
          <section aria-labelledby="pricing-h" className="flex flex-col gap-3">
            <h2 id="pricing-h" className="font-display text-2xl font-bold">כמה אפשר לגבות על מסלול</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { t: short, title: 'מסלול קצר / סוף שבוע' },
                { t: long, title: 'מסלול עומק ארוך / טיול מורכב' },
              ].map(({ t, title }) => (
                <div key={title} className="rounded-2xl border border-line bg-white p-5">
                  <p className="text-sm font-bold text-ink-2">{t.label}</p>
                  <p className="mt-0.5 text-lg font-extrabold">{title}</p>
                  <p className="mt-3 font-display text-3xl font-black">עד {formatPrice(t.maxAgorot)}</p>
                  <p className="mt-1 text-sm font-semibold">עמלת YallaTrip: {Math.round(t.rate * 100)}% מכל רכישה</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted">האורך נקבע לפי מספר הימים בטיול. אפשר גם לפרסם בחינם. רכישת מסלול היא סופית: אין החזר כספי, והקונים מאשרים זאת לפני התשלום.</p>
          </section>
        )}

        <section className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-6" data-tour="c-publish">
          <h2 className="font-display text-2xl font-bold">פרסום מסלול חדש</h2>
          <PublishForm trips={trips} tiers={tiers} />
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-6" data-tour="c-profile">
          <h2 className="text-lg font-extrabold">הפרופיל הציבורי שלי</h2>
          <CreatorProfileForm displayName={creator.display_name} bio={creator.bio} links={creator.links} />
        </section>
      </main>
    </>
  );
}
