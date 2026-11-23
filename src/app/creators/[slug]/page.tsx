import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PublicHeader } from '@/components/PublicHeader';
import { Footer } from '@/components/Footer';
import { RouteSections } from '@/components/market/RouteSections';
import { getSessionUser } from '@/lib/auth/session';
import { getCatalog, getCreatorBySlug } from '@/lib/market/queries';
import { CREATOR_LINKS } from '@/lib/market/rules';
import { ReportForm } from '@/app/routes/[id]/RouteForms';

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { supabase } = await getSessionUser();
  const c = await getCreatorBySlug(supabase, (await params).slug);
  return { title: c ? `${c.display_name} · מסלולים ב-YallaTrip` : 'יוצר/ת · YallaTrip' };
}

export default async function CreatorPage({ params }: P) {
  const { slug } = await params;
  const { supabase, user } = await getSessionUser();
  const c = await getCreatorBySlug(supabase, slug);
  if (!c) notFound();
  const routes = await getCatalog(supabase, { creatorSlug: slug, sort: 'new' });
  const links = CREATOR_LINKS.flatMap((l) => {
    const url = c.links?.[l.key];
    return typeof url === 'string' && /^https?:\/\//.test(url) ? [{ key: l.key, label: l.label, url }] : [];
  });
  const reviews = routes.reduce((s, r) => s + r.rating_count, 0);
  const avg = reviews ? routes.reduce((s, r) => s + r.rating_avg * r.rating_count, 0) / reviews : 0;

  return (
    <>
      <PublicHeader signedIn={!!user} />
      <main className="mx-auto max-w-[1100px] px-5 py-10 sm:px-10">
        <header className="flex items-center gap-5">
          <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-bl from-[#0E4A86] to-[#35A7E0] font-display text-3xl font-black text-white shadow-[0_10px_24px_-8px_rgba(27,115,201,.7)] ring-4 ring-white" aria-hidden="true">
            {c.display_name.slice(0, 1)}
          </span>
          <div>
            <h1 className="font-display text-4xl font-black">{c.display_name}</h1>
            <p className="mt-1 text-ink-2">{routes.length} מסלולים{reviews > 0 && ` · ★ ${avg.toFixed(1)} מ-${reviews} דירוגים`}</p>
          </div>
        </header>
        {c.bio && <p className="mt-5 max-w-2xl whitespace-pre-line text-lg">{c.bio}</p>}
        {links.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="קישורים">
            {links.map((l) => (
              <li key={l.key}>
                <a href={l.url} target="_blank" rel="noopener noreferrer nofollow"
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-white px-4 text-sm font-bold text-ink no-underline shadow-sm hover:border-terracotta hover:text-terracotta">
                  {l.label} <span aria-hidden="true">↗</span>
                </a>
              </li>
            ))}
          </ul>
        )}
        <RouteSections routes={routes} className="mt-8" />
        {routes.length === 0 && <p className="mt-8 text-ink-2">עוד אין מסלולים מפורסמים.</p>}
        {user && <div className="mt-10"><ReportForm targetType="creator" targetId={c.user_id} back={`/creators/${slug}`} /></div>}
      </main>
      <Footer />
    </>
  );
}
