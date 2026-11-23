'use client';

import { useEffect, useRef, useState } from 'react';
import { Avatar } from '@/components/Avatar';
import type { TripPerson } from '@/lib/trips/queries';
import { FEATURES } from '@/lib/features';
import { createInviteLink, inviteToTrip, removeFromTrip, searchUsers, type FoundUser } from '../../members-actions';

/**
 * Planning together: the owner finds people by name and invites them. The trip becomes shared
 * only after they accept; then both edit it and see each other's changes live. It stays private.
 */
export function PeopleSection({ tripId, people: initial, isOwner, meId }: {
  tripId: string; people: TripPerson[]; isOwner: boolean; meId: string;
}) {
  const [link, setLink] = useState<string | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const makeLink = async () => {
    setLinkBusy(true);
    setMsg(null);
    const r = await createInviteLink({ tripId });
    setLinkBusy(false);
    if (!r.ok) return setMsg(r.error);
    setLink(`${window.location.origin}/join/${r.data}`);
  };
  const shareLink = async () => {
    if (!link) return;
    const text = 'הצטרפו לטיול שלי ב-YallaTrip:';
    try {
      if (navigator.share) { await navigator.share({ text, url: link }); return; }
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* closed the share sheet */ }
  };
  const [people, setPeople] = useState(initial);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<FoundUser[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) { setFound([]); return; }
    timer.current = setTimeout(async () => {
      const r = await searchUsers({ q });
      if (r.ok) setFound(r.data.filter((u) => !people.some((p) => p.id === u.id)));
    }, 300);
  }, [q, people]);

  const invite = async (u: FoundUser) => {
    setBusy(u.id);
    setMsg(null);
    const r = await inviteToTrip({ tripId, userId: u.id });
    setBusy(null);
    if (!r.ok) return setMsg(r.error);
    setPeople((ps) => [...ps, { id: u.id, name: u.display_name, avatar: u.avatar_url, is_owner: false, status: 'pending' }]);
    setQ('');
    setFound([]);
    setMsg(`נשלחה הזמנה ל${u.display_name ?? 'משתמש/ת'}. הטיול יהפוך למשותף אחרי שיאשרו.`);
  };

  const remove = async (p: TripPerson) => {
    setBusy(p.id);
    const r = await removeFromTrip({ tripId, userId: p.id });
    setBusy(null);
    if (!r.ok) return setMsg(r.error);
    setPeople((ps) => ps.filter((x) => x.id !== p.id));
  };

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-6" aria-labelledby="people-h">
      <div>
        <h2 id="people-h" className="text-lg font-extrabold">מתכננים יחד</h2>
        <p className="text-sm text-ink-2">
          כל מי שבטיול עורך אותו, והשינויים מופיעים אצל כולם מיד. טיול משותף נשאר פרטי{FEATURES.routes ? <> ולא מופיע ב&quot;מסלולים&quot;</> : null}.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {people.map((p) => (
          <li key={p.id} className="flex items-center gap-3 rounded-xl bg-sand px-3 py-2">
            <Avatar url={p.avatar} name={p.name} size={36} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold">{p.name ?? 'משתמש/ת'}{p.id === meId && ' (את/ה)'}</span>
              <span className="block text-xs text-ink-2">{p.is_owner ? 'יצר/ה את הטיול' : p.status === 'pending' ? 'הוזמן/ה, מחכה לאישור' : 'מתכנן/ת איתך'}</span>
            </span>
            {isOwner && !p.is_owner && (
              <button type="button" disabled={busy === p.id} onClick={() => remove(p)}
                className="min-h-9 rounded-full px-3 text-sm font-bold text-danger hover:bg-white disabled:opacity-50">
                {p.status === 'pending' ? 'ביטול הזמנה' : 'הסרה'}
              </button>
            )}
          </li>
        ))}
      </ul>

      {isOwner && (
        <div className="relative flex flex-col gap-1.5">
          <label htmlFor="invite-q" className="text-sm font-bold">להזמין מישהו לטיול</label>
          <input id="invite-q" value={q} onChange={(e) => setQ(e.target.value)} maxLength={60} autoComplete="off"
            placeholder="חיפוש לפי שם, למשל: דנה" className="h-12 rounded-xl border border-line bg-white px-3.5 text-base" />
          {found.length > 0 && (
            <ul className="flex flex-col gap-1 rounded-xl border border-line bg-white p-1 shadow-lg" aria-label="תוצאות">
              {found.map((u) => (
                <li key={u.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-sand">
                  <Avatar url={u.avatar_url} name={u.display_name} size={32} />
                  <span className="min-w-0 flex-1 truncate font-semibold">{u.display_name}</span>
                  <button type="button" disabled={busy === u.id} onClick={() => invite(u)}
                    className="min-h-9 rounded-full bg-terracotta px-4 text-sm font-bold text-white disabled:opacity-50">
                    {busy === u.id ? 'שולחים…' : 'הזמנה'}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {q.trim().length >= 2 && found.length === 0 && <p className="text-sm text-muted">לא נמצאו משתמשים בשם הזה.</p>}
        </div>
      )}
      {isOwner && (
        <div className="flex flex-col gap-2 rounded-xl bg-sand p-3" data-invite-link>
          <p className="text-sm font-bold">או לשלוח קישור הזמנה</p>
          <p className="text-sm text-ink-2">מי שפותח את הקישור ומתחבר מצטרף לטיול ויכול לערוך אותו. הקישור תקף ל-14 יום, וקישור חדש מבטל את הקודם.</p>
          {link ? (
            <>
              <input readOnly value={link} dir="ltr" aria-label="קישור ההזמנה" onFocus={(e) => e.target.select()} className="h-11 rounded-lg border border-line bg-white px-3 text-sm" />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={shareLink} className="min-h-10 rounded-full bg-terracotta px-4 text-sm font-bold text-white">{copied ? 'הועתק ✓' : 'שיתוף / העתקה'}</button>
                <a href={`https://wa.me/?text=${encodeURIComponent(`הצטרפו לטיול שלי ב-YallaTrip: ${link}`)}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center rounded-full border border-line bg-white px-4 text-sm font-bold text-ink no-underline">שליחה בוואטסאפ</a>
              </div>
            </>
          ) : (
            <button type="button" onClick={makeLink} disabled={linkBusy} className="min-h-10 w-fit rounded-full border border-line bg-white px-4 text-sm font-bold disabled:opacity-50">
              {linkBusy ? 'יוצרים…' : 'יצירת קישור הזמנה'}
            </button>
          )}
        </div>
      )}
      {msg && <p role="status" className="text-sm font-semibold text-sea">{msg}</p>}
    </section>
  );
}
