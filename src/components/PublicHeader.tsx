import { Logo, buttonBase, buttonStyles } from '@/components/ui';
import { NavLink } from './NavLink';
import { storeIsOpen } from '@/lib/market/open';

// Top bar for public pages (store, creator pages, shared trips).
export async function PublicHeader({ signedIn }: { signedIn: boolean }) {
  const store = await storeIsOpen();
  return (
    <header className="app-skin sticky top-0 z-40 border-b border-white/70 bg-white/80 shadow-[0_10px_30px_-22px_rgba(12,45,74,.45)] backdrop-blur-xl">
      <div className="mx-auto flex h-[60px] max-w-[1280px] items-center justify-between gap-2 px-3 sm:h-[72px] sm:px-10">
        <Logo />
        <nav aria-label="ראשי" className="flex shrink-0 items-center gap-1 text-[15px] font-bold sm:gap-2">
          {store && <NavLink href="/routes" className="hidden min-[390px]:inline">מסלולים</NavLink>}
          {signedIn ? (
            <a href="/trips" className={`${buttonBase} ${buttonStyles.primary} min-h-10 px-4 no-underline sm:px-5`}>הטיולים שלי</a>
          ) : (
            <a href="/login" className={`${buttonBase} ${buttonStyles.primary} min-h-10 px-4 no-underline sm:px-5`}>התחברות</a>
          )}
        </nav>
      </div>
    </header>
  );
}
