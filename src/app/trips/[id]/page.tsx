import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { Alert } from '@/components/ui';
import { TripTopBar } from '@/components/trips/TripTopBar';
import { TripWorkspace, type Tab } from '@/components/trip/TripWorkspace';
import { requireOnboardedUser } from '@/lib/auth/session';
import { canEditTrip, getTrip, getTripPeople } from '@/lib/trips/queries';
import { TripLiveSync } from '@/components/trip/TripLiveSync';
import { TripChat } from '@/components/trip/TripChat';
import { KeepOffline } from '@/components/pwa/Pwa';
import { getMapPlaces } from '@/lib/places/queries';
import { getTripPlan } from '@/lib/planning/queries';
import { isGooglePlaceId, isUuid } from '@/lib/validation';
import { getPlanAccess } from '@/lib/plans-access';
import { TripStoryButton } from '@/components/trip/TripStory';
import { PlanGate } from '@/components/PlanGate';
import { todayInIsrael } from '@/lib/trips/rules';
import { FEATURES } from '@/lib/features';

export const metadata: Metadata = { title: 'טיול · YallaTrip' };
// "Fill my days" looks up and saves many places at once.
export const maxDuration = 60;

type Search = Promise<{ tab?: string; created?: string; saved?: string; place?: string; day?: string; joined?: string; tour?: string; copied?: string }>;

export default async function TripPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Search }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, user, profile } = await requireOnboardedUser(`/trips/${id}`);
  // Only the owner and the people it is shared with open the planner (public trips open at /s/…).
  if (!(await canEditTrip(supabase, id))) notFound();
  const trip = await getTrip(supabase, id);
  if (!trip) notFound();
  const [places, days, hotelRow, people, prefsRow, plan, firstRow] = await Promise.all([
    getMapPlaces(supabase, trip.id),
    getTripPlan(supabase, trip.id),
    supabase.from('trips').select('hotel_saved_place_id, with_kids, keeps_shabbat, pace, auto_assign').eq('id', trip.id).maybeSingle(),
    getTripPeople(supabase, trip.id),
    supabase.from('user_preferences').select('keeps_kosher').eq('user_id', user.id).maybeSingle(),
    getPlanAccess(supabase, id),
    supabase.from('trips').select('id').eq('owner_id', user.id).eq('is_snapshot', false).order('created_at', { ascending: true }).limit(1).maybeSingle(),
  ]);
  // The traveller's own first trip ("תוכניות ומחירים" shows once, at its fifth saved place).
  const firstTrip = (firstRow.data as { id: string } | null)?.id === trip.id;
  // The trip is over: offer its story picture.
  const ended = !!trip.end_date && trip.end_date < todayInIsrael();
  const together = people.filter((x) => x.status === 'accepted');
  const hotelId = (hotelRow.data as unknown as { hotel_saved_place_id: string | null } | null)?.hotel_saved_place_id ?? null;
  const keepsShabbat = (hotelRow.data as unknown as { keeps_shabbat?: boolean } | null)?.keeps_shabbat === true;
  const withKids = (hotelRow.data as unknown as { with_kids?: boolean } | null)?.with_kids === true;
  const flags = hotelRow.data as unknown as { pace?: string | null; auto_assign?: boolean } | null;

  const tab: Tab = sp.tab === 'days' ? 'days' : 'map';
  const center = trip.center_lat !== null && trip.center_lng !== null ? { lat: trip.center_lat, lng: trip.center_lng } : null;

  return (
    <>
      <AppHeader name={profile?.display_name ?? null} role={profile?.role} avatar={profile?.avatar_url ?? null} />
      <TripTopBar trip={trip} people={together.length > 1 ? together : []} isAdmin={profile?.role === 'admin'} plan={plan} />
      <KeepOffline tripId={trip.id} title={trip.title} />
      {together.length > 1 && <TripLiveSync tripId={trip.id} />}
      {FEATURES.chat && together.length > 1 && <TripChat tripId={trip.id} meId={user.id} people={together} />}
      <TripWorkspace
        key={`${tab}|${sp.place ?? ''}|${sp.day ?? ''}`}
        tripId={trip.id}
        destinationName={trip.destination_name}
        center={center}
        transportModes={trip.transport_modes}
        initialPlaces={places}
        initialDays={days}
        hotelId={hotelId}
        tab={tab}
        initialSelected={isGooglePlaceId(sp.place) ? sp.place : null}
        initialDayId={isUuid(sp.day) ? sp.day : null}
        apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ?? ''}
        mapId={process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || 'DEMO_MAP_ID'}
        aiAvailable={Boolean(process.env.ANTHROPIC_API_KEY)}
        travelStyles={trip.travel_styles}
        withKids={withKids}
        keepsShabbat={keepsShabbat}
        plan={plan}
        firstTrip={firstTrip}
        keepsKosher={(prefsRow.data as { keeps_kosher?: boolean } | null)?.keeps_kosher === true}
        pace={flags?.pace ?? null}
        autoAssign={flags?.auto_assign !== false}
        legs={trip.destinations}
        partners={together.filter((x) => x.id !== user.id).map((x) => ({ id: x.id, name: x.name }))}
        shared={together.length > 1}
        replayTour={sp.tour === '1' && profile?.role === 'admin'}
        toursSeen={profile?.tours_seen ?? []}
        notices={
          <>
            {sp.created && (
              <Alert kind="success">
                הטיול נוצר!{trip.days.length ? ` ${trip.days.length} ימים מחכים לך.` : ''} חפשו מקום במפה או לחצו על מקום כדי לשמור אותו.
              </Alert>
            )}
            {sp.saved && <Alert kind="success">השינויים נשמרו.</Alert>}
            {sp.copied && <Alert kind="success">זה העותק החדש שלך. אפשר לשנות בו הכול, והטיול המקורי נשאר כמו שהיה.</Alert>}
            {sp.joined && <Alert kind="success">הצטרפת לטיול! מעכשיו אתם מתכננים יחד, וכל שינוי מופיע אצל שניכם.</Alert>}
            {FEATURES.tripStory && ended && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4">
                <p className="font-bold">הטיול נגמר. איך היה? 😊</p>
                <PlanGate access={plan}>
                  <TripStoryButton tripId={trip.id}
                    className="min-h-11 rounded-full bg-gradient-to-l from-[#1B73C9] to-[#2E9BDB] px-5 font-bold text-white">📸 סיכום הטיול לשיתוף</TripStoryButton>
                </PlanGate>
              </div>
            )}
          </>
        }
      />
    </>
  );
}
