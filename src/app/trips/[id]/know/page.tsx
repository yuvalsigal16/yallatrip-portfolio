import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { HERO_PHOTOS, PageHero } from '@/components/PageHero';
import { requireOnboardedUser } from '@/lib/auth/session';
import { canEditTrip, getTrip } from '@/lib/trips/queries';
import { COUNTRIES, INFO_UPDATED, countriesFor, hoursFromIsrael, type CountryInfo } from '@/lib/countries/info';
import { getRates, unitIn } from '@/lib/rates';
import { CURRENCIES } from '@/lib/trips/extras';
import { EXTRA } from '@/lib/countries/extra';
import { HereBox, type Here, type TripCtx } from '@/components/trips/HereBox';
import type { SupabaseClient } from '@supabase/supabase-js';
import { FEATURES } from '@/lib/features';


export const metadata: Metadata = { title: 'מה צריך לדעת · YallaTrip', robots: { index: false, follow: false } };

const card = 'rounded-2xl border border-line bg-white p-5';
const search = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;

function hoursHe(h: number | null) {
  if (h === null) return null;
  if (h === 0) return 'אותה שעה כמו בישראל';
  const abs = Math.abs(h);
  const n = Number.isInteger(abs) ? String(abs) : abs.toFixed(1);
  return `${n} ${abs === 1 ? 'שעה' : 'שעות'} ${h > 0 ? 'לפני' : 'אחרי'} ישראל`;
}

function Row({ icon, label, children }: { icon: string; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 border-t border-line py-2.5 first:border-t-0">
      <span className="w-7 shrink-0 text-xl" aria-hidden="true">{icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-extrabold text-ink-2">{label}</p>
        <div className="text-[15px]">{children}</div>
      </div>
    </div>
  );
}

function Country({ c, shekel, trip, here, kosher }: { c: CountryInfo; shekel: number | null; trip: TripCtx; here: Here | null; kosher: boolean }) {
  // Chabad and kosher tips only for a traveller who keeps kosher (opening questions, profile or trip settings).
  const tips = (c.tips ?? []).filter((t) => kosher || !/חב״ד|כשר/.test(t));
  const cur = CURRENCIES.find((x) => x.code === c.currency);
  const ex = EXTRA[c.code];
  return (
    <section className={card} aria-labelledby={`c-${c.code}`}>
      <h2 id={`c-${c.code}`} className="text-2xl font-black">{c.he}</h2>
      <p className="mb-1 text-xs text-muted">עודכן לאחרונה: {INFO_UPDATED}</p>
      <Row icon="🛂" label="ויזה לבעלי דרכון ישראלי">{c.visa}</Row>
      {ex && <Row icon="✈️" label="טיסות מישראל">{ex.flight}</Row>}
      {ex && <Row icon="💉" label="חיסונים ובריאות">{ex.health}</Row>}
      <Row icon="🔌" label="שקע וחשמל">{c.power}</Row>
      <Row icon="💵" label="כסף">
        {c.money}
        {shekel !== null && c.currency !== 'ILS' && (
          <span className="mt-0.5 block font-bold text-sea">היום: 1 {cur?.symbol ?? c.currency} ≈ {shekel < 0.01 ? shekel.toFixed(4) : shekel < 1 ? shekel.toFixed(3) : shekel.toFixed(2)} ₪</span>
        )}
      </Row>
      <Row icon="🍽️" label="טיפים">{c.tipping}</Row>
      {ex && <Row icon="📱" label="eSIM וגלישה">{ex.esim}</Row>}
      <Row icon="🕐" label="שעון">
        {hoursHe(hoursFromIsrael(c.tz)) ?? '—'}{c.manyZones ? ' (במדינה יש כמה אזורי זמן; זה לפי העיר המרכזית)' : ''}
      </Row>
      {c.driveLeft && <Row icon="🚗" label="נהיגה">נוהגים בצד שמאל של הכביש.</Row>}
      <Row icon="🚨" label="חירום">{c.emergency}</Row>
      {tips.length > 0 && (
        <Row icon="💡" label="כדאי לדעת">
          <ul className="flex list-disc flex-col gap-0.5 pr-4">{tips.map((t) => <li key={t}>{t}</li>)}</ul>
        </Row>
      )}
      {FEATURES.israelisHere && <HereBox c={c} trip={trip} here={here} />}
      <div className="mt-3 flex flex-wrap gap-2 text-sm font-bold">
        <a href={search(`טיסות ישירות מנתב״ג ל${c.he}`)} target="_blank" rel="noreferrer" className="rounded-full border border-line px-3 py-1.5 no-underline">טיסות ישירות עכשיו ↗</a>
        <a href={search(`ויזה לבעלי דרכון ישראלי ${c.he}`)} target="_blank" rel="noreferrer" className="rounded-full border border-line px-3 py-1.5 no-underline">לבדוק ויזה עדכנית ↗</a>
        <a href={search(`אזהרת מסע המל"ל ${c.he}`)} target="_blank" rel="noreferrer" className="rounded-full border border-line px-3 py-1.5 no-underline">אזהרות מסע ↗</a>
        <a href={search(`שגרירות ישראל ${c.he}`)} target="_blank" rel="noreferrer" className="rounded-full border border-line px-3 py-1.5 no-underline">שגרירות ישראל ↗</a>
      </div>
    </section>
  );
}

async function hereFor(supabase: SupabaseClient, code: string, trip: TripCtx): Promise<Here | null> {
  if (!FEATURES.israelisHere || !trip.start || !trip.end) return null;
  const { data, error } = await supabase.rpc('israelis_here', { p_country: code, p_from: trip.start, p_to: trip.end });
  if (error || !data) return null;
  return data as Here;
}

/** "What to know" for every country of the trip, found from its destinations; any other country can be added. */
export default async function KnowPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ c?: string }> }) {
  const { id } = await params;
  const { c: extra } = await searchParams;
  const { supabase, user, profile } = await requireOnboardedUser(`/trips/${id}/know`);
  if (!(await canEditTrip(supabase, id))) notFound();
  const trip = await getTrip(supabase, id);
  if (!trip) notFound();

  const found = countriesFor([...trip.destinations.map((d) => d.name), trip.destination_name]);
  const added = (extra ?? '').split(',').map((code) => COUNTRIES.find((x) => x.code === code)).filter((x): x is CountryInfo => !!x && !found.includes(x));
  const shown = [...found, ...added];
  const rates = shown.length ? await getRates('ILS') : null;
  const others = COUNTRIES.filter((x) => !shown.includes(x)).sort((a, b) => a.he.localeCompare(b.he, 'he'));
  const codes = shown.map((x) => x.code);
  const tctx: TripCtx = { id: trip.id, start: trip.start_date, end: trip.end_date };
  const [heres, { data: prefs }] = await Promise.all([
    Promise.all(shown.map((c) => hereFor(supabase, c.code, tctx))),
    supabase.from('user_preferences').select('keeps_kosher').eq('user_id', user.id).maybeSingle(),
  ]);
  const kosher = (prefs as { keeps_kosher?: boolean } | null)?.keeps_kosher === true;

  return (
    <>
      <AppHeader name={profile?.display_name ?? null} role={profile?.role} avatar={profile?.avatar_url ?? null} />
      <PageHero photo={HERO_PHOTOS.routes} width="max-w-[720px]" overlap back={{ href: `/trips/${trip.id}`, label: '→ חזרה לטיול' }}
        eyebrow={trip.title} title="מה צריך לדעת" subtitle={`ויזה, טיסות, חיסונים, כסף, eSIM${FEATURES.israelisHere ? ', חירום וישראלים שיהיו שם' : ' וחירום'}, לכל מדינה בטיול.`} />
      <main className="relative mx-auto -mt-12 flex max-w-[720px] flex-col gap-5 px-4 pb-16 sm:px-8">
        {shown.length === 0 && (
          <section className={card}>
            <p className="font-extrabold">לא זיהינו מדינה מהיעדים של הטיול.</p>
            <p className="mt-1 text-ink-2">בחרו את המדינה מהרשימה למטה.</p>
          </section>
        )}
        {shown.map((c, i) => <Country key={c.code} c={c} trip={tctx} here={heres[i] ?? null} kosher={kosher} shekel={rates ? unitIn(rates.rates, c.currency) : null} />)}

        <details className={card}>
          <summary className="cursor-pointer font-extrabold">+ להוסיף מדינה אחרת</summary>
          <ul className="mt-3 flex flex-wrap gap-2">
            {others.map((x) => (
              <li key={x.code}>
                <a href={`/trips/${trip.id}/know?c=${[...codes.filter((k) => !found.some((f) => f.code === k)), x.code].join(',')}`}
                  className="inline-block rounded-full border border-line px-3 py-1.5 text-sm font-bold no-underline">{x.he}</a>
              </li>
            ))}
          </ul>
        </details>

        <p className="text-sm text-muted">
          המידע נאסף ב-2026 ונכון לבעלי דרכון ישראלי. כללי כניסה, קווי טיסה והמלצות בריאות משתנים: לפני הטיסה בדקו באתר משרד החוץ, בשגרירות, באזהרות המסע ובמרפאת מטיילים.
          {rates && ' שערי המטבע מתעדכנים פעם ביום (מקור: ExchangeRate-API).'}
        </p>
      </main>
    </>
  );
}
