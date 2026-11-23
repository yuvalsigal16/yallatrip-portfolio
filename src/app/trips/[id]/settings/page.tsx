import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { requireOnboardedUser } from '@/lib/auth/session';
import { canEditTrip, getTrip, getTripPeople } from '@/lib/trips/queries';
import { PeopleSection } from './PeopleSection';
import { DeleteTripForm, DuplicateTripForm, LeaveTripForm, TripSettingsForm } from './SettingsForms';
import { ShareSection } from './ShareSection';
import { siteUrl } from '@/lib/site';
import { HERO_PHOTOS, PageHero } from '@/components/PageHero';
import { FEATURES } from '@/lib/features';

export const metadata: Metadata = { title: 'הגדרות טיול · YallaTrip' };

export default async function TripSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, profile } = await requireOnboardedUser(`/trips/${id}/settings`);
  if (!(await canEditTrip(supabase, id))) notFound();
  const trip = await getTrip(supabase, id);
  if (!trip) notFound();
  const people = await getTripPeople(supabase, trip.id);
  const isOwner = people.find((p) => p.is_owner)?.id === user.id;
  const shared = people.length > 1;
  const [{ data: share }, { data: prefs }] = await Promise.all([
    supabase.from('trips').select('share_token, keeps_shabbat').eq('id', trip.id).maybeSingle(),
    supabase.from('user_preferences').select('keeps_kosher').eq('user_id', user.id).maybeSingle(),
  ]);
  const site = await siteUrl();

  return (
    <>
      <AppHeader name={profile?.display_name ?? null} role={profile?.role} avatar={profile?.avatar_url ?? null} />
      <PageHero photo={HERO_PHOTOS.settings} width="max-w-[640px]" overlap back={{ href: `/trips/${trip.id}`, label: '→ חזרה לטיול' }} eyebrow={trip.title} title="הגדרות טיול" />
      <main className="relative mx-auto -mt-12 flex max-w-[640px] flex-col gap-8 px-5 pb-16 sm:px-8">

        <TripSettingsForm
          tripId={trip.id}
          defaults={{
            title: trip.title,
            destinationName: trip.destination_name,
            placeId: trip.destination_place_id ?? '',
            startDate: trip.start_date ?? '',
            endDate: trip.end_date ?? '',
            noDates: !trip.start_date,
            travelers: trip.travelers_count,
            transport: trip.transport_modes,
            styles: trip.travel_styles,
            shabbat: (share as { keeps_shabbat?: boolean } | null)?.keeps_shabbat === true,
            kosher: (prefs as { keeps_kosher?: boolean } | null)?.keeps_kosher === true,
            legs: trip.destinations,
          }}
        />

        <PeopleSection tripId={trip.id} people={people} isOwner={isOwner} meId={user.id} />

        {isOwner && !shared && (
          <ShareSection tripId={trip.id} initial={trip.visibility}
            initialToken={(share as { share_token: string | null } | null)?.share_token ?? null} siteUrl={site} />
        )}

        <section className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-6" aria-labelledby="dup-title">
          <h2 id="dup-title" className="text-lg font-extrabold">שכפול הטיול</h2>
          <p className="text-ink-2">טיול חדש שלך עם אותם מקומות, ימים, עצירות והערות. {shared ? 'השותפים, ' : ''}{FEATURES.chat ? 'הצ\'אט, ' : ''}האלבום והחוות דעת נשארים בטיול הזה.</p>
          <DuplicateTripForm tripId={trip.id} title={trip.title} hasDates={Boolean(trip.start_date)} />
        </section>

        {isOwner ? (
          <section className="flex flex-col gap-4 rounded-3xl border border-[#F4C7C3] bg-white p-6 shadow-[0_14px_34px_-18px_rgba(194,72,31,.35)]">
            <h2 className="text-lg font-extrabold">מחיקת הטיול</h2>
            <p className="text-ink-2">מוחק את הטיול, את הימים ואת כל המקומות שנשמרו בו{shared ? ', גם אצל מי שמתכנן איתך' : ''}. אי אפשר לשחזר.</p>
            <DeleteTripForm tripId={trip.id} />
          </section>
        ) : (
          <section className="flex flex-col gap-4 rounded-3xl border border-[#F4C7C3] bg-white p-6">
            <h2 className="text-lg font-extrabold">יציאה מהטיול המשותף</h2>
            <p className="text-ink-2">הטיול יישאר אצל מי שיצר/ה אותו, ואצלך הוא ייעלם מהרשימה.</p>
            <LeaveTripForm tripId={trip.id} />
          </section>
        )}
      </main>
    </>
  );
}
