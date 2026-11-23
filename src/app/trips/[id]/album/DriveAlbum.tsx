'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { forgetDriveAlbum, saveDriveAlbum, saveDriveDayFolder } from '@/app/trips/drive-actions';
import {
  addWaiting, createFolder, currentToken, DriveError, folderExists, listWaiting, networkKind, removeWaiting, signIn, uploadFile, type Waiting,
} from '@/lib/drive';

type Day = { index: number; date: string; label: string };
export type DriveAlbumRow = { folderId: string; folderName: string; dayFolders: Record<string, string> };
const OTHER = 'other';
const localToday = () => new Date().toLocaleDateString('en-CA');
const field = 'h-12 rounded-xl border border-line bg-white px-3 text-base font-normal';
const primary = 'flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-[#1B73C9] to-[#2E9BDB] px-5 font-bold text-white shadow-[0_8px_20px_-8px_rgba(27,115,201,.7)] disabled:opacity-60';

/**
 * The album in the traveller's own Google Drive: one folder with the album's name and a folder inside it
 * for every day. Photos chosen here wait on the phone and are sent to Drive on Wi-Fi (where the phone says
 * so) or when the traveller taps "send now". They never pass through our storage.
 */
export function DriveAlbum({ tripId, clientId, days, defaultName, initial }: {
  tripId: string; clientId: string; days: Day[]; defaultName: string; initial: DriveAlbumRow | null;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [album, setAlbum] = useState<DriveAlbumRow | null>(initial);
  const [name, setName] = useState(defaultName);
  const [choice, setChoice] = useState<string>(days[0]?.date ?? OTHER);
  const [other, setOther] = useState('');
  const [waiting, setWaiting] = useState<Waiting[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [net, setNet] = useState<'wifi' | 'other' | null>(null);
  const [confirmOff, setConfirmOff] = useState(false);
  const running = useRef(false);

  useEffect(() => {
    const t = localToday();
    if (days.some((d) => d.date === t)) setChoice(t);
    else if (!days.length) setOther(t);
    listWaiting(tripId).then(setWaiting).catch(() => {});
    setNet(networkKind());
    const c = (navigator as unknown as { connection?: EventTarget }).connection;
    const onChange = () => setNet(networkKind());
    c?.addEventListener?.('change', onChange);
    return () => c?.removeEventListener?.('change', onChange);
  }, [days, tripId]);

  const date = choice === OTHER ? other : choice;
  const folderName = (d: string) => {
    const day = days.find((x) => x.date === d);
    return day ? `יום ${String(day.index).padStart(2, '0')} · ${d}` : d;
  };
  const fail = (e: unknown) => {
    const text = e instanceof DriveError
      ? (e.status === 401 || e.status === 403 ? 'החיבור ל-Google פג. לחצי שוב כדי להתחבר.' : 'Google Drive לא קיבל את הבקשה. נסי שוב בעוד רגע.')
      : e instanceof Error && (e.message === 'closed' || e.message === 'denied' || e.message === 'access_denied')
        ? 'החיבור ל-Google לא הושלם. בלי אישור אי אפשר לשמור ב-Drive.'
        : 'אין חיבור. התמונות נשארות בטלפון ואפשר לנסות שוב.';
    setMsg({ kind: 'error', text });
  };

  const create = async () => {
    const clean = name.trim().slice(0, 120);
    if (!clean) return setMsg({ kind: 'error', text: 'כתבי שם לאלבום.' });
    setMsg(null);
    setBusy('יוצרים את האלבום ב-Drive…');
    try {
      const tok = await signIn(clientId);
      const folderId = await createFolder(tok, clean);
      const r = await saveDriveAlbum({ tripId, folderId, folderName: clean });
      if (!r.ok) throw new Error(r.error);
      setAlbum({ folderId, folderName: clean, dayFolders: {} });
      setMsg({ kind: 'ok', text: `התיקייה "${clean}" נוצרה ב-Drive שלך.` });
    } catch (e) { fail(e); }
    setBusy(null);
  };

  /** Send everything that waits. `tok` comes from a tap (sign-in) or from a sign-in that is still good. */
  const send = useCallback(async (tok: string, current: DriveAlbumRow) => {
    if (running.current) return;
    running.current = true;
    setMsg(null);
    let sent = 0;
    try {
      const list = await listWaiting(tripId);
      if (!list.length) return;
      setBusy('בודקים את האלבום ב-Drive…');
      if (!(await folderExists(tok, current.folderId))) {
        setMsg({ kind: 'error', text: 'התיקייה של האלבום נמחקה מ-Drive. אפשר לנתק וליצור אלבום חדש; התמונות שמחכות נשארות בטלפון.' });
        return;
      }
      const folders = { ...current.dayFolders };
      for (const [i, it] of list.entries()) {
        setBusy(`שולחים ל-Drive ${i + 1} מתוך ${list.length}…`);
        let folder = folders[it.date];
        if (folder && !(await folderExists(tok, folder))) folder = undefined;
        if (!folder) {
          folder = await createFolder(tok, folderName(it.date), current.folderId);
          folders[it.date] = folder;
          setAlbum((a) => (a ? { ...a, dayFolders: { ...a.dayFolders, [it.date]: folder! } } : a));
          await saveDriveDayFolder({ tripId, date: it.date, folderId: folder });
        }
        await uploadFile(tok, folder, it.name, it.blob);
        await removeWaiting([it.id]);
        sent++;
        setWaiting((w) => w.filter((x) => x.id !== it.id));
      }
      setMsg({ kind: 'ok', text: sent === 1 ? 'תמונה אחת נשמרה ב-Drive.' : `${sent} תמונות נשמרו ב-Drive, כל אחת בתיקייה של היום שלה.` });
    } catch (e) {
      fail(e);
      if (sent) setMsg((m) => (m ? { ...m, text: `${sent} נשמרו. ${m.text}` } : m));
    } finally {
      running.current = false;
      setBusy(null);
      listWaiting(tripId).then(setWaiting).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, days]);

  const sendNow = async () => {
    if (!album) return;
    try { await send(await signIn(clientId), album); } catch (e) { fail(e); }
  };

  // On Wi-Fi with a sign-in that is still good, waiting photos go by themselves.
  useEffect(() => {
    const tok = currentToken();
    if (album && net === 'wifi' && tok && waiting.length && !running.current) void send(tok, album);
  }, [album, net, waiting.length, send]);

  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    setMsg(null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setMsg({ kind: 'error', text: 'בחרי קודם את התאריך שבו צולמו התמונות.' });
    const list = [...files].filter((f) => f.type.startsWith('image/') && f.size <= 40 * 1024 * 1024).sort((a, b) => a.lastModified - b.lastModified).slice(0, 60);
    if (!list.length) return setMsg({ kind: 'error', text: 'אפשר לבחור תמונות בלבד, עד 40MB לתמונה.' });
    const stamp = Date.now();
    try {
      await addWaiting(list.map((f, i) => ({ id: `${stamp}-${String(i).padStart(3, '0')}-${Math.random().toString(36).slice(2, 8)}`, tripId, date, name: f.name || `photo-${stamp}-${i}.jpg`, blob: f })));
    } catch {
      return setMsg({ kind: 'error', text: 'אין מספיק מקום בטלפון כדי לשמור את התמונות עד ההעלאה. נסי פחות תמונות בכל פעם.' });
    }
    if (input.current) input.current.value = '';
    setWaiting(await listWaiting(tripId));
    setMsg({ kind: 'ok', text: `${list.length === 1 ? 'תמונה אחת מחכה' : `${list.length} תמונות מחכות`} להעלאה ל-Drive.` });
  };

  if (!album) {
    return (
      <section className="flex flex-col gap-3 rounded-3xl border border-line bg-white p-5 sm:p-6" aria-labelledby="drive-h" data-tour="al-drive">
        <h2 id="drive-h" className="text-xl font-extrabold">אלבום ב-Google Drive שלך</h2>
        <p className="text-ink-2">
          התמונות נשמרות ב-Drive האישי שלך, באיכות המקורית: תיקייה אחת בשם האלבום, ובתוכה תיקייה לכל יום. YallaTrip רואה רק את התיקיות שהוא עצמו יוצר, ושום דבר אחר ב-Drive שלך.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1.5 text-sm font-bold">שם האלבום (יהיה שם התיקייה)
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} disabled={!!busy} className={field} />
          </label>
          <button type="button" disabled={!!busy} onClick={create} className={primary}>{busy ?? 'יצירת אלבום ב-Drive'}</button>
        </div>
        <p className="text-sm text-ink-2">בלחיצה ייפתח חלון של Google לאישור. אפשר לנתק בכל רגע.</p>
        {msg && <p role="status" className={`text-sm font-semibold ${msg.kind === 'ok' ? 'text-sea' : 'text-danger'}`}>{msg.text}</p>}
      </section>
    );
  }

  const n = waiting.length;
  return (
    <section className="flex flex-col gap-3 rounded-3xl border border-line bg-white p-5 sm:p-6" aria-labelledby="drive-h" data-tour="al-drive">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="drive-h" className="text-xl font-extrabold">האלבום ב-Drive: {album.folderName}</h2>
        <a href={`https://drive.google.com/drive/folders/${album.folderId}`} target="_blank" rel="noopener noreferrer" className="font-bold">פתיחה ב-Drive ↗</a>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1.5 text-sm font-bold">באיזה יום צולמו?
          <select value={choice} onChange={(e) => setChoice(e.target.value)} disabled={!!busy} className={field}>
            {days.map((d) => <option key={d.date} value={d.date}>{d.label}</option>)}
            <option value={OTHER}>תאריך אחר…</option>
          </select>
        </label>
        {choice === OTHER && (
          <label className="flex flex-col gap-1.5 text-sm font-bold">תאריך
            <input type="date" dir="ltr" value={other} onChange={(e) => setOther(e.target.value)} disabled={!!busy} className={field} />
          </label>
        )}
        <button type="button" disabled={!!busy} onClick={() => input.current?.click()} className={primary}>בחירת תמונות</button>
      </div>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => pick(e.target.files)} />

      {n > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl bg-[#F1F7FD] p-3.5" role="status" data-tour="al-wait">
          <p className="font-extrabold">{n === 1 ? 'תמונה אחת מחכה' : `${n} תמונות מחכות`} בטלפון להעלאה</p>
          <p className="text-sm text-ink-2">
            {net === 'wifi' ? 'הטלפון על Wi-Fi. לחיצה אחת שולחת הכול ל-Drive.'
              : net === 'other' ? 'הטלפון לא על Wi-Fi. התמונות מחכות; כשתתחברי ל-Wi-Fi פתחי את האלבום ולחצי כאן. אפשר גם לשלוח עכשיו על הגלישה שלך.'
              : 'כשהטלפון מחובר ל-Wi-Fi, לחצי כאן והתמונות יישלחו ל-Drive.'}
          </p>
          <button type="button" disabled={!!busy} onClick={sendNow} className={primary}>{busy ?? `העלאה ל-Drive עכשיו (${n})`}</button>
        </div>
      )}
      {n === 0 && busy && <p role="status" className="text-sm font-semibold">{busy}</p>}
      {msg && <p role="status" className={`text-sm font-semibold ${msg.kind === 'ok' ? 'text-sea' : 'text-danger'}`}>{msg.text}</p>}
      <p className="text-sm text-ink-2">
        התמונות נשמרות ב-Drive שלך בלבד ולא מוצגות כאן. הן מחכות בטלפון עד ההעלאה, אז לא למחוק את נתוני האתר לפני שהן נשלחו. האלבום צריך להיות פתוח בזמן ההעלאה.
      </p>
      {confirmOff ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[#FEF3F2] p-2.5 text-sm" role="group" aria-label="אישור ניתוק">
          <span className="flex-1 font-semibold">לנתק? התיקייה והתמונות נשארות ב-Drive שלך.</span>
          <button type="button" disabled={!!busy} className="min-h-10 rounded-lg bg-[#B42318] px-3 font-bold text-white"
            onClick={async () => { const r = await forgetDriveAlbum({ tripId }); if (r.ok) { setAlbum(null); setConfirmOff(false); setMsg(null); } else setMsg({ kind: 'error', text: r.error }); }}>כן, לנתק</button>
          <button type="button" onClick={() => setConfirmOff(false)} className="min-h-10 rounded-lg px-3 font-bold">ביטול</button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirmOff(true)} className="self-start text-sm font-bold text-ink-2 underline">ניתוק האלבום מ-Drive</button>
      )}
    </section>
  );
}
