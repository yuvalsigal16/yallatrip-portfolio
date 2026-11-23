import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { HERO_PHOTOS, PageHero } from '@/components/PageHero';
import { requireOnboardedUser } from '@/lib/auth/session';
import { formatPrice } from '@/lib/market/rules';
import { getPriceTiers } from '@/lib/market/queries';
import { CommissionForm, InfluencerDecisionForm, PayoutForm, ReportResolveForm, RoleForm, UnpublishForm , SubscriptionsSwitch, RecHideForm } from './AdminForms';
import { PAID_ROUTES } from '@/lib/features';
import { MONTHLY_LIMITS } from '@/lib/api/guard';

export const metadata: Metadata = { title: 'ניהול · YallaTrip', robots: { index: false, follow: false } };

type Stats = Record<string, number>;
const ils = (a: number) => (a === 0 ? '₪0' : formatPrice(a));

// The admin dashboard. The page checks the role; every action is checked again in the database.
// The month's Google use per price tier, beside its ceiling (MONTHLY_LIMITS).
const USAGE_ROWS: [keyof typeof MONTHLY_LIMITS, string][] = [
  ['details_enterprise', 'כרטיסי מקום מלאים'],
  ['photos', 'תמונות בכרטיסים'],
  ['details_pro', 'שמירת מקומות'],
  ['nearby_pro', 'מה יש בסביבה'],
  ['nearby_enterprise', 'חיפושים בסביבה (מה עושים עכשיו, ישראלי)'],
  ['text_enterprise', 'חיפוש כשר וחב״ד, ובדרך'],
];

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const { supabase, profile } = await requireOnboardedUser('/admin');
  if (profile?.role !== 'admin') notFound();

  const q = typeof sp.q === 'string' && sp.q.trim() ? sp.q.trim().slice(0, 80) : null;
  const [stats, live, reports, users, balances, tiers, influencers, subs, recs, usage] = await Promise.all([
    supabase.rpc('admin_stats', {}),
    supabase.from('published_trips').select('id, title, price_agorot').eq('status', 'published').order('published_at', { ascending: false }).limit(30),
    supabase.from('reports').select('id, target_type, target_id, reason, created_at').eq('status', 'open').order('created_at'),
    supabase.rpc('admin_list_users', { p_search: q, p_limit: 50 }),
    supabase.from('creator_balances').select('creator_id, display_name, slug, earned_agorot, paid_out_agorot, sales_count'),
    getPriceTiers(supabase),
    supabase.rpc('admin_influencer_requests', {}),
    supabase.rpc('subscriptions_active'),
    supabase.from('place_recommendations').select('id, name, body, hidden, created_at, creators(display_name)').order('created_at', { ascending: false }).limit(50),
    supabase.rpc('admin_monthly_usage'),
  ]);
  const used = new Map(((usage.data ?? []) as { sku: string; used: number }[]).map((u) => [u.sku, u.used]));
  const inflReqs = (influencers.data ?? []) as unknown as { id: string; email: string; display_name: string | null; link: string | null; requested_at: string }[];
  const s = (stats.data ?? {}) as unknown as Stats;
  const card = 'rounded-2xl border border-line bg-white p-5';

  return (
    <>
      <AppHeader name={profile?.display_name ?? null} role={profile?.role} avatar={profile?.avatar_url ?? null} />
      <PageHero photo={HERO_PHOTOS.admin} width="max-w-[1100px]" overlap eyebrow="רק את רואה את הדף הזה" title="ניהול" />
      <main className="relative mx-auto -mt-12 flex max-w-[1100px] flex-col gap-8 px-5 pb-16 sm:px-8">

        <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-label="נתונים">
          {[
            ['משתמשים', s.users], ['חדשים השבוע', s.users_7d], ['טיולים שנפתחו', s.trips],
            ['מסלולים בחנות', s.routes_published], [PAID_ROUTES ? 'מכירות' : 'העתקות מסלולים', s.sales], ['דיווחים פתוחים', s.reports_open],
          ].map(([k, v]) => (
            <div key={k as string} className={card}><p className="text-sm font-bold text-ink-2">{k}</p><p className="font-display text-3xl font-black text-terracotta">{v ?? 0}</p></div>
          ))}
        </section>
        <p className="-mt-4 text-sm text-ink-2">
          {PAID_ROUTES && <>מחזור: {ils(s.revenue_agorot ?? 0)} · עמלות הפלטפורמה: {ils(s.commission_agorot ?? 0)} · </>}{s.creators ?? 0} יוצרים · {s.saved_places ?? 0} מקומות שמורים
        </p>

        {/* How much of Google's free monthly use the site has used (the ceilings stop just below it). */}
        <section className={`${card} flex flex-col gap-3`} aria-labelledby="usage-title">
          <h2 id="usage-title" className="text-xl font-extrabold">שימוש ב-Google החודש</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {USAGE_ROWS.map(([sku, label]) => {
              const n = used.get(sku) ?? 0, max = MONTHLY_LIMITS[sku];
              return (
                <li key={sku} className="flex flex-col gap-1">
                  <span className="flex justify-between gap-2 text-sm"><span className="font-bold">{label}</span><span className="text-ink-2" dir="ltr">{n.toLocaleString('he-IL')} / {max.toLocaleString('he-IL')}</span></span>
                  <span className="h-2 overflow-hidden rounded-full bg-sand-2"><span className={`block h-full rounded-full ${n >= max ? 'bg-danger' : 'bg-[#1B73C9]'}`} style={{ width: `${Math.min(100, Math.round((n / max) * 100))}%` }} /></span>
                </li>
              );
            })}
          </ul>
          <p className="text-sm text-ink-2">כשמגיעים לתקרה: כרטיס מקום נפתח עם שם וכתובת בלבד, והחיפוש בסביבה נעצר עד תחילת החודש. מנויים לא מוגבלים בכרטיסי מקום.</p>
        </section>

        <section className={`${card} flex flex-col gap-2`} aria-labelledby="subs-title">
          <h2 id="subs-title" className="text-xl font-extrabold">מנויים פעילים</h2>
          <p className="text-sm text-ink-2">כבוי: כל הכלים פתוחים לכולם, ועל הכלים במנוי יש רק סימון &quot;⭐ במנוי&quot;. דולק (רק אחרי שיש סליקה): &quot;מה עושים עכשיו&quot;, &quot;יורד גשם?&quot;, &quot;אני כאן&quot; ו&quot;סיכום הטיול&quot; פתוחים רק למנויים.</p>
          <SubscriptionsSwitch on={subs.data === true} />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-2xl font-bold">בקשות משפיענים ובלוגרים ({inflReqs.length})</h2>
          {inflReqs.length === 0 ? <p className="text-ink-2">אין בקשות חדשות.</p> : inflReqs.map((r) => (
            <div key={r.id} className={`${card} flex flex-wrap items-center justify-between gap-3`}>
              <div className="min-w-0">
                <p className="font-extrabold">{r.display_name || 'בלי שם'} <span className="font-semibold text-ink-2" dir="ltr">{r.email}</span></p>
                {r.link && /^https?:\/\//.test(r.link)
                  ? <a href={r.link} target="_blank" rel="noopener noreferrer" dir="ltr" className="break-all text-sm">{r.link}</a>
                  : r.link && <p className="break-all text-sm" dir="ltr">{r.link}</p>}
                <p className="text-xs text-muted">ביקש/ה ב-{new Date(r.requested_at).toLocaleDateString('he-IL')}</p>
              </div>
              <InfluencerDecisionForm userId={r.id} />
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-2xl font-bold">דיווחים פתוחים</h2>
          {(reports.data ?? []).length === 0 && <p className="text-ink-2">אין דיווחים פתוחים.</p>}
          {((reports.data ?? []) as unknown as { id: string; target_type: string; target_id: string | null; reason: string; created_at: string }[]).map((r) => (
            <article key={r.id} className={card}>
              <p className="text-sm font-bold text-ink-2">{r.target_type === 'feedback' ? `💬 בעיה או רעיון · ${new Date(r.created_at).toLocaleDateString('he-IL')}` : r.target_type === 'recommendation' ? 'המלצת יוצר/ת (אפשר להסתיר למטה, ב"המלצות יוצרים")' : r.target_type === 'route' ? 'מסלול' : r.target_type === 'review' ? 'ביקורת' : 'יוצר/ת'}
                {r.target_type === 'route' && <> · <a href={`/routes/${r.target_id}`} target="_blank">פתיחה ↗</a></>}</p>
              <p className="mt-1 whitespace-pre-line break-words">{r.reason}</p>
              <div className="mt-3"><ReportResolveForm reportId={r.id} reviewId={r.target_type === 'review' ? r.target_id ?? undefined : undefined} /></div>
            </article>
          ))}
        </section>

        <section className="flex flex-col gap-3" aria-labelledby="recs-admin">
          <h2 id="recs-admin" className="font-display text-2xl font-bold">המלצות יוצרים</h2>
          {(recs.data ?? []).length === 0 && <p className="text-ink-2">עוד אין המלצות.</p>}
          {((recs.data ?? []) as unknown as { id: string; name: string; body: string; hidden: boolean; creators: { display_name: string } | null }[]).map((r) => (
            <article key={r.id} className={`${card} flex flex-col gap-2`}>
              <p className="font-extrabold">⭐ {r.name} <span className="text-sm font-semibold text-ink-2">· {r.creators?.display_name ?? ''}</span>
                {r.hidden && <span className="ms-2 rounded-full bg-danger-tint px-2 py-0.5 text-xs font-bold text-[#8E3313]">מוסתרת</span>}</p>
              <p className="whitespace-pre-line break-words text-[15px]">{r.body}</p>
              <RecHideForm id={r.id} hidden={r.hidden} />
            </article>
          ))}
        </section>

        {PAID_ROUTES && <section className="flex flex-col gap-3">
          <h2 className="font-display text-2xl font-bold">יוצרים ותשלומים</h2>
          <div className="overflow-x-auto rounded-2xl border border-line bg-white">
            <table className="w-full text-sm">
              <thead className="bg-sand-2 text-right"><tr><th className="p-3">יוצר/ת</th><th className="p-3">מכירות</th><th className="p-3">הכנסות</th><th className="p-3">שולם</th><th className="p-3">יתרה</th><th className="p-3">רישום תשלום</th></tr></thead>
              <tbody>
                {((balances.data ?? []) as unknown as { creator_id: string; display_name: string; slug: string; earned_agorot: number; paid_out_agorot: number; sales_count: number }[]).map((b) => {
                  const due = b.earned_agorot - b.paid_out_agorot;
                  return (
                    <tr key={b.creator_id} className="border-t border-line">
                      <td className="p-3"><a href={`/creators/${b.slug}`}>{b.display_name}</a></td>
                      <td className="p-3">{b.sales_count}</td><td className="p-3">{ils(b.earned_agorot)}</td>
                      <td className="p-3">{ils(b.paid_out_agorot)}</td><td className="p-3 font-bold">{ils(due)}</td>
                      <td className="p-3">{due > 0 ? <PayoutForm creatorId={b.creator_id} due={(due / 100).toFixed(2)} /> : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>}

        <section className="grid gap-6 lg:grid-cols-2">
          {PAID_ROUTES && <div className={card}>
            <h2 className="mb-3 text-lg font-extrabold">מחירים ועמלות לפי אורך מסלול</h2>
            <CommissionForm tiers={tiers} />
          </div>}
          <div className={card}>
            <h2 className="mb-3 text-lg font-extrabold">מסלולים בחנות</h2>
            <ul className="flex flex-col gap-2">
              {((live.data ?? []) as unknown as { id: string; title: string; price_agorot: number }[]).map((r) => (
                <li key={r.id} className="flex flex-col gap-1"><a href={`/routes/${r.id}`}>{r.title}</a><UnpublishForm routeId={r.id} /></li>
              ))}
            </ul>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-2xl font-bold">משתמשים</h2>
          <form method="get" className="flex gap-2">
            <input name="q" defaultValue={q ?? ''} placeholder="חיפוש לפי אימייל או שם" className="h-10 flex-1 rounded-lg border border-line bg-white px-3" />
            <button className="h-10 rounded-lg bg-ink px-4 font-bold text-white">חיפוש</button>
          </form>
          <div className="overflow-x-auto rounded-2xl border border-line bg-white">
            <table className="w-full text-sm">
              <thead className="bg-sand-2 text-right"><tr><th className="p-3">שם</th><th className="p-3">אימייל</th><th className="p-3">טיולים</th><th className="p-3">הצטרפות</th><th className="p-3">הרשאה</th></tr></thead>
              <tbody>
                {((users.data ?? []) as unknown as { id: string; email: string; display_name: string | null; role: string; created_at: string; trips: number }[]).map((u) => (
                  <tr key={u.id} className="border-t border-line">
                    <td className="p-3">{u.display_name ?? '—'}</td><td className="p-3" dir="ltr">{u.email}</td>
                    <td className="p-3">{u.trips}</td><td className="p-3">{u.created_at.slice(0, 10)}</td>
                    <td className="p-3"><RoleForm userId={u.id} role={u.role} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
