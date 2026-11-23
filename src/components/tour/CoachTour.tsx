'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { markTourSeen } from './actions';
import { TOURS, type TourKind, type TourStep } from './steps';

type Rect = { top: number; left: number; width: number; height: number };

const PAD = 8;
/** Inside a closed <details> (not its summary line): the browser may still give it a place on the page, under the folded row. */
const folded = (el: HTMLElement) => {
  const d = el.parentElement?.closest('details');
  if (!d || d.open) return null;
  const sum = d.querySelector(':scope > summary');
  return sum && sum.contains(el) ? null : (d as HTMLDetailsElement);
};
const visible = (el: HTMLElement | null) => {
  if (!el || folded(el)) return false;
  const c = el as HTMLElement & { checkVisibility?: (o?: object) => boolean };
  if (c.checkVisibility && !c.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: true })) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
};
/** On a part of the screen that doesn't move with the page (a place card on a phone, a dialog). */
const inFixed = (el: HTMLElement) => {
  for (let n: HTMLElement | null = el; n; n = n.parentElement) if (getComputedStyle(n).position === 'fixed') return true;
  return false;
};
/** `a|b`: the first of these marks that is on screen (e.g. the saved list, or its empty box). */
const find = (key: string) => {
  const all = key.split('|').flatMap((k) => [...document.querySelectorAll<HTMLElement>(`[data-tour="${k}"]`)]);
  return all.find(visible) ?? all.find((el) => { const d = folded(el); return !!d && visible(d); }) ?? null;
};
/** Can the guide show it: on screen, or inside a folded row that is on screen (the guide unfolds it). */
const reachable = (el: HTMLElement | null) => {
  if (!el) return false;
  if (visible(el)) return true;
  const d = folded(el);
  return !!d && visible(d);
};

/**
 * The in-app guide: dims the screen, lights up one real button at a time, and explains it
 * in a card next to it, with "next", "back" and "skip". Each screen has its own guide
 * (see steps.ts), opened by itself the first time, once per account, or again on demand.
 */
export function CoachTour({ kind, replay = false, onDone }: { kind: TourKind; replay?: boolean; onDone?: () => void }) {
  const [steps, setSteps] = useState<TourStep[] | null>(null);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [cardH, setCardH] = useState(220);
  const [vw, setVw] = useState(0);
  const [vh, setVh] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  // Start once the screen has drawn (the map and place details arrive a moment later), keeping only
  // the steps whose button is on screen. Nothing to show yet (e.g. no days) -> wait for a later visit.
  useEffect(() => {
    const all = TOURS[kind];
    let tries = 0;
    let t = 0;
    const attempt = () => {
      // A step inside a closed list (it names the list in `open`) counts when its button exists.
      const ready = all.filter((s) => !s.target || reachable(find(s.target)) || (!!s.open && !!document.querySelector(`[data-tour="${s.target}"]`)));
      const lit = ready.filter((s) => s.target).length;
      const wanted = all.filter((s) => s.target).length;
      if ((lit >= Math.min(2, wanted) || tries >= 12) && lit > 0) {
        setSteps(ready);
        setI(0);
        // Seen as soon as it opens, so it never pops up again (even if the page is left mid-way).
        if (!replay) {
          void markTourSeen(kind);
        }
        return;
      }
      if (tries >= 12) return;
      tries += 1;
      t = window.setTimeout(attempt, 400);
    };
    t = window.setTimeout(attempt, kind === 'trip' || kind === 'start' ? 1200 : 500);
    return () => window.clearTimeout(t);
  }, [kind, replay]);

  const step = steps?.[i];

  const measure = useCallback(() => {
    // On a phone the visible part can be smaller than the window (address bar, keyboard).
    setVw(window.visualViewport?.width ?? window.innerWidth);
    setVh(window.visualViewport?.height ?? window.innerHeight);
    if (!step?.target) return setRect(null);
    const el = find(step.target);
    if (!el || !visible(el)) return setRect(null);
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step]);

  // Bring the lit button into view, then keep the light on it while the page moves.
  useEffect(() => {
    if (!step) return;
    // Open the list this step's button lives in (and close it for the other steps).
    window.dispatchEvent(new CustomEvent('gotrip-tour-open', { detail: step.open ?? null }));
    // Unfold the folded rows this step talks about (and fold them back after it).
    const unfolded: HTMLDetailsElement[] = [];
    const unfold = () => {
      if (!step.target) return;
      const first = step.target.split('|').map((k) => document.querySelector<HTMLElement>(`[data-tour="${k}"]`)).find(Boolean);
      if (!first) return;
      if (step.expand && first instanceof HTMLDetailsElement && !first.open) { first.open = true; unfolded.push(first); }
      for (let d = folded(first); d; d = folded(first)) { d.open = true; unfolded.push(d); }
    };
    const show = () => {
      unfold();
      const el = step.target ? find(step.target) : null;
      if (el) {
        // Inside a list that scrolls by itself (a place card, the side panel): just into view there.
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        // Then the page itself, by hand: the button goes just under the sticky header, so the card fits
        // under it. (scrollIntoView lines up the box around the button instead, e.g. the whole trip bar.)
        if (!inFixed(el)) {
          const bar = [...document.querySelectorAll<HTMLElement>('header')].find((h) => ['sticky', 'fixed'].includes(getComputedStyle(h).position));
          const under = Math.max(0, bar?.getBoundingClientRect().bottom ?? 0) + 16;
          window.scrollTo(0, Math.max(0, window.scrollY + el.getBoundingClientRect().top - under));
        }
      }
      measure();
    };
    show();
    const raf = window.requestAnimationFrame(show);
    const t0 = step.open ? window.setTimeout(show, 80) : 0;
    const t = window.setTimeout(measure, 300);
    const t2 = window.setTimeout(measure, 800);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    window.visualViewport?.addEventListener('resize', measure);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(t0);
      window.clearTimeout(t);
      window.clearTimeout(t2);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
      window.visualViewport?.removeEventListener('resize', measure);
      for (const d of unfolded) d.open = false;
    };
  }, [step, measure]);

  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight);
    nextRef.current?.focus({ preventScroll: true });
  }, [i, steps, rect === null]);

  const close = useCallback(() => {
    setSteps([]);
    window.dispatchEvent(new CustomEvent('gotrip-tour-open', { detail: null }));
    onDone?.();
    if (replay) {
      const u = new URL(window.location.href);
      u.searchParams.delete('tour');
      window.history.replaceState(null, '', u.toString());
    }
  }, [replay, onDone]);

  const last = steps ? steps.length - 1 : 0;
  const next = useCallback(() => (i >= last ? close() : setI(i + 1)), [i, last, close]);
  const back = useCallback(() => setI((v) => Math.max(0, v - 1)), []);

  useEffect(() => {
    if (!step) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') next();
      else if (e.key === 'ArrowRight') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, close, next, back]);

  if (!step || !steps) return null;

  // Where the card goes: under the button if it fits, otherwise above it; in the middle when nothing is lit.
  // The card never covers the lit part: a button taller than the space left is lit only down to the card.
  const cardW = Math.min(360, (vw || 360) - 24);
  const H = vh || 640;
  let top: number;
  let left: number;
  let spot: Rect | null = null;
  if (rect) {
    const rTop = Math.max(rect.top, 8);
    const rBottom = Math.min(rect.top + rect.height, H - 8);
    const below = rBottom + PAD + 14;
    const above = rTop - PAD - 14 - cardH;
    let bottom = rBottom;
    if (below + cardH <= H - 12) top = below;
    else if (above >= 12) top = above;
    else {
      top = Math.max(12, H - cardH - 12);
      bottom = Math.min(rBottom, top - PAD - 14);
    }
    if (bottom - rTop < 24) bottom = Math.min(rBottom, rTop + 24);
    spot = { top: rTop, left: rect.left, width: rect.width, height: Math.max(0, bottom - rTop) };
    left = Math.min(Math.max(12, rect.left + rect.width / 2 - cardW / 2), (vw || 360) - cardW - 12);
  } else {
    top = Math.max(12, H / 2 - cardH / 2);
    left = Math.max(12, (vw || 360) / 2 - cardW / 2);
  }

  return (
    <div className="app-skin" dir="rtl">
      <style>{TOUR_CSS}</style>
      {/* Blocks the page while the guide is open; the light itself is the hole in the shade. */}
      <div className="fixed inset-0 z-[70]" style={rect ? undefined : { background: 'rgba(6,26,46,.62)' }} aria-hidden="true" />
      {spot && (
        <div className="coach-spot pointer-events-none fixed z-[71] rounded-2xl" aria-hidden="true"
          style={{ top: spot.top - PAD, left: spot.left - PAD, width: spot.width + PAD * 2, height: spot.height + PAD * 2 }} />
      )}
      <div ref={cardRef} key={i} role="dialog" aria-modal="true" aria-labelledby="coach-title" aria-describedby="coach-text"
        className="coach-card fixed z-[72] rounded-3xl bg-white p-5 text-ink shadow-[0_30px_70px_-20px_rgba(0,0,0,.55)]"
        style={{ top, left, width: cardW, maxHeight: H - 24, overflowY: 'auto' }}>
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full bg-terracotta-tint px-2.5 py-1 text-xs font-extrabold text-terracotta">
            {i + 1} מתוך {steps.length}
          </span>
          <button type="button" onClick={close} className="text-sm font-bold text-muted underline-offset-4 hover:text-ink hover:underline">
            {replay ? 'סגירה' : 'דילוג על ההדרכה'}
          </button>
        </div>
        <h2 id="coach-title" className="mt-3 text-xl font-extrabold leading-snug">{step.title}</h2>
        <p id="coach-text" className="mt-1.5 text-[15px] leading-relaxed text-ink-2">{step.text}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex gap-1" aria-hidden="true">
            {steps.map((_, k) => (
              <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? 'w-5 bg-terracotta' : 'w-1.5 bg-line'}`} />
            ))}
          </div>
          <div className="flex gap-2">
            {i > 0 && (
              <button type="button" onClick={back} className="min-h-11 rounded-full px-4 font-bold text-ink-2 hover:bg-sand-2">הקודם</button>
            )}
            <button ref={nextRef} type="button" onClick={next}
              className="min-h-11 rounded-full bg-gradient-to-l from-[#1B73C9] to-[#2E9BDB] px-5 font-bold text-white shadow-[0_8px_20px_-8px_rgba(27,115,201,.7)]">
              {i === last ? (i === 0 ? 'הבנתי' : 'סיום') : i === 0 && !step.target ? 'יאללה, מתחילים' : 'הבא'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const TOUR_CSS = `
.coach-spot { box-shadow: 0 0 0 9999px rgba(6,26,46,.62), 0 0 0 3px #7CC6F2; transition: top .3s ease, left .3s ease, width .3s ease, height .3s ease; animation: coach-pulse 1.8s ease-out infinite; }
.coach-card { animation: coach-in .28s cubic-bezier(.2,.7,.2,1) both; }
@keyframes coach-pulse { 0% { box-shadow: 0 0 0 9999px rgba(6,26,46,.62), 0 0 0 3px #7CC6F2; } 60% { box-shadow: 0 0 0 9999px rgba(6,26,46,.62), 0 0 0 9px rgba(124,198,242,.25); } 100% { box-shadow: 0 0 0 9999px rgba(6,26,46,.62), 0 0 0 3px #7CC6F2; } }
@keyframes coach-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .coach-spot, .coach-card { animation: none; transition: none; } }
`;
