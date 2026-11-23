'use client';

import { useRef, useState, useTransition } from 'react';
import { Alert } from '@/components/ui';
import { createClient } from '@/lib/supabase/browser';
import { addBooking, deleteBooking } from '@/app/trips/bookings-actions';
import { BOOKING_KINDS, DOC_BUCKET, DOC_MAX_BYTES, DOC_TYPES, kindOf, sortBookings, type Booking, type BookingKind } from '@/lib/trips/bookings';
import { formatDayHe } from '@/lib/trips/rules';

const card = 'rounded-2xl border border-line bg-white p-4 sm:p-5';
const field = 'h-12 min-w-0 rounded-xl border border-line bg-white px-3.5 text-base outline-none focus:border-terracotta focus:ring-4 focus:ring-terracotta/15';

export function Bookings({ tripId, initial, links, defaultDate }: { tripId: string; initial: Booking[]; links: Record<string, string>; defaultDate: string }) {
  const [items, setItems] = useState(initial);
  const [kind, setKind] = useState<BookingKind>('flight');
  const [title, setTitle] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [startsOn, setStartsOn] = useState(defaultDate);
  const [startTime, setStartTime] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!title.trim()) { setError('כתבו שם להזמנה, למשל "טיסה לטביליסי"'); return; }
    let filePath: string | null = null;
    if (file) {
      const ext = DOC_TYPES[file.type];
      if (!ext) { setError('אפשר לצרף PDF או תמונה (JPG, PNG, WEBP).'); return; }
      if (file.size > DOC_MAX_BYTES) { setError('הקובץ גדול מדי. עד 10MB.'); return; }
      setBusy('מעלים את הקובץ…');
      filePath = `${tripId}/doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const up = await createClient().storage.from(DOC_BUCKET).upload(filePath, file, { contentType: file.type, upsert: false });
      if (up.error) { setBusy(null); setError('העלאת הקובץ נכשלה. בדקו את החיבור ונסו שוב.'); return; }
    }
    setBusy('שומרים…');
    const r = await addBooking({ tripId, booking: { kind, title, confirmation, startsOn, startTime, endsOn, note }, filePath, fileName: file?.name ?? null });
    setBusy(null);
    if (!r.ok) {
      if (filePath) void createClient().storage.from(DOC_BUCKET).remove([filePath]);
      setError(r.error);
      return;
    }
    setItems((cur) => sortBookings([...cur, r.data]));
    setTitle(''); setConfirmation(''); setStartTime(''); setEndsOn(''); setNote(''); setFile(null);
    if (fileInput.current) fileInput.current.value = '';
  };

  const remove = (b: Booking) => {
    if (!window.confirm(`למחוק את "${b.title}"${b.file_path ? ' ואת הקובץ המצורף' : ''}?`)) return;
    setItems((cur) => cur.filter((x) => x.id !== b.id));
    start(async () => {
      const r = await deleteBooking({ tripId, id: b.id });
      if (!r.ok) { setError(r.error); setItems((cur) => sortBookings([...cur, b])); }
    });
  };

  const copy = async (b: Booking) => {
    try { await navigator.clipboard.writeText(b.confirmation ?? ''); setCopied(b.id); setTimeout(() => setCopied(null), 2000); } catch { /* no clipboard */ }
  };

  return (
    <>
      <section className={`${card} flex flex-col gap-3`} aria-labelledby="new-booking">
        <h2 id="new-booking" className="text-xl font-extrabold">הזמנה חדשה</h2>
        <div className="flex flex-wrap gap-2" role="group" aria-label="סוג ההזמנה">
          {BOOKING_KINDS.map((k) => (
            <button key={k.key} type="button" aria-pressed={kind === k.key} onClick={() => setKind(k.key)}
              className={`min-h-10 rounded-full border px-3 text-sm font-bold ${kind === k.key ? 'border-terracotta bg-terracotta text-white' : 'border-line bg-white text-ink-2'}`}>
              <span aria-hidden="true">{k.icon}</span> {k.label}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1.5 text-sm font-bold">שם
          <input id="b-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="למשל: טיסה לטביליסי, אל על LY5101" className={`${field} font-normal`} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-bold">מספר אישור / הזמנה (לא חובה)
          <input id="b-conf" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} maxLength={80} dir="ltr" placeholder="ABC123" className={`${field} font-normal`} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex min-w-0 flex-col gap-1.5 text-sm font-bold">תאריך
            <input id="b-date" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} className={`${field} font-normal`} />
          </label>
          <label className="flex min-w-0 flex-col gap-1.5 text-sm font-bold">שעה
            <input id="b-time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} dir="ltr" className={`${field} font-normal`} />
          </label>
        </div>
        {(kind === 'hotel' || kind === 'car') && (
          <label className="flex min-w-0 flex-col gap-1.5 text-sm font-bold">{kind === 'hotel' ? 'עד תאריך (צ\'ק-אאוט)' : 'עד תאריך (החזרה)'}
            <input type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} className={`${field} font-normal`} />
          </label>
        )}
        <label className="flex flex-col gap-1.5 text-sm font-bold">הערה (לא חובה)
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={2} placeholder="טרמינל, כתובת, טלפון, מה להביא…"
            className="rounded-xl border border-line bg-white px-3.5 py-2.5 text-base font-normal outline-none focus:border-terracotta focus:ring-4 focus:ring-terracotta/15" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-bold">קובץ מצורף (לא חובה): PDF או תמונה, עד 10MB
          <input ref={fileInput} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm font-normal file:me-3 file:min-h-10 file:rounded-full file:border-0 file:bg-sand-2 file:px-4 file:font-bold" />
        </label>
        {error && <Alert>{error}</Alert>}
        <button type="button" onClick={submit} disabled={!!busy || pending}
          className="min-h-12 rounded-full bg-gradient-to-l from-[#1B73C9] to-[#2E9BDB] px-6 text-base font-bold text-white disabled:opacity-60">
          {busy ?? 'שמירת ההזמנה'}
        </button>
      </section>

      <section className={`${card} flex flex-col gap-3`} aria-labelledby="all-bookings">
        <h2 id="all-bookings" className="text-xl font-extrabold">ההזמנות שלי</h2>
        {items.length === 0 ? (
          <p className="text-ink-2">עוד אין הזמנות. הוסיפו את הטיסה או את המלון, והם יופיעו גם בתוכנית של אותו יום.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((b) => {
              const k = kindOf(b.kind);
              return (
                <li key={b.id} className="flex gap-3 rounded-xl border border-line p-3" data-booking>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sand-2 text-xl" aria-hidden="true">{k.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold">{b.title}</p>
                    <p className="text-sm text-ink-2">
                      {k.label}
                      {b.starts_on && ` · ${formatDayHe(b.starts_on)}`}
                      {b.start_time && <> · <span dir="ltr">{b.start_time}</span></>}
                      {b.ends_on && ` · עד ${formatDayHe(b.ends_on)}`}
                    </p>
                    {b.confirmation && (
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-ink-2">אישור:</span>
                        <span dir="ltr" className="rounded-md bg-sand-2 px-2 py-0.5 font-bold tracking-wide">{b.confirmation}</span>
                        <button type="button" onClick={() => copy(b)} className="font-bold text-terracotta">{copied === b.id ? 'הועתק ✓' : 'העתקה'}</button>
                      </p>
                    )}
                    {b.note && <p className="mt-1 whitespace-pre-line text-sm text-ink-2">{b.note}</p>}
                    {b.file_path && (links[b.file_path]
                      ? <a href={links[b.file_path]} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm font-bold">📎 {b.file_name ?? 'פתיחת הקובץ'}</a>
                      : <p className="mt-1 text-sm text-ink-2">📎 {b.file_name ?? 'קובץ מצורף'} (ייפתח אחרי רענון העמוד)</p>)}
                  </div>
                  <button type="button" onClick={() => remove(b)} disabled={pending} aria-label={`מחיקת ${b.title}`} className="h-9 w-9 shrink-0 rounded-full text-xl text-[#B42318]">×</button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-muted">הפרטים והמספרים נשמרים גם לצפייה בלי אינטרנט בעמוד &quot;תוכנית&quot;. הקבצים עצמם נפתחים רק כשיש חיבור.</p>
      </section>
    </>
  );
}
