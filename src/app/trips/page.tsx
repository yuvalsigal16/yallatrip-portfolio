import { TodayBanner } from '@/components/trips/TodayEntry';
import type { Metadata } from 'next';
import { AppHeader } from '@/components/AppHeader';
import { Alert, buttonBase, buttonStyles } from '@/components/ui';
import { TripCard } from '@/components/trips/TripCard';
import { requireOnboardedUser } from '@/lib/auth/session';
import { getMyInvites, getMyTrips } from '@/lib/trips/queries';
import { Avatar } from '@/components/Avatar';
import { answerInvite } from './members-actions';
import { formatDateRangeHe } from '@/lib/trips/rules';
import { sortTrips, todayInIsrael } from '@/lib/trips/rules';
import { getCatalog } from '@/lib/market/queries';
import { ROUTES_MIN } from '@/lib/market/open';
import { RouteCard } from '@/components/market/RouteCard';
import { FEATURES } from '@/lib/features';
import { HERO_PHOTOS, PageHero } from '@/components/PageHero';
import { CoachTour } from '@/components/tour/CoachTour';
import { restartTours } from '@/components/tour/actions';

export const metadata: Metadata = { title: 'הטיולים שלי · YallaTrip' };

type Search = Promise<{ password?: string; deleted?: string; invite?: string; left?: string; find?: string }>;

// The signed-in home page: "where to?", my trips, and (later) popular routes.
export default async function TripsPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const { supabase, user, profile } = await requireOnboardedUser('/trips');
  const today = todayInIsrael();
  const [myTrips, popular, invites] = await Promise.all([
    getMyTrips(supabase, user.id), FEATURES.routes ? getCatalog(supabase, { sort: 'popular', limit: ROUTES_MIN }) : Promise.resolve([]), getMyInvites(supabase),
  ]);
  // Search by name or destination (shown once there are enough trips to need it); ended trips sit apart.
  const find = typeof sp.find === 'string' ? sp.find.trim().slice(0, 60).toLowerCase() : '';
  const sorted = sortTrips(myTrips, today);
  const matches = find ? sorted.filter((t) => `${t.title} ${t.destination_name}`.toLowerCase().includes(find)) : sorted;
  const ended = (t: { end_date: string | null }) => !!t.end_date && t.end_date < today;
  const pastTrips = matches.filter(ended);
  const all = matches.filter((t) => !ended(t));
  const trips = all.filter((t) => !t.shared);
  const sharedTrips = all.filter((t) => t.shared);
  const firstName = profile?.display_name?.split(' ')[0];

  return (
    <>
      <AppHeader name={profile?.display_name ?? null} role={profile?.role} avatar={profile?.avatar_url ?? null} />
      <PageHero photo={HERO_PHOTOS.trips} title={firstName ? `${firstName}, לאן טסים?` : 'לאן טסים?'}
        subtitle="נועצים על המפה את כל מה שרוצים לראות, ו-YallaTrip מסדר את זה למסלול יומי.">
        {profile?.role === 'admin' && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <form action={restartTours}>
            <button type="submit" data-tour="help-home"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/15 px-4 py-2 text-sm font-bold text-white backdrop-blur-md hover:bg-white/25">
              הדרכה
            </button>
          </form>
        </div>
        )}
        <form action="/trips/new" method="get" data-tour="new-trip"
          className="flex max-w-2xl flex-col gap-2 rounded-[22px] bg-white p-2 shadow-[0_20px_50px_-12px_rgba(0,0,0,.45)] sm:flex-row">
          <label className="flex flex-1 items-center gap-2.5 px-3 text-ink">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1B73C9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" />
            </svg>
            <span className="sr-only">יעד</span>
            <input name="q" type="text" maxLength={200} placeholder="עיר, מדינה או אזור. למשל: רומא"
              className="h-12 flex-1 bg-transparent text-lg outline-none focus:!shadow-none" />
          </label>
          <button type="submit" className={`${buttonBase} ${buttonStyles.primary} min-h-14 px-7 text-[17px]`}>
            + תכנון טיול חדש
          </button>
        </form>
      </PageHero>
      <main className="mx-auto max-w-[1280px] px-5 pt-10 pb-16 sm:px-10">
        <TodayBanner trips={myTrips.map((t) => ({ id: t.id, title: t.title, start_date: t.start_date, end_date: t.end_date }))} />
        {(sp.password === 'updated' || sp.deleted || sp.invite || sp.left) && (
          <div className="mb-6 flex flex-col gap-3">
            {sp.password === 'updated' && <Alert kind="success">הסיסמה עודכנה.</Alert>}
            {sp.deleted && <Alert kind="info">הטיול נמחק.</Alert>}
            {sp.invite === 'declined' && <Alert kind="info">ההזמנה נדחתה.</Alert>}
            {sp.invite === 'error' && <Alert>לא הצלחנו לענות להזמנה. נסו שוב.</Alert>}
            {sp.left && <Alert kind="info">יצאת מהטיול המשותף.</Alert>}
          </div>
        )}

        {/* Invitations to plan a trip together */}
        {invites.length > 0 && (
          <section aria-labelledby="invites-h" className="mb-10 flex flex-col gap-3">
            <h2 id="invites-h" className="text-xl font-black">הזמנות לטיול משותף</h2>
            {invites.map((inv) => {
              const range = formatDateRangeHe(inv.start_date, inv.end_date);
              return (
                <div key={inv.trip_id} className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4 sm:flex-row sm:items-center">
                  <Avatar url={inv.from_avatar} name={inv.from_name} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold">{inv.from_name ?? 'מישהו'} מזמין/ה אותך לתכנן יחד את &quot;{inv.title}&quot;</p>
                    <p className="text-sm text-ink-2">{inv.destination}{range && ` · ${range}`}</p>
                  </div>
                  <form action={answerInvite} className="flex gap-2">
                    <input type="hidden" name="tripId" value={inv.trip_id} />
                    <button type="submit" name="answer" value="accept" className={`${buttonBase} ${buttonStyles.primary} min-h-11`}>אישור והצטרפות</button>
                    <button type="submit" name="answer" value="decline" className={`${buttonBase} ${buttonStyles.secondary} min-h-11`}>לא תודה</button>
                  </form>
                </div>
              );
            })}
          </section>
        )}

        {/* My trips */}
        <section aria-labelledby="my-trips">
          <h2 id="my-trips" className="mb-6 font-display text-3xl font-black">הטיולים שלי</h2>
          {(myTrips.length >= 4 || find) && (
            <form action="/trips" method="get" className="mb-6 flex max-w-md gap-2" role="search">
              <label htmlFor="find-trip" className="sr-only">חיפוש טיול</label>
              <input id="find-trip" name="find" type="search" defaultValue={find} maxLength={60} placeholder="חיפוש לפי שם או יעד"
                className="h-11 min-w-0 flex-1 rounded-full border border-line bg-white px-4 text-base" />
              <button type="submit" className={`${buttonBase} ${buttonStyles.secondary} min-h-11`}>חיפוש</button>
              {find && <a href="/trips" className="inline-flex min-h-11 items-center px-2 font-bold">ניקוי</a>}
            </form>
          )}
          {find && matches.length === 0 ? (
            <p className="rounded-2xl bg-sand-2 px-5 py-4 text-ink-2">לא נמצא טיול שמתאים ל&quot;{find}&quot;.</p>
          ) : trips.length === 0 && pastTrips.length > 0 && sharedTrips.length === 0 ? (
            <p className="rounded-2xl bg-sand-2 px-5 py-4 text-ink-2">אין טיול קרוב. <a href="/trips/new" className="font-bold">לתכנן טיול חדש</a></p>
          ) : trips.length === 0 && sharedTrips.length > 0 ? (
            <p className="rounded-2xl bg-sand-2 px-5 py-4 text-ink-2">כל הטיולים שלך משותפים ומופיעים למטה. <a href="/trips/new" className="font-bold">לתכנן טיול חדש</a></p>
          ) : trips.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-line px-6 py-12 text-center">
              <p className="text-xl font-extrabold">עוד אין טיולים</p>
              <p className="mt-2 text-ink-2">מתחילים מיעד ותאריכים, ואת השאר ממלאים בקצב שלך.</p>
              <a href="/trips/new" className={`${buttonBase} ${buttonStyles.primary} mt-6 no-underline`}>לטיול הראשון</a>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {trips.map((t, i) => <TripCard key={t.id} trip={t} today={today} index={i} />)}
            </div>
          )}
        </section>

        {/* Trips planned together with other people */}
        {sharedTrips.length > 0 && (
          <section className="mt-14" aria-labelledby="shared-trips">
            <h2 id="shared-trips" className="mb-2 font-display text-3xl font-black">טיולים משותפים</h2>
            <p className="mb-6 text-ink-2">טיולים שמתכננים יחד. כל שינוי מופיע אצל כולם, והם נשארים פרטיים ביניכם.</p>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {sharedTrips.map((t, i) => <TripCard key={t.id} trip={t} today={today} index={i + 1} />)}
            </div>
          </section>
        )}

        {/* Trips that already ended */}
        {pastTrips.length > 0 && (
          <details className="mt-14" open={!!find}>
            <summary className="cursor-pointer font-display text-2xl font-black">טיולים שהסתיימו ({pastTrips.length})</summary>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {pastTrips.map((t, i) => <TripCard key={t.id} trip={t} today={today} index={i + 2} />)}
            </div>
          </details>
        )}

        {/* Popular routes from the store, once it has a few (see ROUTES_MIN) */}
        {popular.length >= ROUTES_MIN && (
        <section className="mt-14" aria-labelledby="popular">
          <div className="mb-5 flex items-baseline justify-between">
            <h2 id="popular" className="font-display text-3xl font-black">מסלולים פופולריים</h2>
            <a href="/routes" className="font-bold">לכל המסלולים</a>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {popular.map((r, i) => <RouteCard key={r.id} r={r} index={i + 1} />)}
          </div>
        </section>
        )}
      </main>
      {/* The manager's full guide of this screen: opens after "הדרכה" (travellers get the short guides inside a trip). */}
      {profile?.role === 'admin' && !profile.tours_seen?.includes('home') && <CoachTour kind="home" />}
    </>
  );
}
