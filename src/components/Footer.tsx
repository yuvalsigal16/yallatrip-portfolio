import { FEATURES, PAID_ROUTES } from '@/lib/features';
import { storeIsOpen } from '@/lib/market/open';
// An invisible layer around each link makes it a 40px tap target without changing how it looks.
// The layers sit behind the text (isolate + -z-10), so where two rows' layers meet, a link's own text still wins.
const link = "relative text-ink-2 after:absolute after:-inset-x-2 after:-inset-y-2.5 after:-z-10 after:content-['']";

/** `flush`: right under the section above it, without the space (the landing page's dark band runs down to it). */
export async function Footer({ flush = false }: { flush?: boolean }) {
  // Selling or publishing a route waits until the store has a few routes ("מסלולים" always shows the trips travellers shared).
  const store = await storeIsOpen();
  return (
    <footer className={`${flush ? '' : 'mt-16 '}border-t border-line px-5 py-8 text-sm text-ink-2 sm:px-10`}>
      <nav aria-label="קישורים" className="isolate mx-auto flex max-w-[1200px] flex-wrap gap-x-6 gap-y-2">
        <span>© YallaTrip</span>
        {FEATURES.routes && <a href="/routes" className={link}>מסלולים</a>}
        {store && <a href="/creator" className={link}>{PAID_ROUTES ? 'למכור מסלול' : 'לפרסם מסלול'}</a>}
        <a href="/terms" className={link}>תנאי שימוש</a>
        <a href="/privacy" className={link}>פרטיות</a>
        <a href="/accessibility" className={link}>הצהרת נגישות</a>
        <a href="/credits" className={link}>קרדיטים</a>
      </nav>
    </footer>
  );
}
