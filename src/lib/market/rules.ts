// Pure marketplace rules: prices, route and creator forms. Unit-tested.

export const MIN_PRICE_AGOROT = 500;   // defaults; the database settings are the source of truth
export const MAX_PRICE_AGOROT = 50000;

/** 4900 -> "₪49", 4990 -> "₪49.90", 0 -> "חינם" */
export function formatPrice(agorot: number): string {
  if (agorot === 0) return 'חינם';
  const shekels = agorot / 100;
  return `₪${Number.isInteger(shekels) ? shekels : shekels.toFixed(2)}`;
}

/** "49" / "49.9" / "49.90" / "₪49" -> agorot; null when it is not a price. */
export function parsePrice(raw: unknown): number | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const s = String(raw).replace(/[₪\s,]/g, '');
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

/** What the creator gets from one sale, for the publish form. */
export function creatorShare(priceAgorot: number, commissionRate: number): { platform: number; creator: number } {
  const platform = Math.round(priceAgorot * commissionRate);
  return { platform, creator: priceAgorot - platform };
}

/**
 * Price by route length. Short (up to 5 days, e.g. 3 days in Rome): up to ₪59, YallaTrip keeps 20%.
 * Long (6+ days, e.g. 10 days in Japan): up to ₪149, YallaTrip keeps 30%.
 * The admin can change these; the database settings are the source of truth and enforce them.
 */
export type PriceTiers = { shortMaxDays: number; shortMax: number; longMax: number; shortRate: number; longRate: number };
export const DEFAULT_TIERS: PriceTiers = { shortMaxDays: 5, shortMax: 5900, longMax: 14900, shortRate: 0.2, longRate: 0.3 };

export type Tier = { short: boolean; label: string; maxAgorot: number; rate: number };
export function tierFor(days: number, t: PriceTiers = DEFAULT_TIERS): Tier {
  const short = (days || 0) <= t.shortMaxDays;
  return short
    ? { short, label: `מסלול קצר (עד ${t.shortMaxDays} ימים)`, maxAgorot: t.shortMax, rate: t.shortRate }
    : { short, label: `מסלול ארוך (${t.shortMaxDays + 1} ימים ומעלה)`, maxAgorot: t.longMax, rate: t.longRate };
}

type Result<T> ={ ok: true; value: T } | { ok: false; fieldErrors: Record<string, string> };

export function parseRouteForm(f: { title?: unknown; description?: unknown; price?: unknown; free?: unknown },
  limits = { min: MIN_PRICE_AGOROT, max: MAX_PRICE_AGOROT }): Result<{ title: string; description: string; priceAgorot: number }> {
  const e: Record<string, string> = {};
  const title = typeof f.title === 'string' ? f.title.trim() : '';
  const description = typeof f.description === 'string' ? f.description.trim() : '';
  if (title.length < 3 || title.length > 100) e.title = 'שם המסלול צריך 3–100 תווים';
  if (description.length < 20) e.description = 'כתבו לפחות כמה משפטים (20 תווים ומעלה) על המסלול';
  else if (description.length > 3000) e.description = 'התיאור ארוך מדי (עד 3,000 תווים)';
  const free = f.free === 'on' || f.free === true;
  let priceAgorot = 0;
  if (!free) {
    const p = parsePrice(f.price);
    if (p === null) e.price = 'מחיר לא תקין';
    else if (p < limits.min || p > limits.max) e.price = `מחיר בין ${formatPrice(limits.min)} ל-${formatPrice(limits.max)}, או חינם`;
    else priceAgorot = p;
  }
  return Object.keys(e).length ? { ok: false, fieldErrors: e } : { ok: true, value: { title, description, priceAgorot } };
}

export function parseCreatorForm(f: { slug?: unknown; displayName?: unknown; bio?: unknown }):
  Result<{ slug: string; displayName: string; bio: string | null }> {
  const e: Record<string, string> = {};
  const slug = typeof f.slug === 'string' ? f.slug.trim().toLowerCase() : '';
  const displayName = typeof f.displayName === 'string' ? f.displayName.trim() : '';
  const bio = typeof f.bio === 'string' && f.bio.trim() ? f.bio.trim() : null;
  if (!/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(slug)) e.slug = '3–40 אותיות באנגלית, ספרות ומקפים. למשל: noa-travels';
  if (displayName.length < 2 || displayName.length > 60) e.displayName = 'שם תצוגה בין 2 ל-60 תווים';
  if (bio && bio.length > 1000) e.bio = 'עד 1,000 תווים';
  return Object.keys(e).length ? { ok: false, fieldErrors: e } : { ok: true, value: { slug, displayName, bio } };
}

// ---------- creator links (shown on the public page, to show they really are a creator / blogger) ----------
export const CREATOR_LINKS = [
  { key: 'instagram', label: 'אינסטגרם', hosts: ['instagram.com'], placeholder: 'instagram.com/yourname' },
  { key: 'facebook', label: 'פייסבוק', hosts: ['facebook.com', 'fb.com'], placeholder: 'facebook.com/yourpage' },
  { key: 'tiktok', label: 'טיקטוק', hosts: ['tiktok.com'], placeholder: 'tiktok.com/@yourname' },
  { key: 'youtube', label: 'יוטיוב', hosts: ['youtube.com', 'youtu.be'], placeholder: 'youtube.com/@yourchannel' },
  { key: 'website', label: 'אתר / בלוג', hosts: [], placeholder: 'yourblog.com' },
] as const;
export type CreatorLinks = Partial<Record<(typeof CREATOR_LINKS)[number]['key'], string>>;

/** Each link: optional, http(s) only (https:// added when left out), and the social ones on their own site. */
export function parseCreatorLinks(f: Record<string, unknown>): Result<CreatorLinks> {
  const e: Record<string, string> = {};
  const out: CreatorLinks = {};
  for (const l of CREATOR_LINKS) {
    const raw = typeof f[l.key] === 'string' ? (f[l.key] as string).trim() : '';
    if (!raw) continue;
    let url: URL | null = null;
    try { url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { url = null; }
    const host = url?.hostname.toLowerCase().replace(/^www\.|^m\./, '') ?? '';
    if (!url || !/^https?:$/.test(url.protocol) || !host.includes('.') || raw.length > 300) { e[l.key] = 'כתובת לא תקינה'; continue; }
    const hosts: readonly string[] = l.hosts;
    if (hosts.length && !hosts.some((h) => host === h || host.endsWith(`.${h}`))) { e[l.key] = `צריך קישור ל${l.label}`; continue; }
    out[l.key] = url.toString();
  }
  return Object.keys(e).length ? { ok: false, fieldErrors: e } : { ok: true, value: out };
}

/**
 * A page address when the creator gave none: from the first link's user name (instagram.com/noa.travels
 * -> noa-travels), else from an English display name, else a short random one.
 */
export function slugFromLinks(links: CreatorLinks, displayName: string): string {
  const clean = (v: string) => v.toLowerCase().replace(/^@/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
  for (const l of CREATOR_LINKS) {
    const url = links[l.key];
    if (!url) continue;
    try {
      const u = new URL(url);
      const parts = u.pathname.split('/').filter(Boolean).filter((x) => !['channel', 'c', 'user', 'profile.php', 'pages'].includes(x));
      const cand = clean(parts[0] ?? (l.key === 'website' ? u.hostname.replace(/^www\./, '').split('.')[0] ?? '' : ''));
      if (cand.length >= 3) return cand;
    } catch { /* skip */ }
  }
  const fromName = clean(displayName);
  return fromName.length >= 3 ? fromName : `creator-${Math.random().toString(36).slice(2, 8)}`;
}

export function stars(avg: number): string {
  const full = Math.round(avg);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

export type Sort = 'popular' | 'new' | 'rating' | 'price';
export const SORTS: { key: Sort; label: string }[] = [
  { key: 'popular', label: 'הכי פופולריים' },
  { key: 'new', label: 'חדשים' },
  { key: 'rating', label: 'דירוג' },
  { key: 'price', label: 'מחיר' },
];
export const isSort = (v: unknown): v is Sort => SORTS.some((s) => s.key === v);
