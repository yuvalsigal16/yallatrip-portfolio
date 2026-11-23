import { Alert, Logo } from '@/components/ui';
import { getSessionUser } from '@/lib/auth/session';
import { Footer } from '@/components/Footer';
import { storeIsOpen } from '@/lib/market/open';

// The example day on the card: fixed in the code, not anyone's data, and nothing asked of Google.
const DAY = [
  { name: 'פסל ישו הגואל', kind: 'אטרקציה · 9:30' },
  { name: 'חוף קופקבנה', kind: 'חוף' },
  { name: 'הר הסוכר', kind: 'תצפית בשקיעה' },
];
const LEGS: { mode: 'drive' | 'walk'; text: string }[] = [{ mode: 'drive', text: '25 דק׳ נסיעה' }, { mode: 'walk', text: '15 דק׳ הליכה' }];
const PERKS = ['שבת וכשרות', 'ויזה לדרכון ישראלי', 'הכל בשקלים'];

const Icon = ({ d, className = '' }: { d: string; className?: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true"><path d={d} /></svg>
);
const CAR = 'M5 17h14M6 17l1.5-6h9L18 17M7 17v2M17 17v2M8.5 14h.01M15.5 14h.01';
const WALK = 'M13 4a1.5 1.5 0 1 0 0-.01M10 21l2-6 3 3v3M9 12l2-3 3 1 2 3M11 9l-1 4';
const CHECK = 'M5 12.5l4.5 4.5L19 7.5';
const PIN = 'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5';

/** A small map of the day: three stops joined by the route. A drawing, not a real map. */
function MiniMap() {
  return (
    <svg viewBox="0 0 320 84" className="block h-[60px] w-full sm:h-[96px]" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="320" height="84" fill="#EAF2F9" />
      <path d="M0 62 C 60 50, 90 84, 150 70 S 260 40, 320 52 L320 84 L0 84Z" fill="#D3E6F5" />
      <path d="M0 20 L320 34 M70 0 L95 84 M210 0 L190 84 M0 46 L320 18" stroke="#fff" strokeWidth="5" />
      <path d="M262 26 C 220 30, 200 58, 160 50 S 90 38, 58 58" stroke="#0B3D6E" strokeWidth="3" strokeDasharray="1 7" strokeLinecap="round" fill="none" />
      {[[262, 26], [160, 50], [58, 58]].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="10" fill="#0B3D6E" stroke="#fff" strokeWidth="2.5" />
          <text x={x} y={y! + 4} textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff" fontFamily="inherit">{i + 1}</text>
        </g>
      ))}
    </svg>
  );
}

/** What a day in a trip looks like, as on the "by days" screen. */
function DayCard() {
  return (
    <div className="relative w-full">
      {/* The next day, peeking out behind: a trip is many days */}
      <div className="absolute inset-x-6 -top-2.5 h-10 rounded-3xl bg-white/15 ring-1 ring-white/10" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-3xl bg-white text-right text-ink shadow-[0_30px_80px_-24px_rgba(0,0,0,.65)] ring-1 ring-black/5" aria-label="דוגמה: יום בטיול לריו דה ז׳ניירו">
        <MiniMap />
        <div className="p-3.5 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[17px] font-black tracking-tight sm:text-lg">יום 1 · ריו דה ז׳ניירו</p>
            <div className="flex shrink-0 gap-1" aria-hidden="true">
              {['1', '2', '3'].map((d, i) => (
                <span key={d} className={`flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-extrabold ${i === 0 ? 'bg-[#0B3D6E] text-white' : 'bg-sand-2 text-ink-2'}`}>{d}</span>
              ))}
            </div>
          </div>
          <ol className="mt-2.5">
            {DAY.map((s, i) => (
              <li key={s.name} className="relative">
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0B3D6E] text-[11px] font-extrabold text-white">{i + 1}</span>
                  <span className="min-w-0 leading-tight">
                    <span className="block text-[15px] font-extrabold">{s.name}</span>
                    <span className="block text-xs text-ink-2">{s.kind}</span>
                  </span>
                </div>
                {LEGS[i] && (
                  <div className="flex items-center gap-3 py-0.5">
                    <span className="flex w-6 justify-center" aria-hidden="true"><span className="h-4 border-r-2 border-dotted border-[#A9C3D8]" /></span>
                    <span className="flex items-center gap-1 text-xs font-semibold text-muted">
                      <Icon d={LEGS[i].mode === 'drive' ? CAR : WALK} /> {LEGS[i].text}
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ol>
          <p className="mt-2.5 flex items-center gap-2 rounded-xl bg-[#FFF6DC] px-3 py-2 text-[13px] font-bold text-[#6B4E00]">
            <Icon d={PIN} className="shrink-0 text-[#D49A00]" /> ליד המלון: מסעדה כשרה ובית חב״ד
          </p>
        </div>
      </div>
    </div>
  );
}

// Public landing page: what YallaTrip is, and what a day of a trip looks like, all on a phone's first screen.
export default async function Home({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const sp = await searchParams;
  const [{ user }, store] = await Promise.all([getSessionUser(), storeIsOpen()]);

  return (
    <div className="flex min-h-screen flex-col bg-sand">
      <div className="relative isolate flex flex-1 flex-col overflow-hidden bg-[#071F3A] text-white">
        {/* Deep blue with soft light and a fine grid behind */}
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_80%_0%,rgba(46,155,219,.45),transparent),radial-gradient(50%_40%_at_10%_70%,rgba(27,115,201,.35),transparent),linear-gradient(180deg,#0B3D6E,#061A31)]" aria-hidden="true" />
        <div className="absolute inset-0 -z-10 opacity-[.07] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:28px_28px] [mask-image:radial-gradient(ellipse_at_top,#000_30%,transparent_75%)]" aria-hidden="true" />

        <header className="mx-auto flex h-14 w-full max-w-[1120px] items-center justify-between px-4 sm:h-[72px] sm:px-8">
          <Logo light />
          <a href={user ? '/trips' : '/login'} className="inline-flex min-h-10 items-center rounded-full px-3 text-sm font-bold text-white/85 no-underline transition hover:bg-white/10 hover:text-white">
            {user ? 'הטיולים שלי' : 'התחברות'}
          </a>
        </header>

        <main className="mx-auto grid w-full max-w-[1120px] items-center lg:my-auto gap-4 px-5 pb-8 pt-1 sm:pb-14 lg:grid-cols-[1fr_420px] lg:gap-14 lg:px-8 lg:pb-20 lg:pt-10">
          <div className="flex flex-col items-center gap-3 text-center lg:items-start lg:gap-5 lg:text-right">
            {sp.deleted && <Alert kind="info">החשבון נמחק. תודה שטיילת איתנו</Alert>}
            <h1 className="font-display text-[34px] font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-[56px]">
              מתכננים טיול בעברית
              <span className="block bg-gradient-to-l from-[#FFD166] to-[#FFB547] bg-clip-text text-transparent">אפילו של חצי שנה</span>
            </h1>
            <p className="max-w-[460px] text-balance text-base leading-snug text-white/75 sm:text-lg lg:text-xl">
              נועצים מקומות על המפה, <span className="whitespace-nowrap">ו-YallaTrip</span> מסדר אותם ליום אחרי יום
            </p>
            <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs font-semibold min-[390px]:text-[13px] text-white/85 lg:justify-start lg:text-[15px]" aria-label="מה מיוחד ב-YallaTrip">
              {PERKS.map((t) => (
                <li key={t} className="flex items-center gap-1"><Icon d={CHECK} className="text-[#FFD166]" />{t}</li>
              ))}
            </ul>
            {/* On a computer the button sits with the text; on a phone it comes after the card. */}
            <div className="hidden lg:mt-3 lg:flex lg:flex-col lg:items-start lg:gap-2.5"><Cta user={!!user} store={store} /></div>
          </div>

          <div className="mx-auto mt-2 w-full max-w-[440px] lg:mt-0">
            <DayCard />
          </div>

          <div className="flex flex-col items-center gap-2 lg:hidden"><Cta user={!!user} store={store} /></div>
        </main>
      </div>

      <Footer flush />
    </div>
  );
}

/** The one main button, and the line under it. */
function Cta({ user, store }: { user: boolean; store: boolean }) {
  return (
    <>
      <a href={user ? '/trips' : '/signup'}
        className="group inline-flex min-h-14 w-full max-w-[400px] items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-l from-[#1B73C9] to-[#38A8E8] px-8 text-lg font-extrabold text-white no-underline shadow-[0_0_0_1px_rgba(255,255,255,.18)_inset,0_18px_40px_-12px_rgba(56,168,232,.75)] transition hover:brightness-110 lg:w-auto">
        {user ? 'לטיולים שלי' : 'מתחילים לתכנן, בחינם'}
        <span aria-hidden="true" className="transition-transform group-hover:-translate-x-1">←</span>
      </a>
      <p className="text-[13px] font-semibold text-white/65">בלי להוריד אפליקציה · נפתח ישר בטלפון</p>
      {store && <a href="/routes" className="text-sm font-bold text-white/85">או לדפדף במסלולים מוכנים ←</a>}
    </>
  );
}
