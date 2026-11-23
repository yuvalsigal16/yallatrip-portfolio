import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_TIERS, type PriceTiers, type Sort } from '@/lib/market/rules';
import { isUuid } from '@/lib/validation';

export type CatalogRoute = {
  id: string; title: string; description: string; destination_name: string; days_count: number; places_count: number;
  price_agorot: number; published_at: string | null; creator_slug: string; creator_name: string; creator_avatar: string | null;
  rating_avg: number; rating_count: number; acquisitions: number;
};

const COLS = 'id, title, description, destination_name, days_count, places_count, price_agorot, published_at, creator_slug, creator_name, creator_avatar, rating_avg, rating_count, acquisitions';

export async function getCatalog(supabase: SupabaseClient, opts: { q?: string; sort?: Sort; creatorSlug?: string; limit?: number } = {}): Promise<CatalogRoute[]> {
  let query = supabase.from('routes_catalog').select(COLS);
  if (opts.q) query = query.ilike('destination_name', `%${opts.q.replace(/[%_,()]/g, ' ').slice(0, 60)}%`);
  if (opts.creatorSlug) query = query.eq('creator_slug', opts.creatorSlug);
  const sort = opts.sort ?? 'popular';
  query = sort === 'new' ? query.order('published_at', { ascending: false })
    : sort === 'rating' ? query.order('rating_avg', { ascending: false }).order('rating_count', { ascending: false })
    : sort === 'price' ? query.order('price_agorot', { ascending: true })
    : query.order('acquisitions', { ascending: false }).order('rating_avg', { ascending: false });
  const { data, error } = await query.limit(opts.limit ?? 60);
  if (error) throw new Error(`getCatalog: ${error.message}`);
  return ((data ?? []) as unknown as CatalogRoute[]).map((r) => ({ ...r, rating_avg: Number(r.rating_avg) }));
}

export async function getCatalogRoute(supabase: SupabaseClient, id: string): Promise<CatalogRoute | null> {
  if (!isUuid(id)) return null;
  const { data } = await supabase.from('routes_catalog').select(COLS).eq('id', id).maybeSingle();
  return data ? { ...(data as unknown as CatalogRoute), rating_avg: Number((data as unknown as CatalogRoute).rating_avg) } : null;
}

export type PreviewDay = { day_index: number; title: string | null; stop_count: number; categories: string[]; stops: { label: string; category_key: string | null }[] | null };

export async function getRoutePreview(supabase: SupabaseClient, id: string): Promise<PreviewDay[]> {
  const { data } = await supabase.rpc('route_preview', { p_route: id });
  return ((data as unknown as { days?: PreviewDay[] } | null)?.days) ?? [];
}

export type PublicReview = { id: string; rating: number; body: string | null; created_at: string; author_first_name: string };

export async function getReviews(supabase: SupabaseClient, routeId: string): Promise<PublicReview[]> {
  const { data } = await supabase.from('reviews_public').select('id, rating, body, created_at, author_first_name')
    .eq('published_trip_id', routeId).order('created_at', { ascending: false }).limit(50);
  return (data ?? []) as unknown as PublicReview[];
}

/** The signed-in user's copy of a route, if they got it. */
export async function getMyCopy(supabase: SupabaseClient, routeId: string): Promise<{ copiedTripId: string | null; reviewed: { rating: number; body: string | null } | null } | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase.from('purchases').select('id, copied_trip_id').eq('published_trip_id', routeId)
    .eq('buyer_id', auth.user.id).eq('status', 'paid').maybeSingle();
  if (!data) return null;
  const p = data as unknown as { id: string; copied_trip_id: string | null };
  const { data: rv } = await supabase.from('reviews').select('rating, body').eq('purchase_id', p.id).maybeSingle();
  return { copiedTripId: p.copied_trip_id, reviewed: (rv as { rating: number; body: string | null } | null) ?? null };
}

export type Creator = { user_id: string; slug: string; display_name: string; bio: string | null; avatar_url: string | null; created_at: string; links: Record<string, string> | null };

export async function getCreatorBySlug(supabase: SupabaseClient, slug: string): Promise<Creator | null> {
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return null;
  const { data } = await supabase.from('creators').select('user_id, slug, display_name, bio, avatar_url, created_at, links').eq('slug', slug).maybeSingle();
  return (data as unknown as Creator | null) ?? null;
}

export async function getMyCreator(supabase: SupabaseClient, userId: string): Promise<Creator | null> {
  const { data } = await supabase.from('creators').select('user_id, slug, display_name, bio, avatar_url, created_at, links').eq('user_id', userId).maybeSingle();
  return (data as unknown as Creator | null) ?? null;
}

export type MyRoute = { id: string; title: string; description: string; price_agorot: number; status: string; review_note: string | null; days_count: number; places_count: number; created_at: string; sales: number };

export async function getMyRoutes(supabase: SupabaseClient, userId: string): Promise<MyRoute[]> {
  const { data } = await supabase.from('published_trips')
    .select('id, title, description, price_agorot, status, review_note, days_count, places_count, created_at, purchases(count)')
    .eq('creator_id', userId).order('created_at', { ascending: false });
  return ((data ?? []) as unknown as (MyRoute & { purchases: { count: number }[] })[]).map((r) => ({ ...r, sales: r.purchases?.[0]?.count ?? 0 }));
}

export async function getMyBalance(supabase: SupabaseClient): Promise<{ earned_agorot: number; paid_out_agorot: number; sales_count: number } | null> {
  const { data } = await supabase.from('creator_balances').select('earned_agorot, paid_out_agorot, sales_count').maybeSingle();
  return (data as unknown as { earned_agorot: number; paid_out_agorot: number; sales_count: number } | null) ?? null;
}

export async function getSetting(supabase: SupabaseClient, key: string): Promise<number | null> {
  const { data } = await supabase.from('platform_settings').select('value').eq('key', key).maybeSingle();
  const v = (data as unknown as { value: unknown } | null)?.value;
  return v === undefined || v === null ? null : Number(v);
}

/** The price-by-length rules (short / long route: max price and YallaTrip's share). */
export async function getPriceTiers(supabase: SupabaseClient): Promise<PriceTiers> {
  const { data } = await supabase.from('platform_settings').select('key, value')
    .in('key', ['short_route_max_days', 'short_max_price_agorot', 'long_max_price_agorot', 'short_commission_rate', 'long_commission_rate']);
  const m = new Map(((data ?? []) as unknown as { key: string; value: unknown }[]).map((r) => [r.key, Number(r.value)]));
  const n = (k: string, d: number) => (Number.isFinite(m.get(k)) ? m.get(k)! : d);
  return {
    shortMaxDays: n('short_route_max_days', DEFAULT_TIERS.shortMaxDays),
    shortMax: n('short_max_price_agorot', DEFAULT_TIERS.shortMax),
    longMax: n('long_max_price_agorot', DEFAULT_TIERS.longMax),
    shortRate: n('short_commission_rate', DEFAULT_TIERS.shortRate),
    longRate: n('long_commission_rate', DEFAULT_TIERS.longRate),
  };
}

// ---------- public trips: listed for everyone, no link needed ----------
export type PublicTrip = {
  id: string; title: string; destination_name: string; start_date: string | null; end_date: string | null;
  share_token: string; days_count: number; places_count: number; owner_name: string; owner_avatar: string | null;
  mine: boolean; destinations: { name: string }[] | null;
};

export async function getPublicTrips(supabase: SupabaseClient, q = '', limit = 60): Promise<PublicTrip[]> {
  const { data, error } = await supabase.rpc('list_public_trips', { p_q: q.replace(/[%_]/g, ' ').slice(0, 60) || null, p_limit: limit });
  if (error) {
    console.error('[getPublicTrips]', error.message);
    return [];
  }
  return (Array.isArray(data) ? data : []) as unknown as PublicTrip[];
}
