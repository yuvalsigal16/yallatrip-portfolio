import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/ui';
import { requirePageUser } from '@/lib/auth/session';
import { safeNextPath } from '@/lib/auth/rules';
import { OnboardingForm } from './OnboardingForm';
import { AvatarPicker } from '@/components/AvatarPicker';

export const metadata: Metadata = { title: 'כמה שאלות קצרות · YallaTrip' };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const next = safeNextPath(sp.next);
  const { supabase, user } = await requirePageUser('/onboarding');

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, onboarding_completed_at, terms_accepted_at, avatar_url')
    .eq('id', user.id)
    .maybeSingle();
  if (profile && !profile.terms_accepted_at) redirect(`/accept-terms?next=${encodeURIComponent(next)}`);
  if (profile?.onboarding_completed_at) redirect(next);

  const firstName = (profile?.display_name as string | null)?.split(' ')[0];

  return (
    <div className="app-skin mx-auto flex min-h-screen max-w-[640px] flex-col px-5 py-6 sm:px-8">
      <Logo />
      <div className="py-10">
        <p className="text-sm font-extrabold text-terracotta">ברוכים הבאים ל-YallaTrip</p>
        <h1 className="mt-1 bg-gradient-to-l from-[#0C2D4A] via-[#1B73C9] to-[#35A7E0] bg-clip-text pb-1 font-display text-4xl font-black text-transparent sm:text-5xl">
          {firstName ? `נעים להכיר, ${firstName}` : 'נעים להכיר'}
        </h1>
        <p className="mt-3 text-lg text-ink-2">
          כמה שאלות קצרות, כדי שההמלצות יתאימו לך. אפשר לשנות הכול אחר כך, ואפשר גם לדלג.
        </p>
        <section className="mt-8 flex flex-col gap-3 rounded-2xl border border-line bg-white p-5" aria-labelledby="photo-title">
          <h2 id="photo-title" className="text-lg font-extrabold">תמונת פרופיל <span className="text-sm font-semibold text-muted">(לא חובה)</span></h2>
          <AvatarPicker userId={user.id} url={(profile?.avatar_url as string | null) ?? null}
            name={(profile?.display_name as string | null) ?? null} size={88} />
        </section>
        <OnboardingForm next={next} />
      </div>
    </div>
  );
}
