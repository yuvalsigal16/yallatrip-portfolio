import type { Metadata } from 'next';
import { AppHeader } from '@/components/AppHeader';
import { requireOnboardedUser } from '@/lib/auth/session';
import { AvatarPicker } from '@/components/AvatarPicker';
import { getTravelStats } from '@/lib/profile/stats';
import { Countdown } from '@/components/profile/Countdown';
import { Passport } from '@/components/profile/Passport';
import { formatDayHe } from '@/lib/trips/rules';
import { DeleteAccountForm, FeedbackForm, NameForm, PreferencesForm } from './ProfileForms';
import { InfluencerRequest } from '@/components/InfluencerRequest';
import { FEATURES } from '@/lib/features';
import { HERO_PHOTOS, PageHero } from '@/components/PageHero';

export const metadata: Metadata = { title: 'הפרופיל שלי · YallaTrip' };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ feedback?: string }> }) {
  const { feedback } = await searchParams;
  const { supabase, user, profile } = await requireOnboardedUser('/profile');
  const viaGoogle = user.app_metadata?.provider === 'google';
  const [stats, prefsRes, inflRes] = await Promise.all([
    getTravelStats(supabase, user.id),
    supabase.from('user_preferences').select('travel_styles, default_transport, keeps_shabbat, keeps_kosher').eq('user_id', user.id).maybeSingle(),
    supabase.from('profiles').select('influencer_requested_at').eq('id', user.id).maybeSingle(),
  ]);
  const influencerStatus = profile?.role && profile.role !== 'user' ? 'approved'
    : (inflRes.data as { influencer_requested_at: string | null } | null)?.influencer_requested_at ? 'pending' : 'none';
  const prefs = prefsRes.data as unknown as { travel_styles: string[]; default_transport: string[]; keeps_shabbat?: boolean; keeps_kosher?: boolean } | null;
  const tiles = [
    { n: stats.trips, label: stats.trips === 1 ? 'טיול' : 'טיולים' },
    { n: stats.destinations.length, label: 'יעדים' },
  ];

  return (
    <>
      <AppHeader name={profile?.display_name ?? null} role={profile?.role} avatar={profile?.avatar_url ?? null} />
      <PageHero photo={HERO_PHOTOS.profile} title="הפרופיל שלי" subtitle="הטיולים, היעדים והדרכון שלך במקום אחד." width="max-w-[760px]" overlap />
      <main className="relative mx-auto -mt-12 flex max-w-[760px] flex-col gap-6 px-5 pb-16 sm:px-8">

        {/* Who I am + my travels in numbers */}
        <section className="overflow-hidden rounded-3xl border border-line bg-white" aria-labelledby="photo-title">
          <div className="bg-gradient-to-l from-[#1B73C9] to-[#35A7E0] px-6 pb-5 pt-6 text-white">
            <h2 id="photo-title" className="sr-only">תמונת פרופיל</h2>
            <div className="flex flex-wrap items-center gap-5">
              <AvatarPicker bare userId={user.id} url={profile?.avatar_url ?? null} name={profile?.display_name ?? null} size={104} />
              <div className="min-w-0">
                <p className="text-2xl font-extrabold">{profile?.display_name || 'מטייל/ת'}</p>
                {user.created_at && (
                  <p className="text-sm text-white/85">
                    ב-YallaTrip מאז {new Date(user.created_at).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })}
                  </p>
                )}
              </div>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-px bg-line">
            {tiles.map((t) => (
              <div key={t.label} className="flex flex-col items-center bg-white px-3 py-4">
                <dd className="bg-gradient-to-l from-[#1B73C9] to-[#35A7E0] bg-clip-text text-4xl font-black text-transparent">{t.n}</dd>
                <dt className="text-sm font-bold text-ink-2">{t.label}</dt>
              </div>
            ))}
          </dl>
          <div className="flex flex-col gap-3 px-6 py-5">
            {stats.next ? (
              <Countdown startDate={stats.next.startDate} href={`/trips/${stats.next.id}`}
                title={`${stats.next.title} · ${formatDayHe(stats.next.startDate) ?? ''}`} />
            ) : (
              <a href="/trips/new" className="rounded-xl bg-sand-2 px-4 py-3 font-bold text-ink no-underline">אין טיול מתוכנן כרגע. לתכנן את הטיול הבא ←</a>
            )}
            {stats.destinations.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-bold text-ink-2">היעדים שלי</p>
                <ul className="flex flex-wrap gap-2">
                  {stats.destinations.map((d) => (
                    <li key={d} className="rounded-full border border-line bg-sand px-3 py-1 text-sm font-bold">{d}</li>
                  ))}
                </ul>
              </div>
            )}
            {stats.plannedStops > 0 && (
              <p className="text-sm text-muted">{stats.plannedStops} תחנות כבר משובצות בימי הטיולים שלך.</p>
            )}
          </div>
        </section>

        <Passport stamps={stats.stamps} daysTraveled={stats.daysTraveled} kmTraveled={stats.kmTraveled} />

        {/* Closed by default so the page stays light; the arrow opens it for editing. */}
        <details className="group rounded-2xl border border-line bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6 [&::-webkit-details-marker]:hidden">
            <span>
              <span className="block text-lg font-extrabold">סגנון הטיול שלי</span>
              <span className="block text-sm text-muted">ההעדפות מההרשמה. כל טיול חדש יתחיל מהן.</span>
            </span>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-terracotta-tint text-terracotta transition-transform group-open:rotate-180" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
            </span>
          </summary>
          <div className="border-t border-line p-6">
            <PreferencesForm styles={prefs?.travel_styles ?? []} transport={prefs?.default_transport ?? ['walk', 'transit']}
              shabbat={prefs?.keeps_shabbat === true} kosher={prefs?.keeps_kosher === true} />
          </div>
        </details>

        <details className="group rounded-2xl border border-line bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6 [&::-webkit-details-marker]:hidden">
            <span>
              <span className="block text-lg font-extrabold">פרטים</span>
              <span className="block text-sm text-muted">אימייל ושם תצוגה</span>
            </span>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-terracotta-tint text-terracotta transition-transform group-open:rotate-180" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
            </span>
          </summary>
          <div className="flex flex-col gap-4 border-t border-line p-6">
          <div>
            <div className="text-sm font-bold">אימייל</div>
            <div className="mt-1 text-ink-2" dir="ltr" style={{ textAlign: 'right' }}>{user.email}</div>
            <div className="mt-1 text-sm text-muted">{viaGoogle ? 'מחובר/ת דרך Google' : 'מחובר/ת עם אימייל וסיסמה'}</div>
          </div>
          <NameForm current={profile?.display_name ?? ''} />
          </div>
        </details>

        <div className="flex flex-col">
        {/* A problem or an idea, straight to the team (the admin page). The menu's link opens it (?feedback=1). */}
        <details id="feedback" className="group px-1" open={feedback === '1'} data-tour="feedback">
          <summary className="flex min-h-10 w-fit cursor-pointer list-none items-center gap-1.5 text-sm font-bold text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
            דיווח על בעיה או רעיון
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition-transform group-open:rotate-180"><path d="M6 9l6 6 6-6" /></svg>
          </summary>
          <div className="mb-2 mt-2 rounded-2xl border border-line bg-white p-4"><FeedbackForm /></div>
        </details>

        {/* Influencers and bloggers ask to publish routes here: a small line, so most travellers pass it by. */}
        {FEATURES.routes && <details className="group px-1">
          <summary className="flex min-h-10 w-fit cursor-pointer list-none items-center gap-1.5 text-sm font-bold text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
            רוצה לפרסם מסלולים?
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition-transform group-open:rotate-180"><path d="M6 9l6 6 6-6" /></svg>
          </summary>
          <div className="mt-2 flex flex-col gap-2 rounded-2xl border border-line bg-white p-4">
            <p className="text-sm text-ink-2">למשפיענים ובלוגרים של טיולים. אנחנו מאשרים כל אחד פעם אחת, ואחר כך מפרסמים בלי לחכות.</p>
            <InfluencerRequest status={influencerStatus} />
          </div>
        </details>}
        </div>

        <details className="group rounded-2xl border border-[#F4C7C3] bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6 [&::-webkit-details-marker]:hidden">
            <span>
              <span className="block text-lg font-extrabold">מחיקת חשבון</span>
              <span className="block text-sm text-muted">מחיקה לצמיתות של החשבון והטיולים</span>
            </span>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-terracotta-tint text-terracotta transition-transform group-open:rotate-180" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
            </span>
          </summary>
          <div className="flex flex-col gap-4 border-t border-[#F4C7C3] p-6">
            <p className="text-ink-2">
              מוחק את החשבון ואת כל הטיולים והמקומות ששמרת. אי אפשר לשחזר אחרי המחיקה.
            </p>
            <DeleteAccountForm />
          </div>
        </details>
      </main>
    </>
  );
}
