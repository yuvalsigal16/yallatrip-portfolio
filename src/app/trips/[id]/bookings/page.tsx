import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { HERO_PHOTOS, PageHero } from '@/components/PageHero';
import { requireOnboardedUser } from '@/lib/auth/session';
import { canEditTrip, getTrip } from '@/lib/trips/queries';
import { BOOKING_COLUMNS, DOC_BUCKET, sortBookings, type Booking } from '@/lib/trips/bookings';
import { Bookings } from './Bookings';

export const metadata: Metadata = { title: 'הזמנות ומסמכים · YallaTrip' };

/** Flights, hotel, car, tickets: confirmation numbers, times and the files themselves, in one place. */
export default async function BookingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await requireOnboardedUser(`/trips/${id}/bookings`);
  if (!(await canEditTrip(supabase, id))) notFound();
  const trip = await getTrip(supabase, id);
  if (!trip) notFound();
  const { data } = await supabase.from('trip_bookings').select(BOOKING_COLUMNS).eq('trip_id', trip.id);
  const rows = sortBookings(((data ?? []) as unknown as Booking[]).map((b) => ({ ...b, start_time: b.start_time ? b.start_time.slice(0, 5) : null })));
  // The files bucket is private: each file opens through a signed link that works for an hour.
  const paths = rows.map((r) => r.file_path).filter((p): p is string => !!p);
  const signed = paths.length ? (await supabase.storage.from(DOC_BUCKET).createSignedUrls(paths, 3600)).data ?? [] : [];
  const links: Record<string, string> = {};
  for (const s of signed) if (s.path && s.signedUrl) links[s.path] = s.signedUrl;

  return (
    <>
      <AppHeader name={profile?.display_name ?? null} role={profile?.role} avatar={profile?.avatar_url ?? null} />
      <PageHero photo={HERO_PHOTOS.newTrip} width="max-w-[640px]" overlap back={{ href: `/trips/${trip.id}`, label: '→ חזרה לטיול' }}
        eyebrow={trip.title} title="הזמנות ומסמכים" subtitle="טיסות, לינה, רכב וכרטיסים: מספר האישור, השעה והקובץ, במקום אחד. מופיעים גם בתוכנית, ביום הנכון." />
      <main className="relative mx-auto -mt-12 flex max-w-[640px] flex-col gap-6 px-4 pb-16 sm:px-8">
        <Bookings tripId={trip.id} initial={rows} links={links} defaultDate={trip.start_date ?? ''} />
      </main>
    </>
  );
}
