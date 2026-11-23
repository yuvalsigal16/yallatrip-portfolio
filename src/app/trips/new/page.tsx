import type { Metadata } from 'next';
import { AppHeader } from '@/components/AppHeader';
import { requireOnboardedUser } from '@/lib/auth/session';
import { getPreferences } from '@/lib/trips/queries';
import { QuickTripForm } from './QuickTripForm';
import { HERO_PHOTOS, PageHero } from '@/components/PageHero';
import { CoachTour } from '@/components/tour/CoachTour';

export const metadata: Metadata = { title: 'טיול חדש · YallaTrip' };

// /trips/new?q=רומא  (q comes from the "where to?" box on the home page)
export default async function NewTripPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const { supabase, user, profile } = await requireOnboardedUser('/trips/new');
  const prefs = await getPreferences(supabase, user.id);

  return (
    <>
      <AppHeader name={profile?.display_name ?? null} role={profile?.role} avatar={profile?.avatar_url ?? null} />
      <PageHero photo={HERO_PHOTOS.newTrip} width="max-w-[640px]" overlap back={{ href: '/trips', label: '→ הטיולים שלי' }} title="טיול חדש"
        subtitle="מסך אחד, ואת השאר ממלאים בקצב שלך." />
      <main className="relative mx-auto -mt-12 max-w-[640px] px-5 pb-16 sm:px-8">
        <div className="rounded-3xl border border-line bg-white p-5 sm:p-8">
        <QuickTripForm
          defaults={{
            destinationName: typeof sp.q === 'string' ? sp.q.slice(0, 200) : '',
            transport: prefs?.default_transport ?? ['walk', 'transit'],
            styles: prefs?.travel_styles ?? [],
            shabbat: prefs?.keeps_shabbat === true,
            kosher: prefs?.keeps_kosher === true,
          }}
        />
        </div>
      </main>
      {!profile?.tours_seen?.includes('new') && <CoachTour kind="new" />}
    </>
  );
}
