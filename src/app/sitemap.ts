import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

// Public pages only: the home page, the store, published routes and creator pages.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const base: MetadataRoute.Sitemap = [
    { url: `${site}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${site}/routes`, changeFrequency: 'daily', priority: 0.9 },
    ...['terms', 'privacy', 'accessibility', 'credits'].map((p) => ({ url: `${site}/${p}`, priority: 0.2 })),
  ];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return base;
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await supabase.from('routes_catalog').select('id, creator_slug, published_at').limit(5000);
  const rows = (data ?? []) as unknown as { id: string; creator_slug: string; published_at: string | null }[];
  const creators = [...new Set(rows.map((r) => r.creator_slug))];
  return [
    ...base,
    ...rows.map((r) => ({ url: `${site}/routes/${r.id}`, lastModified: r.published_at ?? undefined, priority: 0.7 })),
    ...creators.map((c) => ({ url: `${site}/creators/${c}`, priority: 0.5 })),
  ];
}
