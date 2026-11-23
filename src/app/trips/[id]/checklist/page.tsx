import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { HERO_PHOTOS, PageHero } from '@/components/PageHero';
import { requireOnboardedUser } from '@/lib/auth/session';
import { canEditTrip, getTrip } from '@/lib/trips/queries';
import type { ChecklistItem } from '@/lib/trips/extras';
import { Checklist } from './Checklist';

export const metadata: Metadata = { title: 'רשימת הכנות · YallaTrip' };

/** What to take and what to do before the trip — shared with everyone planning it. */
export default async function ChecklistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await requireOnboardedUser(`/trips/${id}/checklist`);
  if (!(await canEditTrip(supabase, id))) notFound();
  const trip = await getTrip(supabase, id);
  if (!trip) notFound();
  const { data } = await supabase.from('trip_checklist_items').select('id, text, done, position')
    .eq('trip_id', trip.id).order('position').order('created_at');

  return (
    <>
      <AppHeader name={profile?.display_name ?? null} role={profile?.role} avatar={profile?.avatar_url ?? null} />
      <PageHero photo={HERO_PHOTOS.newTrip} width="max-w-[640px]" overlap back={{ href: `/trips/${trip.id}`, label: '→ חזרה לטיול' }}
        eyebrow={trip.title} title="רשימת הכנות" subtitle="מה לארוז ומה לסדר לפני הטיול. כל מי שמתכנן איתך רואה את אותה רשימה." />
      <main className="relative mx-auto -mt-12 flex max-w-[640px] flex-col gap-6 px-4 pb-16 sm:px-8">
        <Checklist tripId={trip.id} initial={(data ?? []) as ChecklistItem[]} />
      </main>
    </>
  );
}
