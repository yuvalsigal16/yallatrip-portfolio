import type { Metadata } from 'next';
import { PublicHeader } from '@/components/PublicHeader';
import { Footer } from '@/components/Footer';
import { RouteSections } from '@/components/market/RouteSections';
import { getSessionUser } from '@/lib/auth/session';
import { getCatalog, getPublicTrips } from '@/lib/market/queries';
import { PublicTripCard } from '@/components/market/PublicTripCard';
import { isSort, SORTS } from '@/lib/market/rules';
import { PAID_ROUTES } from '@/lib/features';
import { HERO_PHOTOS, PageHero } from '@/components/PageHero';
import { storeIsOpen } from '@/lib/market/open';

export const metadata: Metadata = {
  title: 'מסלולים מוכנים · YallaTrip',
  description: 'מסלולי טיול בעברית, של מטיילים ויוצרי תוכן. משכפלים לטיול שלכם ומתאימים.',
};

export default async function RoutesPage({ searchParams }: { searchParams: Promise<{ q?: string; sort?: string }> }) {
  const sp = await searchParams;
  const { supabase, user } = await getSessionUser();
  const q = typeof sp.q === 'string' ? sp.q.trim().slice(0, 60) : '';
  const sort = isSort(sp.sort) ? sp.sort : 'popular';
  // The store (creators' routes) stays hidden until it has a few routes; trips travellers shared always show.
  const [store, publicTrips] = await Promise.all([storeIsOpen(), getPublicTrips(supabase, q)]);
  const routes = store ? await getCatalog(supabase, { q, sort }) : [];

  return (
    <>
      <PublicHeader signedIn={!!user} />
      <PageHero photo={HERO_PHOTOS.routes} width="max-w-[1200px]" title="מסלולים מוכנים"
        subtitle="מסלולים של מטיילים ויוצרי תוכן. מקבלים עותק לטיול שלכם, ומשנים אותו איך שרוצים.">
        <form method="get" className="flex max-w-3xl flex-col gap-2 rounded-[22px] bg-white p-2 text-ink shadow-[0_20px_50px_-12px_rgba(0,0,0,.45)] sm:flex-row">
          <label className="sr-only" htmlFor="q">יעד</label>
          <input id="q" name="q" defaultValue={q} placeholder="לאן? למשל: רומא" className="h-12 flex-1 rounded-xl bg-transparent px-4 text-lg outline-none focus:!shadow-none" />
          <label className="sr-only" htmlFor="sort">מיון</label>
          {store && <select id="sort" name="sort" defaultValue={sort} className="h-12 rounded-xl border border-line bg-sand px-3 font-semibold">
            {SORTS.filter((s) => PAID_ROUTES || s.key !== 'price').map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>}
          <button type="submit" className="h-12 rounded-full bg-gradient-to-l from-[#1B73C9] to-[#2E9BDB] px-7 font-bold text-white shadow-[0_8px_20px_-8px_rgba(27,115,201,.7)] hover:brightness-110">חיפוש</button>
        </form>
      </PageHero>
      <main className="mx-auto max-w-[1200px] px-5 py-10 sm:px-10">

        {store && (routes.length === 0 ? (
          <div className="mb-14 rounded-3xl border-2 border-dashed border-line p-10 text-center">
            <p className="text-xl font-extrabold">{q ? `עוד אין מסלולים ל${q}` : 'עוד אין מסלולים בחנות'}</p>
            <p className="mt-2 text-ink-2">בנית טיול שאת/ה גאה בו? <a href="/creator" className="font-bold">פרסמו אותו כמסלול</a>.</p>
          </div>
        ) : (
          <div className="mb-14"><RouteSections routes={routes} /></div>
        ))}

        {/* Trips travelers made public: anyone can see them and add them to their own trips to edit */}
        <section aria-labelledby="public-trips">
          <h2 id="public-trips" className="font-display text-3xl font-black">טיולים שמטיילים שיתפו</h2>
          <p className="mt-2 text-ink-2">טיולים ציבוריים. לוחצים, מוסיפים לטיולים שלכם, ועורכים איך שרוצים.</p>
          {publicTrips.length === 0 ? (
            <p className="mt-5 rounded-2xl bg-sand-2 px-5 py-4 text-ink-2">{q ? `עוד אין טיולים ציבוריים ל${q}.` : 'עוד אין טיולים ציבוריים.'} בנית טיול שווה? אפשר לשתף אותו: הגדרות טיול ← שיתוף ← ציבורי</p>
          ) : (
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {publicTrips.map((t, i) => <PublicTripCard key={t.id} t={t} index={i} />)}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
