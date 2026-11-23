import { RouteCard } from '@/components/market/RouteCard';
import type { CatalogRoute } from '@/lib/market/queries';
import { PAID_ROUTES } from '@/lib/features';

/** Routes split under two headings, paid and free, so travelers can tell them apart at a glance. */
export function RouteSections({ routes, className = '' }: { routes: CatalogRoute[]; className?: string }) {
  const grid = 'grid gap-5 sm:grid-cols-2 lg:grid-cols-3';
  if (!PAID_ROUTES) {
    return <div className={`${grid} ${className}`}>{routes.map((r, i) => <RouteCard key={r.id} r={r} index={i} />)}</div>;
  }
  const paid = routes.filter((r) => r.price_agorot > 0);
  const free = routes.filter((r) => r.price_agorot === 0);
  const groups = [
    { key: 'paid', title: 'מסלולים בתשלום', sub: 'מסלולים של יוצרי תוכן ובלוגרים, מלאים בהמלצות. קונים פעם אחת ומקבלים עותק לעריכה.', list: paid },
    { key: 'free', title: 'מסלולים בחינם', sub: 'מוסיפים לטיולים שלכם בלי תשלום, ועורכים איך שרוצים.', list: free },
  ].filter((g) => g.list.length > 0);
  return (
    <div className={`flex flex-col gap-12 ${className}`}>
      {groups.map((g) => (
        <section key={g.key} aria-labelledby={`routes-${g.key}`}>
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h2 id={`routes-${g.key}`} className="font-display text-3xl font-black">{g.title}</h2>
            <span className={`rounded-full px-2.5 py-0.5 text-sm font-extrabold ${g.key === 'paid' ? 'bg-[#FFF1D6] text-[#8A5A00]' : 'bg-[#E3F5EA] text-[#1E6B3A]'}`}>
              {g.list.length}
            </span>
          </div>
          <p className="mt-1 text-ink-2">{g.sub}</p>
          <div className={`mt-5 ${grid}`}>{g.list.map((r, i) => <RouteCard key={r.id} r={r} index={i} />)}</div>
        </section>
      ))}
    </div>
  );
}
