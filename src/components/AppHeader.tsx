import { Logo } from '@/components/ui';
import { signOut } from '@/app/(auth)/actions';
import { Avatar } from './Avatar';
import { NavLink } from './NavLink';
import { storeIsOpen } from '@/lib/market/open';
import { creatorRequest } from '@/lib/auth/session';
import { FEATURES } from '@/lib/features';
import { InstallMenuItem } from '@/components/pwa/Install';

type Role = 'user' | 'creator' | 'admin';
const menuItem = 'flex min-h-11 items-center px-4 font-bold text-ink no-underline transition hover:bg-sand-2';
const smallItem = 'flex min-h-11 items-center px-4 text-sm font-bold text-ink-2 no-underline transition hover:bg-sand-2';

// Top bar for signed-in pages: frosted glass that stays on top while scrolling.
export async function AppHeader({ name, role = 'user', avatar = null }: { name: string | null; role?: Role; avatar?: string | null }) {
  // "מסלולים" waits until the store has a few routes.
  const creators = FEATURES.routes;
  const [store, request] = await Promise.all([storeIsOpen(), creators && role === 'user' ? creatorRequest() : Promise.resolve('none' as const)]);
  return (
    <header className="app-skin sticky top-0 z-40 border-b border-white/70 bg-white/80 shadow-[0_10px_30px_-22px_rgba(12,45,74,.45)] backdrop-blur-xl">
      <div className="mx-auto flex h-[60px] max-w-[1280px] items-center justify-between gap-3 px-3 sm:h-[72px] sm:px-10">
        <Logo />
        <nav aria-label="ראשי" className="flex items-center gap-1 text-[15px] font-bold sm:gap-1.5">
          <NavLink href="/trips" tour="nav-trips">הטיולים שלי</NavLink>
          {store && <NavLink href="/routes" className="hidden md:inline" tour="nav-routes">מסלולים</NavLink>}
          {creators && role !== 'user' && <NavLink href="/creator" className="hidden md:inline">אזור יוצרים</NavLink>}
          {role === 'admin' && <NavLink href="/admin" className="hidden md:inline">ניהול</NavLink>}
          <form action={signOut} className="hidden md:block">
            <button type="submit" className="min-h-11 cursor-pointer rounded-full px-3.5 text-ink-2 transition hover:bg-sand-2 hover:text-ink">יציאה</button>
          </form>
          {/* The menu: on phones also the links that don't fit the bar, so admins and creators reach their areas too. */}
          <details className="group relative" data-tour="nav-menu">
            <summary aria-label="תפריט" className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-full text-ink-2 transition hover:bg-sand-2 [&::-webkit-details-marker]:hidden">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </summary>
            <div className="absolute end-0 top-full z-50 mt-2 flex min-w-[190px] flex-col overflow-hidden rounded-2xl border border-line bg-white py-1.5 text-[15px] shadow-[0_18px_40px_-16px_rgba(12,45,74,.45)]">
              {store && <a href="/routes" className={`${menuItem} md:hidden`}>מסלולים</a>}
              {creators && role !== 'user' && <a href="/creator" className={`${menuItem} md:hidden`}>אזור יוצרים</a>}
              {role === 'admin' && <a href="/admin" className={`${menuItem} md:hidden`}>ניהול</a>}
              {FEATURES.plans && <a href="/plans" className={menuItem}>תוכניות ומחירים</a>}
              {creators && role === 'user' && (request === 'pending'
                ? <a href="/creator" className={smallItem}>בקשת יוצר/ת: ממתינה לאישור</a>
                : <a href="/creator" className={smallItem} data-tour="nav-creator">הרשמה כיוצר/ת תוכן</a>)}
              {/* Phones only, and not when the site is already open from the home screen. */}
              <InstallMenuItem className={smallItem} />
              <a href="/profile?feedback=1#feedback" className={smallItem}>דיווח על בעיה או רעיון</a>
              <form action={signOut} className="border-t border-line md:hidden">
                <button type="submit" className={`${menuItem} w-full cursor-pointer text-start`}>יציאה</button>
              </form>
            </div>
          </details>
          <a href="/profile" aria-label="הפרופיל שלי" data-tour="nav-profile"
            className="ms-1 rounded-full no-underline shadow-[0_4px_14px_-4px_rgba(27,115,201,.55)] ring-2 ring-white transition hover:scale-105">
            <Avatar url={avatar} name={name} size={40} />
          </a>
        </nav>
      </div>
    </header>
  );
}
