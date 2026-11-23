import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { HERO_PHOTOS, PageHero } from '@/components/PageHero';
import { requireOnboardedUser } from '@/lib/auth/session';
import { canEditTrip, getTrip } from '@/lib/trips/queries';
import { getTripPlan } from '@/lib/planning/queries';
import { FEATURES } from '@/lib/features';
import { getMapPlaces } from '@/lib/places/queries';
import { distanceMeters } from '@/lib/geo';
import { CATEGORIES } from '@/lib/places/categories';
import { categoryOf, formatMoney } from '@/lib/trips/extras';
import { formatDateRangeHe } from '@/lib/trips/rules';

export const metadata: Metadata = { title: 'סיכום הטיול · YallaTrip', robots: { index: false, follow: false } };

const card = 'rounded-2xl border border-line bg-white p-4 sm:p-5';

/** The trip in numbers: days, places, distance between stops, money, photos. */
export default async function SummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await requireOnboardedUser(`/trips/${id}/summary`);
  if (!(await canEditTrip(supabase, id))) notFound();
  const trip = await getTrip(supabase, id);
  if (!trip) notFound();
  const [days, places, { data: expenseRows }, { data: budgetRow }, { data: photoRows }, { count: bookingCount }] = await Promise.all([
    getTripPlan(supabase, trip.id),
    getMapPlaces(supabase, trip.id),
    supabase.from('trip_expenses').select('category, home_amount').eq('trip_id', trip.id),
    supabase.from('trip_budgets').select('home_currency, total').eq('trip_id', trip.id).maybeSingle(),
    supabase.from('trip_album').select('url, taken_at').eq('trip_id', trip.id).order('taken_at'),
    // Bookings switched off (src/lib/features.ts): saved bookings stay in the database, unseen.
    FEATURES.bookings ? supabase.from('trip_bookings').select('id', { count: 'exact', head: true }).eq('trip_id', trip.id) : Promise.resolve({ count: 0 }),
  ]);
  const byId = new Map(places.map((p) => [p.id, p]));
  const stops = days.flatMap((d) => d.stops);
  const scheduledIds = new Set(stops.map((s) => s.savedPlaceId));
  const visited = places.filter((p) => p.status === 'visited').length;

  // Straight lines between each day's stops, with the usual 1.3 detour factor: a rough figure, said as such.
  let meters = 0;
  for (const d of days) {
    const pts = d.stops.map((s) => byId.get(s.savedPlaceId)).filter((x): x is NonNullable<typeof x> => !!x);
    for (let i = 1; i < pts.length; i += 1) meters += distanceMeters(pts[i - 1]!, pts[i]!) * 1.3;
  }
  const km = Math.round(meters / 100) / 10;

  const byCategory = new Map<string, number>();
  for (const p of places) byCategory.set(p.categoryKey ?? 'attraction', (byCategory.get(p.categoryKey ?? 'attraction') ?? 0) + 1);
  const topCategories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
    .map(([k, n]) => ({ name: CATEGORIES.find((c) => c.key === k)?.name ?? 'מקום', n }));

  const expenses = (expenseRows ?? []) as { category: string; home_amount: number }[];
  const currency = (budgetRow as { home_currency: string } | null)?.home_currency ?? 'ILS';
  const budgetTotal = (budgetRow as { total: number | null } | null)?.total ?? null;
  const spent = expenses.reduce((s, e) => s + Number(e.home_amount), 0);
  const spendByCat = new Map<string, number>();
  for (const e of expenses) spendByCat.set(e.category, (spendByCat.get(e.category) ?? 0) + Number(e.home_amount));
  const topSpend = [...spendByCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  const photos = (photoRows ?? []) as { url: string }[];
  const pick = photos.length <= 6 ? photos : Array.from({ length: 6 }, (_, i) => photos[Math.floor((i * (photos.length - 1)) / 5)]!);
  const signed = pick.length ? (await supabase.storage.from('trip-album').createSignedUrls(pick.map((p) => p.url), 3600)).data ?? [] : [];
  const photoLinks = signed.map((s) => s.signedUrl).filter((u): u is string => !!u);

  const fullestDay = [...days].sort((a, b) => b.stops.length - a.stops.length)[0];
  const stat = (value: string, label: string) => (
    <div className="rounded-2xl bg-sand-2/70 p-3 text-center">
      <p className="font-display text-3xl font-black text-ink" dir="auto">{value}</p>
      <p className="text-sm font-semibold text-ink-2">{label}</p>
    </div>
  );

  return (
    <>
      <AppHeader name={profile?.display_name ?? null} role={profile?.role} avatar={profile?.avatar_url ?? null} />
      <PageHero photo={HERO_PHOTOS.newTrip} width="max-w-[640px]" overlap back={{ href: `/trips/${trip.id}`, label: '→ חזרה לטיול' }}
        eyebrow={trip.title} title="סיכום הטיול" subtitle={formatDateRangeHe(trip.start_date, trip.end_date) ?? 'הטיול במספרים'} />
      <main className="relative mx-auto -mt-12 flex max-w-[640px] flex-col gap-6 px-4 pb-16 sm:px-8">
        <section className={`${card} grid grid-cols-2 gap-3 sm:grid-cols-3`} aria-label="הטיול במספרים">
          {stat(String(days.length), 'ימים')}
          {stat(String(places.length), 'מקומות שנשמרו')}
          {stat(String(scheduledIds.size), 'מקומות במסלול')}
          {stat(String(visited), 'מקומות שביקרתי')}
          {stat(km > 0 ? `~${km}` : '0', 'ק״מ בין התחנות')}
          {stat(String(photos.length), 'תמונות באלבום')}
        </section>

        {(topCategories.length > 0 || fullestDay) && (
          <section className={`${card} flex flex-col gap-2`}>
            <h2 className="text-xl font-extrabold">מה היה בטיול</h2>
            {topCategories.length > 0 && <p>{topCategories.map((c) => `${c.n} ${c.name}`).join(' · ')}</p>}
            {fullestDay && fullestDay.stops.length > 0 && (
              <p className="text-ink-2">היום הכי מלא: יום {fullestDay.dayIndex}{fullestDay.title ? ` (${fullestDay.title})` : ''}, {fullestDay.stops.length} מקומות.</p>
            )}
            {(bookingCount ?? 0) > 0 && <p className="text-ink-2">{bookingCount} הזמנות ומסמכים נשמרו בטיול.</p>}
          </section>
        )}

        <section className={`${card} flex flex-col gap-2`}>
          <h2 className="text-xl font-extrabold">כסף</h2>
          {expenses.length === 0 ? <p className="text-ink-2">לא נרשמו הוצאות. אפשר לרשום אותן בעמוד התקציב.</p> : (
            <>
              <p className="font-display text-3xl font-black" dir="ltr">{formatMoney(spent, currency)}</p>
              <p className="text-ink-2">
                {expenses.length} הוצאות{days.length > 0 && <>, בערך <span dir="ltr">{formatMoney(spent / days.length, currency)}</span> ליום</>}
                {budgetTotal ? <>, מתוך תקציב של <span dir="ltr">{formatMoney(Number(budgetTotal), currency)}</span></> : null}.
              </p>
              <ul className="text-sm">{topSpend.map(([k, v]) => <li key={k}>{categoryOf(k).icon} {categoryOf(k).label}: <span dir="ltr" className="font-bold">{formatMoney(v, currency)}</span></li>)}</ul>
            </>
          )}
        </section>

        {photoLinks.length > 0 && (
          <section className={`${card} flex flex-col gap-3`}>
            <h2 className="text-xl font-extrabold">רגעים מהטיול</h2>
            <div className="grid grid-cols-3 gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {photoLinks.map((u) => <img key={u} src={u} alt="" loading="lazy" className="aspect-square w-full rounded-xl object-cover" />)}
            </div>
            <a href={`/trips/${trip.id}/album`} className="font-bold">לכל האלבום</a>
          </section>
        )}
        <p className="text-xs text-muted">המרחק הוא הערכה לפי קו ישר בין התחנות של כל יום, לא מדידה של מה שהלכת בפועל.</p>
      </main>
    </>
  );
}
