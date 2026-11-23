import type { Metadata } from 'next';
import { safeNextPath } from '@/lib/auth/rules';
import { SignupChoices } from './SignupChoices';
import { FEATURES } from '@/lib/features';

export const metadata: Metadata = { title: 'הרשמה · YallaTrip' };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const next = safeNextPath(sp.next);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-4xl font-bold">מתחילים לתכנן</h1>
        <p className="mt-2 text-ink-2">חשבון חינמי. הטיולים נשמרים אצלך ואפשר לחזור אליהם מכל מכשיר.</p>
      </div>
      {FEATURES.routes && next === '/creator' && (
        <p className="rounded-xl bg-[#EAF4FC] px-4 py-3 text-[15px] font-semibold text-ink">
          נרשמים כיוצר/ת תוכן: אחרי ההרשמה מגיעים ישר לטופס הבקשה, ואנחנו מאשרים אותה.
        </p>
      )}
      <SignupChoices next={next} />
      {/* Creators and influencers: a clear way in, instead of a box to tick while signing up. */}
      {FEATURES.routes && next !== '/creator' && (
        <a href="/signup?next=%2Fcreator"
          className="flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-gradient-to-l from-[#1B73C9] to-[#2E9BDB] px-5 py-4 text-white no-underline shadow-[0_10px_24px_-12px_rgba(27,115,201,.8)] transition hover:brightness-110">
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-white/85">יוצר/ת תוכן או משפיען/ית?</span>
            <span className="block text-lg font-extrabold">הרשמה כיוצר/ת תוכן ←</span>
          </span>
          <span className="shrink-0 text-2xl" aria-hidden="true">🎥</span>
        </a>
      )}
      <p className="text-center text-ink-2">
        כבר יש לך חשבון? <a href="/login" className="font-bold">להתחברות</a>
      </p>
    </div>
  );
}
