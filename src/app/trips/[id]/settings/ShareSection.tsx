'use client';

import { useState } from 'react';
import { VISIBILITY, type Visibility } from '@/lib/sharing/rules';
import { setTripVisibility } from '../../share-actions';
import { FEATURES } from '@/lib/features';

/** Who can see the trip, and the link to share. */
export function ShareSection({ tripId, initial, initialToken, siteUrl }: {
  tripId: string; initial: Visibility; initialToken: string | null; siteUrl: string;
}) {
  const [visibility, setVisibility] = useState<Visibility>(initial);
  const [token, setToken] = useState(initialToken);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const link = token ? `${siteUrl}/s/${token}` : null;

  const change = async (v: Visibility) => {
    setBusy(true);
    setMsg(null);
    const r = await setTripVisibility({ tripId, visibility: v });
    setBusy(false);
    if (!r.ok) return setMsg(r.error);
    setVisibility(v);
    setToken(r.data.token);
    setMsg(v === 'private' ? 'הטיול פרטי. קישורים ששלחת כבר לא עובדים.' : v === 'public' ? 'הטיול מופיע עכשיו לכולם ב"מסלולים".' : 'הקישור מוכן לשיתוף.');
  };

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-6" aria-labelledby="share-h">
      <h2 id="share-h" className="text-lg font-extrabold">שיתוף</h2>
      <fieldset className="flex flex-col gap-2" disabled={busy}>
        <legend className="sr-only">מי יכול לראות</legend>
        {/* "ציבורי" means listed in "מסלולים": only while that page is on (or the trip already is). */}
        {VISIBILITY.filter((v) => FEATURES.routes || v.key !== 'public' || initial === 'public').map((v) => (
          <label key={v.key} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${visibility === v.key ? 'border-ink' : 'border-line'}`}>
            <input type="radio" name="visibility" value={v.key} checked={visibility === v.key} onChange={() => change(v.key)} className="mt-1 h-4 w-4 accent-[#0C2D4A]" />
            <span><b>{v.label}</b><span className="block text-sm text-ink-2">{v.help}</span></span>
          </label>
        ))}
      </fieldset>
      {FEATURES.routes && visibility === 'public' && (
        <a href="/routes#public-trips" className="w-fit rounded-xl bg-sand-2 px-4 py-2.5 font-bold text-ink no-underline hover:bg-sand">לראות אותו ב"מסלולים" ←</a>
      )}
      {link && visibility === 'link' && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input readOnly value={link} dir="ltr" aria-label="קישור לשיתוף" onFocus={(e) => e.target.select()}
            className="h-11 flex-1 rounded-xl border border-line bg-sand px-3 text-sm" />
          <button type="button" className="min-h-11 rounded-xl bg-ink px-4 font-bold text-white"
            onClick={async () => { await navigator.clipboard.writeText(link); setMsg('הקישור הועתק'); }}>העתקה</button>
          {'share' in navigator && (
            <button type="button" className="min-h-11 rounded-xl border border-line px-4 font-bold"
              onClick={() => navigator.share({ title: 'הטיול שלי ב-YallaTrip', url: link }).catch(() => {})}>שליחה…</button>
          )}
        </div>
      )}
      {msg && <p role="status" className="text-sm font-semibold text-sea">{msg}</p>}
      <p className="text-xs text-muted">מי שצופה רואה את הימים, התחנות, השעות, ההערות לתחנות וההמלצות והתמונות שלך. הערות אישיות על מקומות לא מוצגות.</p>
    </section>
  );
}
