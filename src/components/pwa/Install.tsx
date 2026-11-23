'use client';

import { useEffect, useState } from 'react';

/**
 * "YallaTrip במסך הבית": how to add the site to the phone's home screen and open it like an app.
 * Phones only, and never when the site is already open from the home screen.
 * Opens by itself once on the traveller's first trip after 3 saved places (see TripWorkspace), and any time
 * from "הוספה למסך הבית" in the ☰ menu. What the traveller chose is remembered in this browser only.
 */

const KEY = 'yallatrip-install-v1';
const SNOOZE_DAYS = 14;
type Saved = { shown?: number; snoozeUntil?: number; done?: boolean; installed?: boolean };

const read = (): Saved => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Saved; } catch { return {}; }
};
const write = (patch: Saved) => {
  try { localStorage.setItem(KEY, JSON.stringify({ ...read(), ...patch })); } catch { /* private mode */ }
};

// Android's own install window, kept from the moment the browser offers it (it is offered once per page load).
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
let deferred: InstallEvent | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    window.dispatchEvent(new Event('yallatrip-install-ready'));
  });
  window.addEventListener('appinstalled', () => { write({ installed: true }); deferred = null; });
}

/** Already open from the home screen (Android and iPhone). */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

type Kind = 'ios-safari' | 'ios-other' | 'ios-inapp' | 'android' | 'android-inapp' | null;
/** Which phone and browser, for the right steps. null = not a phone. */
function phoneKind(): Kind {
  const ua = navigator.userAgent;
  const inApp = /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Line\/|Snapchat|TikTok|musical_ly/i.test(ua);
  if (/iPhone|iPod/.test(ua)) {
    if (inApp) return 'ios-inapp';
    if (/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)) return 'ios-other';
    // Safari says "Safari/"; the browser inside other apps usually doesn't.
    return /Safari\//.test(ua) ? 'ios-safari' : 'ios-inapp';
  }
  if (/Android/.test(ua) && /Mobile/.test(ua)) return inApp || /; wv\)/.test(ua) ? 'android-inapp' : 'android';
  return null;
}
/** Safari 26 moved "share" into the ⋯ menu at the bottom. */
const safariVersion = () => Number(/Version\/(\d+)/.exec(navigator.userAgent)?.[1] ?? 0);

/** Can this phone add the site now (a phone, not opened from the home screen, not installed)? */
const canOffer = () => phoneKind() !== null && !isStandalone() && !read().installed;

/** Asks for the window to open by itself (the first trip reached 3 saved places). It decides whether it may. */
export function offerInstall() {
  window.dispatchEvent(new Event('yallatrip-install-auto'));
}

/** The line in the ☰ menu. Shown on phones only, until the site is opened from the home screen. */
export function InstallMenuItem({ className }: { className: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => setShow(canOffer()), []);
  if (!show) return null;
  return (
    <button type="button" data-tour="nav-install" className={`${className} w-full cursor-pointer text-start`}
      onClick={(e) => {
        const d = (e.currentTarget as HTMLElement).closest('details');
        if (d) d.open = false;
        window.dispatchEvent(new Event('yallatrip-install-open'));
      }}>
      הוספה למסך הבית
    </button>
  );
}

const ShareIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v12M8 7l4-4 4 4" /><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
  </svg>
);
const AddIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <rect x="4" y="4" width="16" height="16" rx="4" /><path d="M12 8.5v7M8.5 12h7" />
  </svg>
);
const DotsIcon = ({ vertical = false }: { vertical?: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    {vertical ? <><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></>
      : <><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></>}
  </svg>
);

/** One step: its number, the button to look for (drawn), and what to do. */
function Step({ n, icon, children }: { n: number; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0B3D6E] text-sm font-extrabold text-white">{n}</span>
      <span className="flex h-10 min-w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-sand px-2 text-[#1B73C9]">{icon}</span>
      <span className="min-w-0 text-[15px] leading-snug">{children}</span>
    </li>
  );
}

/** The window itself. Lives once on every page (in PwaShell) and opens on request. */
export function InstallSheet() {
  const [open, setOpen] = useState<null | 'intro' | 'steps'>(null);
  const [auto, setAuto] = useState(false);
  const [kind, setKind] = useState<Kind>(null);
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setKind(phoneKind());
    setReady(!!deferred);
    const onReady = () => setReady(true);
    const onOpen = () => { if (!canOffer()) return; setAuto(false); setOpen('steps'); };
    const onAuto = () => {
      if (!canOffer()) return;
      const s = read();
      // Once; after "אולי אחר כך", once more 14 days later. Never after the steps were shown.
      if (s.done || (s.shown ?? 0) >= 2 || (s.snoozeUntil ?? 0) > Date.now()) return;
      write({ shown: (s.shown ?? 0) + 1 });
      setAuto(true);
      setOpen('intro');
    };
    window.addEventListener('yallatrip-install-ready', onReady);
    window.addEventListener('yallatrip-install-open', onOpen);
    window.addEventListener('yallatrip-install-auto', onAuto);
    return () => {
      window.removeEventListener('yallatrip-install-ready', onReady);
      window.removeEventListener('yallatrip-install-open', onOpen);
      window.removeEventListener('yallatrip-install-auto', onAuto);
    };
  }, []);

  if (!open || !kind) return null;

  const later = () => { if (auto) write({ snoozeUntil: Date.now() + SNOOZE_DAYS * 86400000 }); setOpen(null); };
  const close = () => { if (open === 'steps') write({ done: true }); else if (auto) return later(); setOpen(null); };
  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    setReady(false);
    if (outcome === 'accepted') { write({ installed: true }); setOpen(null); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(location.href); setCopied(true); } catch { /* not allowed */ }
  };
  const newSafari = kind === 'ios-safari' && safariVersion() >= 26;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/45" role="dialog" aria-modal="true" aria-labelledby="install-h"
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="relative w-full max-w-[480px] rounded-t-3xl bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 text-ink shadow-2xl">
        <button type="button" onClick={close} aria-label="סגירה" className="absolute end-3 top-3 h-10 w-10 rounded-full text-lg text-ink-2 hover:bg-sand">✕</button>
        <div className="flex items-center gap-3 pe-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/api/icons/180?v=2" alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-xl shadow-md" />
          <h2 id="install-h" className="text-lg font-extrabold leading-tight">YallaTrip במסך הבית, כמו אפליקציה</h2>
        </div>

        {open === 'intro' ? (
          <>
            <p className="mt-3 text-[15px] text-ink-2">פותחים את הטיול בלחיצה אחת מהמסך הבית, במסך מלא, גם באמצע הטיול.</p>
            <div className="mt-4 flex flex-col gap-2">
              <button type="button" onClick={() => setOpen('steps')}
                className="min-h-12 rounded-2xl bg-gradient-to-l from-[#1B73C9] to-[#38A8E8] px-5 text-base font-extrabold text-white">איך מוסיפים</button>
              <button type="button" onClick={later} className="min-h-11 rounded-2xl text-[15px] font-bold text-ink-2 hover:bg-sand">אולי אחר כך</button>
            </div>
          </>
        ) : kind === 'ios-inapp' || kind === 'android-inapp' ? (
          <>
            <p className="mt-3 text-[15px] leading-relaxed">
              כדי להוסיף למסך הבית, פותחים את הקישור ב-{kind === 'ios-inapp' ? 'Safari' : 'Chrome'}: לוחצים {kind === 'ios-inapp' ? '⋯' : '⋮'} ובוחרים &quot;פתיחה ב-{kind === 'ios-inapp' ? 'Safari' : 'Chrome'}&quot;.
            </p>
            <p className="mt-1 text-sm text-ink-2">לא מוצאים? מעתיקים את הקישור ומדביקים אותו ב-{kind === 'ios-inapp' ? 'Safari' : 'Chrome'}.</p>
            <button type="button" onClick={copy}
              className="mt-4 min-h-12 w-full rounded-2xl bg-gradient-to-l from-[#1B73C9] to-[#38A8E8] px-5 text-base font-extrabold text-white">
              {copied ? '✓ הקישור הועתק' : 'העתקת הקישור'}
            </button>
          </>
        ) : kind === 'android' ? (
          ready ? (
            <>
              <p className="mt-3 text-[15px] text-ink-2">לחיצה אחת, והאייקון של YallaTrip יופיע במסך הבית.</p>
              <button type="button" onClick={install}
                className="mt-4 min-h-12 w-full rounded-2xl bg-gradient-to-l from-[#1B73C9] to-[#38A8E8] px-5 text-base font-extrabold text-white">התקנת YallaTrip</button>
            </>
          ) : (
            <ol className="mt-4 flex flex-col gap-3">
              <Step n={1} icon={<DotsIcon vertical />}>לוחצים על <b>⋮</b> למעלה בפינה.</Step>
              <Step n={2} icon={<AddIcon />}>בוחרים <b>&quot;התקנת האפליקציה&quot;</b> (או &quot;הוספה למסך הבית&quot;).</Step>
              <Step n={3} icon={<span className="text-sm font-extrabold">התקנה</span>}>מאשרים.</Step>
            </ol>
          )
        ) : (
          <>
            <ol className="mt-4 flex flex-col gap-3">
              {newSafari ? (
                <Step n={1} icon={<DotsIcon />}>לוחצים על <b>⋯</b> בתחתית המסך, ואז על <b>שיתוף</b>.</Step>
              ) : (
                <Step n={1} icon={<ShareIcon />}>לוחצים על <b>שיתוף</b> {kind === 'ios-safari' ? 'בתחתית המסך' : 'בשורת הכתובת'}.</Step>
              )}
              <Step n={2} icon={<AddIcon />}>גוללים ובוחרים <b>&quot;הוספה למסך הבית&quot;</b>.</Step>
              <Step n={3} icon={<span className="text-sm font-extrabold text-[#1B73C9]">הוסף</span>}>לוחצים <b>&quot;הוסף&quot;</b>.</Step>
            </ol>
            {kind === 'ios-safari' && <p className="mt-3 text-xs text-muted">לא מופיע &quot;הוספה למסך הבית&quot;? פותחים את האתר ישר ב-Safari ומנסים שוב.</p>}
          </>
        )}

        {/* A soft arrow down towards Safari's share button (bottom middle; Safari 26: the ⋯ at the bottom right). */}
        {open === 'steps' && kind === 'ios-safari' && (
          <div dir="ltr" className={`mt-3 flex ${newSafari ? 'justify-end pr-2' : 'justify-center'} text-[#1B73C9]`} aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="motion-safe:animate-bounce">
              <path d="M12 4v15M6 13l6 6 6-6" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
