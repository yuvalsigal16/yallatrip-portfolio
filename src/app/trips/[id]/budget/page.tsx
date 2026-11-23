import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { HERO_PHOTOS, PageHero } from '@/components/PageHero';
import { requireOnboardedUser } from '@/lib/auth/session';
import { canEditTrip, getTrip, getTripPeople } from '@/lib/trips/queries';
import type { Expense } from '@/lib/trips/extras';
import { Budget } from './Budget';

export const metadata: Metadata = { title: 'תקציב והוצאות · YallaTrip' };

/** The trip's budget and expenses, in any currency, with who-owes-whom for a shared trip. */
export default async function BudgetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, profile } = await requireOnboardedUser(`/trips/${id}/budget`);
  if (!(await canEditTrip(supabase, id))) notFound();
  const trip = await getTrip(supabase, id);
  if (!trip) notFound();
  const [{ data: budget }, { data: rows }, people] = await Promise.all([
    supabase.from('trip_budgets').select('home_currency, total').eq('trip_id', trip.id).maybeSingle(),
    supabase.from('trip_expenses').select('id, title, category, amount, currency, rate, home_amount, paid_by, shared, spent_on')
      .eq('trip_id', trip.id).order('spent_on', { ascending: false }).order('created_at', { ascending: false }),
    getTripPeople(supabase, trip.id),
  ]);
  const expenses: Expense[] = ((rows ?? []) as Record<string, unknown>[]).map((r) => ({
    ...(r as unknown as Expense), amount: Number(r.amount), rate: Number(r.rate), home_amount: Number(r.home_amount),
  }));
  const together = people.filter((p) => p.status === 'accepted').map((p) => ({ id: p.id, name: p.name ?? 'בלי שם' }));
  const b = budget as { home_currency: string; total: number | string | null } | null;

  return (
    <>
      <AppHeader name={profile?.display_name ?? null} role={profile?.role} avatar={profile?.avatar_url ?? null} />
      <PageHero photo={HERO_PHOTOS.creator} width="max-w-[720px]" overlap back={{ href: `/trips/${trip.id}`, label: '→ חזרה לטיול' }}
        eyebrow={trip.title} title="תקציב והוצאות" subtitle="רושמים כל הוצאה במטבע שבו שילמתם, ורואים כמה הוצאתם וכמה נשאר." />
      <main className="relative mx-auto -mt-12 flex max-w-[720px] flex-col gap-6 px-4 pb-16 sm:px-8">
        <Budget
          tripId={trip.id}
          meId={user.id}
          people={together.length ? together : [{ id: user.id, name: profile?.display_name ?? 'אני' }]}
          homeCurrency={b?.home_currency ?? 'ILS'}
          total={b?.total != null ? Number(b.total) : null}
          initial={expenses}
          startDate={trip.start_date}
          endDate={trip.end_date}
        />
      </main>
    </>
  );
}
