import type { Metadata } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { PublicHeader } from '@/components/PublicHeader';
import { HERO_PHOTOS, PageHero } from '@/components/PageHero';
import { buttonBase, buttonStyles } from '@/components/ui';
import { getSessionUser } from '@/lib/auth/session';
import { safeNextPath } from '@/lib/auth/rules';
import { FREE_FEATURES, PAID_EXTRAS, PRICES, TRIP_SHORT_MAX_DAYS, showsCreatorPrices } from '@/lib/plans';

export const metadata: Metadata = { title: 'תוכניות ומחירים · YallaTrip' };

const delay = (s: number) => ({ animationDelay: `${s}s` }) as CSSProperties;

function Tick({ at, paid = false }: { at: number; paid?: boolean }) {
  return (
    <span className={`gt-tick mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white ${paid ? 'bg-[#F2A93B]' : 'bg-[#1B73C9]'}`}
      style={delay(at)} aria-hidden="true">✓</span>
  );
}

function List({ items, start, paid = false }: { items: readonly string[]; start: number; paid?: boolean }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((t, i) => (
        <li key={t} className="flex gap-2 text-[15px] leading-snug"><Tick at={start + i * 0.06} paid={paid} />{t}</li>
      ))}
    </ul>
  );
}

function Price({ regular, creator, isCreator, unit }: { regular: number; creator: number; isCreator: boolean; unit: string }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-2">
      <span className="font-display text-3xl font-black">₪{isCreator ? creator : regular}</span>
      {isCreator && <s className="text-base font-bold text-muted">₪{regular}</s>}
      <span className="text-sm text-ink-2">{unit}</span>
    </p>
  );
}

function Plan({ at, title, tag, children, highlight = false }: { at: number; title: string; tag: ReactNode; children: ReactNode; highlight?: boolean }) {
  return (
    <section style={delay(at)}
      className={`gt-plan flex flex-col gap-4 rounded-3xl border bg-white p-5 sm:p-6 ${highlight ? 'border-[#1B73C9] shadow-[0_18px_40px_-20px_rgba(27,115,201,.55)] ring-2 ring-[#1B73C9]/15' : 'border-line'}`}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xl font-black">{title}</h2>
        {tag}
      </div>
      {children}
    </section>
  );
}

const soon = <span className="shrink-0 rounded-full bg-[#FFF4E0] px-2.5 py-1 text-xs font-extrabold text-[#8A5A00]">בקרוב</span>;

/**
 * "תוכניות ומחירים": shown once when the first trip reaches 5 saved places, and any time from the menu.
 * Display only: card payments are off, there is no payment button, and nothing is limited.
 */
export default async function PlansPage({ searchParams }: { searchParams: Promise<{ next?: string; view?: string }> }) {
  const sp = await searchParams;
  const next = safeNextPath(sp.next, '/trips');
  const { supabase, user } = await getSessionUser();
  const { data: me } = user
    ? await supabase.from('profiles').select('display_name, role, avatar_url').eq('id', user.id).maybeSingle()
    : { data: null };
  const profile = me as { display_name: string | null; role: 'user' | 'creator' | 'admin'; avatar_url: string | null } | null;
  // Creator prices only for approved creators. The admin chooses which version to see ("תצוגה כמו").
  const isAdmin = profile?.role === 'admin';
  const isCreator = showsCreatorPrices(profile?.role, sp.view);
  const viewLink = (v: 'user' | 'creator') => `/plans?${new URLSearchParams({ next, view: v })}`;

  return (
    <>
      {user ? <AppHeader name={profile?.display_name ?? null} role={profile?.role} avatar={profile?.avatar_url ?? null} /> : <PublicHeader signedIn={false} />}
      <PageHero photo={HERO_PHOTOS.mountains} width="max-w-[1080px]" overlap title="תוכניות ומחירים"
        subtitle="כל מה שיש היום ב-YallaTrip חינמי, ונשאר חינמי. בקרוב יהיו גם תוספות בתשלום, למי שרוצה." />
      <main className="relative mx-auto -mt-12 flex max-w-[1080px] flex-col gap-6 px-5 pb-16 sm:px-8">
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2 self-start rounded-2xl border border-line bg-white p-2" role="group" aria-label="תצוגה כמו (רק את רואה את זה)">
            <span className="px-2 text-sm font-bold text-ink-2">תצוגה כמו:</span>
            {(['user', 'creator'] as const).map((v) => (
              <a key={v} href={viewLink(v)} aria-current={(v === 'creator') === isCreator ? 'true' : undefined}
                className={`flex min-h-10 items-center rounded-full px-4 text-sm font-bold no-underline ${(v === 'creator') === isCreator ? 'bg-ink text-white' : 'text-ink'}`}>
                {v === 'user' ? 'משתמש רגיל' : 'יוצר תוכן'}
              </a>
            ))}
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-3">
          <Plan at={0} title="חינם" highlight tag={<span className="shrink-0 rounded-full bg-[#EAF4FC] px-2.5 py-1 text-xs font-extrabold text-[#1B73C9]">עכשיו</span>}>
            <p className="flex items-baseline gap-2"><span className="font-display text-3xl font-black">₪0</span><span className="text-sm text-ink-2">לתמיד</span></p>
            <List items={FREE_FEATURES} start={0.35} />
          </Plan>

          <Plan at={0.12} title="כרטיס טיול" tag={soon}>
            <div className="flex flex-col gap-1">
              <Price {...PRICES.tripShort} isCreator={isCreator} unit={`לטיול עד ${TRIP_SHORT_MAX_DAYS} ימים`} />
              <Price {...PRICES.tripLong} isCreator={isCreator} unit={`לטיול של ${TRIP_SHORT_MAX_DAYS + 1} ימים ומעלה`} />
            </div>
            <p className="text-sm text-ink-2">משלמים פעם אחת, והכול פתוח עד סוף הטיול.</p>
            <p className="text-sm font-extrabold">כל מה שבחינם, ועוד:</p>
            <List items={PAID_EXTRAS} start={0.55} paid />
          </Plan>

          <Plan at={0.24} title="מנוי שנתי" tag={soon}>
            <Price {...PRICES.year} isCreator={isCreator} unit="לשנה, לכל הטיולים" />
            <p className="text-sm text-ink-2">למי שמטייל/ת הרבה.</p>
            <p className="text-sm font-extrabold">כל מה שבחינם, ועוד:</p>
            <List items={PAID_EXTRAS} start={0.75} paid />
          </Plan>
        </div>

        {isCreator && <p className="text-center text-sm font-bold text-[#1B73C9]">מחירים מוזלים ליוצרי תוכן מאושרים.</p>}

        <div className="flex flex-col items-center gap-2">
          <a href={next} data-tour="plans-free" className={`${buttonBase} ${buttonStyles.primary} min-h-14 w-full max-w-sm text-lg no-underline`}>להמשיך בחינם</a>
          <p className="text-center text-sm text-muted">אין כאן תשלום. כשהתוספות ייפתחו, נספר.</p>
        </div>
      </main>
    </>
  );
}
