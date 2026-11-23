'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { categoryMeta } from '@/lib/places/categories';
import type { MapPlace } from '@/lib/places/queries';
import type { PlanDay, Stop } from '@/lib/planning/queries';
import {
  legOptions, shortDurationHe, durationFor, toMinutes, type LegMode, type LegOptions, describeLegHe, optimizeOrder, routeLength,
} from '@/lib/planning/rules';
import { formatDayHe } from '@/lib/trips/rules';
import { insideShabbat, shabbatInfo, shabbatLineHe } from '@/lib/shabbat';
import type { PlanResult } from '@/lib/planning/ai';
import * as plan from '@/app/trips/plan-actions';
import { FEATURES } from '@/lib/features';
import { distanceMeters } from '@/lib/geo';
import type { Act } from './SavedPanel';
import { PACES, dayCapacity, dayWeight, paceInfo, type Pace } from '@/lib/planning/pace';

export type LegInfo = {
  durationSec: number | null; distanceMeters: number | null; mode?: 'walk' | 'transit' | 'drive';
  polyline?: string | null; walkSec?: number | null;
};

type Props = {
  tripId: string;
  days: PlanDay[];
  setDays: (fn: (ds: PlanDay[]) => PlanDay[]) => void;
  places: MapPlace[];
  byId: Map<string, MapPlace>;
  hotel: MapPlace | null;
  dayId: string | null;
  setDayId: (id: string) => void;
  legs: LegInfo[] | null;
  /** Start point -> first stop, when the day has a start point. */
  startLeg: LegInfo | null;
  routeLoading: boolean;
  mode: 'walk' | 'transit' | 'drive';
  busy: boolean;
  act: Act;
  addToDay: (savedPlaceId: string, dayId: string) => Promise<void>;
  reload: () => Promise<void>;
  aiAvailable: boolean;
  onShowOnMap: (googlePlaceId: string) => void;
  onShowDayOnMap: () => void;
  /** Saved places known (from Google's hours) to be closed on the selected day's weekday. */
  closedIds?: Set<string>;
  /** The traveller keeps Shabbat (shown only during the trip itself). */
  shabbat?: boolean;
  center?: { lat: number; lng: number } | null;
  /** How full the days should be; sets the default start time and the "too much for this pace" note. */
  pace?: Pace;
  onPace?: (v: Pace) => void;
  /** Newly saved places go straight into the best day. */
  autoAssign?: boolean;
  onAutoAssign?: (v: boolean) => void;
  /** Only these days in the day chips (one place of a trip with several); null = all. */
  visibleDayIds?: Set<string> | null;
  /** The place of the trip being shown (a trip with several), for the "fill my days" button. */
  chapterName?: string | null;
  /** A personal note on a saved place (also before it is in any day). */
  onNote?: (savedPlaceId: string, note: string) => Promise<void>;
  /** Delete a saved place from the trip altogether. */
  onRemove?: (place: MapPlace) => Promise<boolean>;
  /** Shown right after the day's stops, before "לא משובצים" (stops along the way). */
  afterStops?: ReactNode;
};

/** A folded row's ▸, turned down while open (inside a `group` <details>). */
function Chevron() {
  return <span aria-hidden="true" className="inline-block text-xs transition-transform group-open:rotate-90">▸</span>;
}
const foldRow = 'flex min-h-10 cursor-pointer list-none items-center gap-1.5 text-sm font-bold text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden';

/** A saved place not in any day yet: "+ to this day", and in "⋯" its note and deleting it. */
function UnscheduledRow({ x, day, busy, addToDay, onNote, onRemove }: {
  x: MapPlace; day: { id: string; dayIndex: number }; busy: boolean;
  addToDay: (savedPlaceId: string, dayId: string) => Promise<void>; onNote?: (savedPlaceId: string, note: string) => Promise<void>;
  onRemove?: (place: MapPlace) => Promise<boolean>;
}) {
  const meta = categoryMeta(x.categoryKey);
  const [menu, setMenu] = useState(false);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState(x.note ?? '');
  const hasMore = !!(onNote || onRemove);
  return (
    <li className="flex flex-col gap-1.5 rounded-xl border border-line bg-white p-2">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: meta.color }} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold">{x.label}</span>
          {x.note && !open && <span className="block truncate text-xs text-muted">✎ {x.note}</span>}
        </span>
        <button type="button" disabled={busy} onClick={() => addToDay(x.id, day.id)}
          className="min-h-10 shrink-0 rounded-lg border border-line px-2.5 text-sm font-bold hover:bg-sand disabled:opacity-60">
          + ליום {day.dayIndex}
        </button>
        {hasMore && (
          <button type="button" aria-expanded={menu} onClick={() => { setMenu((v) => !v); setConfirm(false); }} data-tour="d-unsched-more"
            aria-label={`עוד: ${x.label}`} className="h-10 w-10 shrink-0 rounded-lg text-lg font-bold text-ink-2 hover:bg-sand">⋯</button>
        )}
      </div>
      {menu && (
        <div className="flex flex-wrap gap-2 border-t border-line pt-2 text-sm">
          {onNote && (
            <button type="button" aria-expanded={open} onClick={() => { setOpen((v) => !v); setMenu(false); }}
              className="min-h-10 rounded-lg border border-line px-3 font-bold hover:bg-sand">✎ {x.note ? 'עריכת ההערה' : 'הערה'}</button>
          )}
          {onRemove && (
            <button type="button" disabled={busy} onClick={() => setConfirm(true)} aria-expanded={confirm}
              className="min-h-10 rounded-lg px-3 font-bold text-[#B42318] hover:bg-[#FEF3F2] disabled:opacity-60">🗑 מחיקה מהשמורים</button>
          )}
        </div>
      )}
      {confirm && onRemove && (
        <div className="flex items-center gap-2 rounded-lg bg-[#FEF3F2] px-2 py-1.5 text-sm" role="group" aria-label={`למחוק את ${x.label}?`}>
          <span className="flex-1">למחוק את {x.label} מהשמורים?</span>
          <button type="button" disabled={busy} onClick={async () => { if (!(await onRemove(x))) { setConfirm(false); setMenu(false); } }}
            className="min-h-10 rounded-lg bg-[#B42318] px-3 font-bold text-white disabled:opacity-60">כן</button>
          <button type="button" onClick={() => { setConfirm(false); setMenu(false); }} className="min-h-10 rounded-lg border border-line px-3 font-bold">לא</button>
        </div>
      )}
      {open && onNote && (
        <textarea value={note} maxLength={2000} rows={2} autoFocus onChange={(e) => setNote(e.target.value)}
          onBlur={async () => { if (note.trim() !== (x.note ?? '')) await onNote(x.id, note); }}
          placeholder="הערה בשבילך, למשל: לבדוק שעות פתיחה" aria-label={`הערה על ${x.label}`}
          className="rounded-lg border border-line px-3 py-2 text-base" />
      )}
    </li>
  );
}

/** 90 -> "1:30". */
const hm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
/** How long to stay: every quarter of an hour up to 8 hours, plus the current one if it is unusual. */
const STAY_STEPS = Array.from({ length: 33 }, (_, i) => i * 15);
const stayOptions = (cur: number) => (STAY_STEPS.includes(cur) ? STAY_STEPS : [...STAY_STEPS, cur].sort((a, b) => a - b));
/** 615 -> "10:15" (past midnight wraps around). */
const clock = (m: number) => { const d = ((m % 1440) + 1440) % 1440; return `${String(Math.floor(d / 60)).padStart(2, '0')}:${String(d % 60).padStart(2, '0')}`; };

const km = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} מ׳` : `${(m / 1000).toFixed(1)} ק״מ`);

/** "By days": each day's stops in order, with travel times, reordering and helpers. */
export function DaysPlanner(p: Props) {
  const pace: Pace = p.pace ?? 'normal';
  const day = p.days.find((d) => d.id === p.dayId) ?? p.days[0] ?? null;
  const [preview, setPreview] = useState<Stop[] | null>(null);
  const [openStop, setOpenStop] = useState<string | null>(null);
  // The stop whose "⋯" (move to another day, remove) is open.
  const [menuStop, setMenuStop] = useState<string | null>(null);
  // Dragging a stop by its ⋮⋮: where it started and where it would land.
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);
  const stopRefs = useRef<(HTMLLIElement | null)[]>([]);
  const listRef = useRef<HTMLOListElement>(null);
  // Arrival times are the traveller's own, and only when she wants them: hidden until opened.
  const [timesOpen, setTimesOpen] = useState(false);
  const [suggestion, setSuggestion] = useState<PlanResult | null>(null);
  // The stop just removed from the day, kept for a few seconds so it can be put back.
  const [undo, setUndo] = useState<{ dayId: string; savedPlaceId: string; index: number; durationMin: number | null; note: string | null; label: string } | null>(null);
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 9000);
    return () => clearTimeout(t);
  }, [undo]);

  const scheduledIds = useMemo(() => new Set(p.days.flatMap((d) => d.stops.map((s) => s.savedPlaceId))), [p.days]);
  // A place chosen as a day's starting point is not a stop to schedule.
  const startIds = useMemo(() => new Set(p.days.map((d) => d.startPlaceId).filter((x): x is string => !!x)), [p.days]);
  const unscheduled = p.places.filter((x) => !scheduledIds.has(x.id) && !startIds.has(x.id) && x.id !== p.hotel?.id);

  // ---------- the day's clock ----------
  const cur = p.days.find((d) => d.id === p.dayId) ?? p.days[0] ?? null;
  // Walking or driving between each pair of stops: both shown, the traveller picks, the clock follows.
  // Public transport between stops (bus, metro), asked once per pair of places and remembered.
  const transitCache = useRef(new Map<string, number | null>());
  const [transitTick, setTransitTick] = useState(0);
  const pairKey = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => `${a.lat.toFixed(5)},${a.lng.toFixed(5)}>${b.lat.toFixed(5)},${b.lng.toFixed(5)}`;
  useEffect(() => {
    if (!cur || p.mode === 'transit' || cur.stops.length > 13) return;
    const from = cur.startPlaceId ? p.byId.get(cur.startPlaceId) ?? null : null;
    const own = cur.stops.map((s) => p.byId.get(s.savedPlaceId)).filter((x): x is MapPlace => !!x);
    if (own.length !== cur.stops.length) return;
    const pts = from ? [from, ...own] : own;
    if (pts.length < 2) return;
    // Only worth asking when some leg is longer than a short walk.
    const need = pts.slice(0, -1).some((a, i) => {
      const d = distanceMeters(a, pts[i + 1]!);
      return d > 700 && d < 300000 && !transitCache.current.has(pairKey(a, pts[i + 1]!));
    });
    if (!need) return;
    let gone = false;
    (async () => {
      try {
        const res = await fetch('/api/routes/day', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ points: pts.map((x) => ({ lat: x.lat, lng: x.lng })), mode: 'transit' }),
        });
        const j = res.ok ? await res.json() as { legs?: { durationSec: number | null }[] } : null;
        pts.slice(0, -1).forEach((a, i) => transitCache.current.set(pairKey(a, pts[i + 1]!), j?.legs?.[i]?.durationSec ?? null));
        if (!gone) setTransitTick((t) => t + 1);
      } catch { /* no transit times: walking and driving still work */ }
    })();
    return () => { gone = true; };
  }, [cur, p.byId, p.mode]);

  const legOpts = useMemo<(LegOptions | null)[]>(() => {
    if (!cur || p.mode === 'transit') return [];
    const tripMode = p.mode;
    return cur.stops.slice(0, -1).map((s, i) => {
      const a = p.byId.get(s.savedPlaceId), b = p.byId.get(cur.stops[i + 1]!.savedPlaceId);
      if (!a || !b) return null;
      const d = distanceMeters(a, b);
      const tr = d > 700 && d < 300000 ? transitCache.current.get(pairKey(a, b)) ?? null : null;
      return legOptions(p.legs?.[i] ?? null, a, b, tripMode, s.transportToNext, tr);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, p.byId, p.legs, p.mode, transitTick]);
  // The same choice from the day's starting point to its first stop.
  const startOpt = useMemo<LegOptions | null>(() => {
    if (!cur || p.mode === 'transit' || !cur.startPlaceId || !cur.stops.length) return null;
    const tripMode = p.mode;
    const a = p.byId.get(cur.startPlaceId), b = p.byId.get(cur.stops[0]!.savedPlaceId);
    if (!a || !b) return null;
    const d = distanceMeters(a, b);
    const tr = d > 700 && d < 300000 ? transitCache.current.get(pairKey(a, b)) ?? null : null;
    return legOptions(p.startLeg, a, b, tripMode, cur.startTransport, tr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, p.byId, p.startLeg, p.mode, transitTick]);
  // Shabbat and festival times for this day, at the day's first place (or the trip's destination).
  const holy = useMemo(() => {
    if (!p.shabbat || !cur?.date) return null;
    const first = cur.stops.map((s) => p.byId.get(s.savedPlaceId)).find(Boolean);
    const at = first ?? p.center;
    return at ? shabbatInfo(cur.date, at.lat, at.lng) : null;
  }, [p.shabbat, p.center, p.byId, cur]);
  const legSec = (i: number): number | null => {
    const o = legOpts[i];
    if (o) return (o.chosen === 'transit' && o.transit ? o.transit : o.chosen === 'drive' && o.drive ? o.drive : o.walk!).sec;
    return p.legs?.[i]?.durationSec ?? null;
  };

  if (!p.days.length) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-line p-6 text-center">
        <p className="text-lg font-extrabold">עוד אין תאריכים</p>
        <p className="mt-1 text-ink-2">כשתוסיפו תאריכים בהגדרות הטיול, הימים ייווצרו לבד.</p>
        <a href={`/trips/${p.tripId}/settings`} className="mt-4 inline-block font-bold">להגדרות הטיול</a>
      </div>
    );
  }
  if (!day) return null;

  const stops = day.stops;
  const pt = (s: Stop) => p.byId.get(s.savedPlaceId);
  const legFor = (i: number): LegInfo => {
    const g = p.legs?.[i];
    if (g && g.durationSec !== null) return g;
    const a = pt(stops[i]!);
    const b = pt(stops[i + 1]!);
    return a && b ? { durationSec: null, distanceMeters: null } : { durationSec: null, distanceMeters: null };
  };
  const startPlace = day.startPlaceId ? p.byId.get(day.startPlaceId) ?? null : null;
  const allLegs = p.legs ? [...(startPlace && p.startLeg ? [p.startLeg] : []), ...p.legs] : null;
  const totalMeters = allLegs?.reduce((s, l) => s + (l.distanceMeters ?? 0), 0) ?? null;
  const totalMinutes = allLegs
    ? Math.round(((startPlace ? (startOpt ? (startOpt.chosen === 'transit' && startOpt.transit ? startOpt.transit : startOpt.chosen === 'drive' && startOpt.drive ? startOpt.drive : startOpt.walk!).sec : p.startLeg?.durationSec ?? 0) : 0) + stops.slice(0, -1).reduce((sum, _, i) => sum + (legSec(i) ?? 0), 0)) / 60)
    : null;

  // Arrival times are only the ones the traveller set. The stop right after one with a time gets a suggestion
  // ("set time + stay there + the way (walk / drive / transit)", rounded up to 5 minutes), shown only while
  // setting times; it is saved only when she taps it.
  const times: ({ time: string; est: boolean } | null)[] = (() => {
    let t: number | null = null;
    return stops.map((s, i) => {
      let r: { time: string; est: boolean } | null = null;
      if (s.plannedTime) { t = toMinutes(s.plannedTime); r = { time: s.plannedTime, est: false }; }
      else if (t !== null) r = { time: clock(t), est: true };
      // A suggestion only for the stop right after one with a time of its own.
      if (!s.plannedTime) t = null;
      if (t !== null && i < stops.length - 1) {
        const sec = legSec(i);
        t = sec === null ? null : Math.ceil((t + durationFor(pt(s)?.categoryKey ?? null, s.durationMin) + sec / 60) / 5) * 5;
      }
      return r;
    });
  })();

  // ---------- walking or driving to the next stop ----------
  const pickLeg = async (s: Stop, m: LegMode) => {
    const before = p.days;
    p.setDays((ds) => ds.map((d) => ({ ...d, stops: d.stops.map((x) => (x.id === s.id ? { ...x, transportToNext: m } : x)) })));
    const r = await p.act(() => plan.updateStop({ tripId: p.tripId, stopId: s.id, transportToNext: m }));
    if (!r) p.setDays(() => before);
  };

  const pickStartLeg = async (m: LegMode) => {
    if (!day) return;
    const before = p.days;
    p.setDays((ds) => ds.map((d) => (d.id === day.id ? { ...d, startTransport: m } : d)));
    const r = await p.act(() => plan.updateDay({ tripId: p.tripId, dayId: day.id, startTransport: m }));
    if (!r) p.setDays(() => before);
  };

  // ---------- order changes ----------
  const saveOrder = async (targetDay: PlanDay, ordered: Stop[], msg?: string) => {
    const before = p.days;
    p.setDays((ds) => ds.map((d) => {
      if (d.id === targetDay.id) return { ...d, stops: ordered.map((s, i) => ({ ...s, position: i + 1 })) };
      return { ...d, stops: d.stops.filter((s) => !ordered.some((o) => o.id === s.id)) };
    }));
    const r = await p.act(() => plan.setDayOrder({ tripId: p.tripId, dayId: targetDay.id, stopIds: ordered.map((s) => s.id) }), msg);
    if (!r) p.setDays(() => before);
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= stops.length || from === to) return;
    const next = [...stops];
    const [s] = next.splice(from, 1);
    next.splice(to, 0, s!);
    void saveOrder(day, next);
  };

  const moveToDay = (s: Stop, targetId: string) => {
    const target = p.days.find((d) => d.id === targetId);
    if (!target || target.id === day.id) return;
    void saveOrder(target, [...target.stops, s], `הועבר ליום ${target.dayIndex}`);
  };

  // The same place more than once in a day (back to the hotel at noon and again at night): a new stop
  // for the already-saved place, right after `afterIndex` (or at the end). Nothing is saved twice.
  const addAgain = async (savedPlaceId: string, afterIndex: number | null, msg: string) => {
    const atEnd = afterIndex === null || afterIndex >= stops.length - 1;
    const r = await p.act(() => plan.addStop({ tripId: p.tripId, dayId: day.id, savedPlaceId }), atEnd ? msg : undefined);
    if (!r) return;
    const fresh: Stop = { id: r.data, savedPlaceId, position: stops.length + 1, plannedTime: null, durationMin: null, note: null };
    const ordered = [...stops];
    ordered.splice(atEnd ? ordered.length : afterIndex! + 1, 0, fresh);
    if (atEnd) p.setDays((ds) => ds.map((d) => (d.id === day.id ? { ...d, stops: ordered.map((x, i) => ({ ...x, position: i + 1 })) } : d)));
    else await saveOrder(day, ordered, msg);
  };

  const removeStop = async (s: Stop) => {
    const r = await p.act(() => plan.removeStop({ tripId: p.tripId, stopId: s.id }), 'הוסר מהיום (נשאר ב"מה שמרתי")');
    if (!r) return;
    p.setDays((ds) => ds.map((d) => (d.id === day.id ? { ...d, stops: d.stops.filter((x) => x.id !== s.id) } : d)));
    setUndo({ dayId: day.id, savedPlaceId: s.savedPlaceId, index: stops.findIndex((x) => x.id === s.id), durationMin: s.durationMin, note: s.note, label: pt(s)?.label ?? 'המקום' });
    await p.reload(); // the place's status may have changed
  };

  /** Puts the removed stop back where it was, with its stay time and note. */
  const undoRemove = async () => {
    const u = undo;
    if (!u || u.dayId !== day.id) return;
    setUndo(null);
    const r = await p.act(() => plan.addStop({ tripId: p.tripId, dayId: day.id, savedPlaceId: u.savedPlaceId }));
    if (!r) return;
    if (u.durationMin !== null || u.note) await plan.updateStop({ tripId: p.tripId, stopId: r.data, durationMin: u.durationMin, note: u.note });
    const fresh: Stop = { id: r.data, savedPlaceId: u.savedPlaceId, position: 0, plannedTime: null, durationMin: u.durationMin, note: u.note };
    const ordered = [...stops];
    ordered.splice(Math.min(Math.max(0, u.index), ordered.length), 0, fresh);
    await saveOrder(day, ordered, `${u.label} חזר ליום`);
    await p.reload();
  };

  // "This or that": a second place for the same slot, decided on the day itself.
  const altAct = async (fn: () => Promise<{ ok: true; data: null } | { ok: false; error: string }>, msg: string) => {
    if (await p.act(fn, msg)) await p.reload();
  };
  const updateStop = async (s: Stop, patch: { plannedTime?: string | null; durationMin?: number | null; note?: string | null }) => {
    const r = await p.act(() => plan.updateStop({ tripId: p.tripId, stopId: s.id, ...patch }));
    if (r) p.setDays((ds) => ds.map((d) => ({ ...d, stops: d.stops.map((x) => (x.id === s.id ? { ...x, ...patch } : x)) })));
  };

  /** The start point is where the day begins, so it is not also one of its stops. */
  const chooseStart = async (id: string | null) => {
    const dup = id ? stops.find((s) => s.savedPlaceId === id) : undefined;
    if (dup) {
      const r = await p.act(() => plan.removeStop({ tripId: p.tripId, stopId: dup.id }));
      if (!r) return;
      p.setDays((ds) => ds.map((d) => (d.id === day.id ? { ...d, stops: d.stops.filter((x) => x.id !== dup.id) } : d)));
    }
    await updateDay({ startPlaceId: id });
  };

  const updateDay = async (patch: { title?: string | null; startTime?: string | null; startPlaceId?: string | null; notes?: string | null }) => {
    const r = await p.act(() => plan.updateDay({ tripId: p.tripId, dayId: day.id, ...patch }));
    if (r) p.setDays((ds) => ds.map((d) => (d.id === day.id ? { ...d, ...patch } : d)));
  };

  // ---------- helpers ----------
  const points = stops.map((s) => ({ ...pt(s)!, id: s.id })).filter((x) => x.lat !== undefined);
  const startFrom = startPlace ?? p.hotel;
  const start = startFrom ? { lat: startFrom.lat, lng: startFrom.lng } : null;

  const suggestOrder = () => {
    const best = optimizeOrder(points, start);
    const same = best.every((b, i) => b.id === stops[i]?.id);
    if (same) return setPreview([]);
    setPreview(best.map((b) => stops.find((s) => s.id === b.id)!));
  };
  const saving = preview && preview.length
    ? routeLength(points, start) - routeLength(preview.map((s) => ({ ...pt(s)!, id: s.id })), start)
    : 0;

  const suggestPlan = async (useAi: boolean) => {
    const r = await p.act(() => plan.suggestDayPlan({ tripId: p.tripId, useAi }));
    if (r) setSuggestion(r.data);
  };
  const applySuggestion = async () => {
    if (!suggestion) return;
    const idOf = new Map(p.days.map((d) => [d.dayIndex, d.id]));
    const assignments = suggestion.assignments
      .filter((a) => idOf.has(a.dayIndex))
      .map((a) => ({ dayId: idOf.get(a.dayIndex)!, savedPlaceIds: a.placeIds }));
    const r = await p.act(() => plan.applyDayPlan({ tripId: p.tripId, assignments }));
    if (r) {
      setSuggestion(null);
      await p.reload();
    }
  };


  // ---------- reordering by dragging ⋮⋮ (finger or mouse) ----------
  const dragAt = (y: number) => {
    if (!drag) return;
    const rects = stopRefs.current.slice(0, stops.length).map((el) => el?.getBoundingClientRect() ?? null);
    const to = rects.filter((r, k) => r && k !== drag.from && r.top + r.height / 2 < y).length;
    if (to !== drag.to) setDrag({ ...drag, to });
    // Near the top or bottom edge: scroll the list (the side panel on a computer, the page on a phone).
    const pane = listRef.current?.closest('aside');
    const scroller: { scrollBy: (x: number, y: number) => void } = pane && pane.scrollHeight > pane.clientHeight ? pane : window;
    if (y < 90) scroller.scrollBy(0, -14);
    else if (y > window.innerHeight - 90) scroller.scrollBy(0, 14);
  };
  const dragEnd = () => {
    if (drag && drag.to !== drag.from) move(drag.from, drag.to);
    setDrag(null);
  };
  const legLine = (content: ReactNode) => content
    ? <div className="py-1 pr-11 text-xs font-semibold text-ink-2">{content}</div>
    : <div className="h-2" aria-hidden="true" />;

  return (
    <div className="flex flex-col gap-3">
      {/* the trip's pace and auto-scheduling: one short line, the rest inside */}
      {p.onPace && (
        <details className="group" data-tour="d-pace-row">
          <summary className={foldRow}>קצב: {paceInfo(pace).label} <Chevron /></summary>
          <div className="mt-1 flex flex-col gap-2 rounded-2xl border border-line bg-white p-3">
            <div className="flex items-center gap-2" data-tour="d-pace">
              <div role="radiogroup" aria-label="קצב הטיול" className="flex flex-1 gap-1 rounded-full bg-sand p-1">
                {PACES.map((x) => (
                  <button key={x.key} type="button" role="radio" aria-checked={pace === x.key} disabled={p.busy} onClick={() => pace !== x.key && p.onPace!(x.key)}
                    className={`min-h-10 flex-1 rounded-full text-sm font-bold ${pace === x.key ? 'bg-terracotta text-white' : 'text-ink-2'}`}>
                    {x.emoji} {x.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-ink-2">{paceInfo(pace).hint}. יום הנחיתה ויום הטיסה הביתה מקבלים חצי. ארוחות נחשבות חצי.</p>
            {p.onAutoAssign && (
              <label className="flex min-h-10 items-center gap-2 text-sm font-bold" data-tour="d-auto">
                <input type="checkbox" checked={!!p.autoAssign} disabled={p.busy} onChange={(e) => p.onAutoAssign!(e.target.checked)} className="h-5 w-5 shrink-0" />
                כששומרים מקום: לשאול לאיזה יום לשבץ אותו (עם הצעה לפי האזור)
              </label>
            )}
          </div>
        </details>
      )}
      {/* Pace switched off (src/lib/features.ts): the "which day?" checkbox stays, on its own short line. */}
      {!p.onPace && p.onAutoAssign && (
        <label className="flex min-h-10 items-center gap-2 text-sm font-semibold text-ink-2" data-tour="d-auto-ask">
          <input type="checkbox" checked={!!p.autoAssign} disabled={p.busy} onChange={(e) => p.onAutoAssign!(e.target.checked)} className="h-5 w-5 shrink-0" />
          לשאול לאיזה יום לשבץ כל מקום שנשמר
        </label>
      )}

      {/* day chips */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="ימי הטיול" data-tour="d-chips">
        {p.days.filter((d) => !p.visibleDayIds || p.visibleDayIds.has(d.id)).map((d) => {
          const active = d.id === day.id;
          return (
            <button key={d.id} type="button" role="tab" aria-selected={active} onClick={() => { p.setDayId(d.id); setPreview(null); }}
              className={`flex min-w-[76px] shrink-0 flex-col items-center rounded-xl border px-3 py-1.5 ${active ? 'border-terracotta bg-terracotta text-white' : 'border-line bg-white'}`}>
              <span className="text-sm font-extrabold">יום {d.dayIndex}</span>
              <span className={`text-xs font-semibold ${active ? 'text-white/80' : 'text-muted'}`}>
                {d.date ? d.date.slice(8, 10) + '.' + d.date.slice(5, 7) : '—'} · {d.stops.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* day header */}
      <div className="flex flex-col gap-2">
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-bold">יום {day.dayIndex}{day.date && ` · ${formatDayHe(day.date)}`}{day.title && <span className="text-ink-2"> · {day.title}</span>}</h2>
          <p className="text-sm font-semibold text-ink-2">
            {stops.length === 0 ? 'עוד ריק' : `${stops.length} תחנות`}
            {totalMeters !== null && (allLegs?.length ?? 0) > 0 && ` · ${km(totalMeters)} · כ-${totalMinutes} דק׳ ${p.mode === 'walk' ? 'הליכה' : p.mode === 'transit' ? 'בדרכים' : 'נסיעה'}`}
          </p>
        </div>
        {/* Name, start point and note: folded to one line until tapped. */}
        <details className="group" data-tour="d-more">
          <summary className={foldRow}>
            ⚙️ שם, נקודת יציאה והערה <Chevron />
            {day.notes && <span className="min-w-0 truncate font-normal text-muted">· ✎ {day.notes}</span>}
          </summary>
          <div className="mt-1 flex flex-col gap-2 rounded-2xl border border-line bg-white p-3">
            <div data-tour="d-name">
              <label className="sr-only" htmlFor={`title-${day.id}`}>שם ליום</label>
              <input id={`title-${day.id}`} key={`t-${day.id}`} defaultValue={day.title ?? ''} maxLength={120} placeholder="שם ליום (למשל: מרכז העיר)"
                onBlur={(e) => e.target.value.trim() !== (day.title ?? '') && updateDay({ title: e.target.value })}
                className="h-10 w-full rounded-lg border border-line bg-white px-3 text-base" />
            </div>
            <label className="flex items-center gap-2 text-sm font-bold" data-tour="d-start">נקודת יציאה
              <select value={day.startPlaceId ?? ''} disabled={p.busy} aria-label="נקודת היציאה של היום"
                onChange={(e) => chooseStart(e.target.value || null)}
                className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-white px-2 text-base font-normal">
                <option value="">בלי (היום מתחיל בתחנה הראשונה)</option>
                {p.hotel && <option value={p.hotel.id}>המלון: {p.hotel.label}</option>}
                {p.places.filter((x) => x.id !== p.hotel?.id).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-bold" data-tour="d-note">הערה ליום
              <textarea key={`n-${day.id}`} defaultValue={day.notes ?? ''} maxLength={2000} rows={2} placeholder="מה חשוב לזכור ביום הזה? למשל: להזמין מקום למסעדה, לקחת בגד ים"
                onBlur={(e) => e.target.value.trim() !== (day.notes ?? '') && updateDay({ notes: e.target.value.trim() || null })}
                className="rounded-lg border border-line bg-white px-3 py-2 text-base font-normal" />
            </label>
          </div>
        </details>
        {/* The day's main action in blue; times and the map as small text beside it. */}
        {stops.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {stops.length > 1 && (
              <button type="button" data-tour="d-order" disabled={p.busy} onClick={suggestOrder}
                className="min-h-10 rounded-xl bg-terracotta px-4 text-sm font-bold text-white shadow-[0_6px_16px_-8px_rgba(27,115,201,.8)] hover:bg-[#135CA6] disabled:opacity-60">✦ סדר את היום</button>
            )}
            <button type="button" data-tour="d-times" aria-pressed={timesOpen}
              onClick={() => { (document.activeElement as HTMLElement | null)?.blur?.(); setTimesOpen((v) => !v); }}
              className={`min-h-10 text-sm font-bold ${timesOpen ? 'text-ink underline' : 'text-ink-2 hover:text-ink'}`}>
              🕐 {timesOpen ? 'סיום קביעת שעות' : 'לקבוע שעות'}
            </button>
            <button type="button" onClick={p.onShowDayOnMap} data-tour="d-map" className="min-h-10 text-sm font-bold text-ink-2 hover:text-ink lg:hidden">🗺️ היום במפה</button>
          </div>
        )}
        {timesOpen && stops.length > 0 && (
          <p className="text-xs text-ink-2">כותבים שעת הגעה רק למקומות שרוצים (למשל צ׳ק-אין במלון או הזמנה במסעדה). שאר המקומות נשארים בלי שעה. אחרי מקום עם שעה מופיעה ליד המקום הבא הצעה לפי זמן השהייה והדרך שבחרת, ולחיצה על "לקבוע" שומרת אותה.</p>
        )}
      </div>

      {preview && (
        <div className="rounded-2xl border border-sea bg-sea-tint p-4" role="status">
          {preview.length === 0 ? (
            <p className="font-bold text-sea">הסדר הנוכחי כבר הקצר ביותר שמצאנו.</p>
          ) : (
            <>
              <p className="font-bold text-sea">סדר חדש{startPlace ? ', מנקודת היציאה' : p.hotel ? ', מהמלון' : ''}, חוסך כ-{km(Math.max(0, saving))} של הליכה:</p>
              <ol className="mt-2 list-decimal pr-5 text-sm">{preview.map((s) => <li key={s.id}>{pt(s)?.label}</li>)}</ol>
              <p className="mt-2 text-xs text-ink-2">לפי מרחק בקו ישר.</p>
              <div className="mt-3 flex gap-2">
                <button type="button" disabled={p.busy} onClick={async () => { await saveOrder(day, preview, 'הסדר החדש נשמר'); setPreview(null); }}
                  className="min-h-10 rounded-lg bg-sea px-4 text-sm font-bold text-white">שמירת הסדר</button>
                <button type="button" onClick={() => setPreview(null)} className="min-h-10 rounded-lg px-3 text-sm font-bold">ביטול</button>
              </div>
            </>
          )}
          {preview.length === 0 && <button type="button" onClick={() => setPreview(null)} className="mt-2 min-h-10 text-sm font-bold">סגירה</button>}
        </div>
      )}

      {undo && undo.dayId === day.id && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-xl bg-ink px-4 py-2.5 text-sm font-bold text-white">
          <span className="min-w-0 truncate">{undo.label} הוסר מהיום</span>
          <button type="button" disabled={p.busy} onClick={undoRemove} className="min-h-10 shrink-0 rounded-full bg-white px-4 text-ink">ביטול</button>
        </div>
      )}

      {holy && (
        <p role="status" data-tour="shabbat-day" className="rounded-2xl border border-[#BFD9F2] bg-[#F1F7FD] px-3.5 py-2.5 text-sm font-bold text-[#0B3D6E]">
          🕯️ {shabbatLineHe(holy)} <span className="font-normal">תחנות שנופלות בזמן הזה מסומנות.</span>
        </p>
      )}

      {/* stops */}
      {stops.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-line p-5 text-center text-ink-2">
          חפשו מקום בשורת החיפוש למעלה, או לחצו '+ ליום' ליד מקום ששמרתם.
        </p>
      ) : (
        <div>
        {(() => {
          const pos = p.days.findIndex((d) => d.id === day.id);
          const cap = dayCapacity(pace, pos, p.days.length);
          const w = dayWeight(stops.map((s) => ({ categoryKey: pt(s)?.categoryKey ?? null })));
          if (pace === 'relaxed' && w <= cap - 1) return (
            <p className="mb-3 rounded-2xl bg-[#E8F5EC] px-3.5 py-2.5 text-sm font-bold text-[#24613A]">🏖️ נשאר זמן חופשי ביום הזה: לים, לספא או סתם לשבת על קפה.</p>
          );
          return null;
        })()}
        {startPlace && (
          <div>
            <div className="flex items-center gap-2.5 rounded-2xl border border-dashed border-line bg-white p-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sand-2 text-base font-extrabold text-ink-2" aria-hidden="true">⌂</span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-ink-2">נקודת יציאה</div>
                <div className="truncate font-extrabold">{startPlace.label}</div>
              </div>
            </div>
            {legLine(startOpt ? <LegChoice o={startOpt} loading={!p.startLeg} disabled={p.busy} onPick={pickStartLeg} />
              : p.startLeg ? describeLegHe(p.startLeg, p.mode) : null)}
          </div>
        )}
        <ol ref={listRef} className="flex flex-col" aria-label={`תחנות יום ${day.dayIndex}`}>
          {stops.map((s, i) => {
            const x = pt(s);
            const meta = categoryMeta(x?.categoryKey);
            const isOpen = openStop === s.id;
            const menuOpen = menuStop === s.id;
            const dragging = drag?.from === i;
            // Where the dragged stop would land: a line above (moving up) or below (moving down) this stop.
            const landAbove = !!drag && drag.to !== drag.from && drag.to === i && drag.to < drag.from;
            const landBelow = !!drag && drag.to !== drag.from && drag.to === i && drag.to > drag.from;
            return (
              <li key={s.id} ref={(el) => { stopRefs.current[i] = el; }}
                className={`${landAbove ? 'border-t-[3px] border-terracotta pt-1' : ''} ${landBelow ? 'border-b-[3px] border-terracotta pb-1' : ''}`}>
                <div data-tour={i === 0 ? 'd-stop' : undefined}
                  className={`flex items-center gap-2 rounded-2xl border bg-white py-1.5 pr-2.5 pl-1 ${isOpen || menuOpen ? 'border-ink' : 'border-line'} ${dragging ? 'opacity-60 shadow-lg' : ''}`}>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white" style={{ background: meta.color }}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {!timesOpen && s.plannedTime && (
                        <span className="shrink-0 rounded-md bg-sand px-2 py-0.5 text-sm font-extrabold" dir="ltr" title="שעת ההגעה שקבעת">{s.plannedTime}</span>
                      )}
                      <button type="button" onClick={() => { setOpenStop(isOpen ? null : s.id); setMenuStop(null); }} aria-expanded={isOpen}
                        className="min-h-10 min-w-0 flex-1 break-words text-right leading-snug [overflow-wrap:anywhere]">
                        <span className="block font-extrabold">{x?.label ?? 'מקום שהוסר'}</span>
                        <span className="block text-xs font-normal text-ink-2">{meta.name}{s.note && <> · ✎ {s.note}</>}</span>
                      </button>
                      {insideShabbat(holy, s.plannedTime ?? undefined) && (
                        <span className="shrink-0 rounded-full bg-[#E4EEFA] px-2 py-0.5 text-xs font-bold text-[#0B3D6E]">בזמן {holy!.name}</span>
                      )}
                      {p.closedIds?.has(s.savedPlaceId) && (
                        <span className="shrink-0 rounded-full bg-[#FDECEA] px-2 py-0.5 text-xs font-bold text-[#B42318]" title="לפי שעות הפתיחה ב-Google">סגור ביום הזה</span>
                      )}
                    </div>
                    {timesOpen && (
                      <div className="mb-1 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs font-bold">
                        <label className="flex flex-wrap items-center gap-2">שעת הגעה
                          <TimeField value={s.plannedTime} onSave={(v) => updateStop(s, { plannedTime: v })} />
                          {s.plannedTime && (
                            <button type="button" disabled={p.busy} onClick={() => updateStop(s, { plannedTime: null })} className="min-h-10 px-1.5 text-xs font-bold text-[#B42318]">בלי שעה</button>
                          )}
                        </label>
                        {times[i]?.est && (
                          <button type="button" disabled={p.busy} onClick={() => updateStop(s, { plannedTime: times[i]!.time })}
                            title="לפי השעה שקבעת קודם, השהייה שם והדרך" className="min-h-10 rounded-md border border-dashed border-line bg-white px-2.5 text-xs font-bold text-ink-2 hover:border-ink">
                            הצעה: <span dir="ltr">~{times[i]!.time}</span> · לקבוע
                          </button>
                        )}
                        {s.plannedTime && i < stops.length - 1 && (
                          <label className="flex items-center gap-1.5">שהייה
                            <select value={durationFor(x?.categoryKey ?? null, s.durationMin)} disabled={p.busy}
                              onChange={(e) => updateStop(s, { durationMin: Number(e.target.value) })}
                              className="h-10 rounded-md border border-line bg-white px-1.5 text-base font-bold">
                              {stayOptions(durationFor(x?.categoryKey ?? null, s.durationMin)).map((m) => <option key={m} value={m}>{hm(m)}</option>)}
                            </select>
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                  <button type="button" aria-expanded={menuOpen} aria-label={`עוד: ${x?.label ?? 'התחנה'}`} data-tour={i === 0 ? 'd-stop-more' : undefined}
                    onClick={() => { setMenuStop(menuOpen ? null : s.id); setOpenStop(null); }}
                    className="h-10 w-9 shrink-0 rounded-lg text-lg font-bold text-ink-2 hover:bg-sand">⋯</button>
                  <button type="button" aria-label={`גרירה לשינוי הסדר: ${x?.label ?? 'התחנה'} (או חיצים במקלדת)`} data-tour={i === 0 ? 'd-drag' : undefined}
                    disabled={p.busy || stops.length < 2}
                    onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); setDrag({ from: i, to: i }); }}
                    onPointerMove={(e) => dragAt(e.clientY)}
                    onPointerUp={dragEnd}
                    onPointerCancel={() => setDrag(null)}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowUp') { e.preventDefault(); move(i, i - 1); }
                      if (e.key === 'ArrowDown') { e.preventDefault(); move(i, i + 1); }
                    }}
                    className="flex h-10 w-7 shrink-0 cursor-grab touch-none select-none items-center justify-center rounded-lg text-base font-bold tracking-[-0.2em] text-muted hover:bg-sand active:cursor-grabbing disabled:opacity-30">
                    ⋮⋮
                  </button>
                </div>

                {menuOpen && (
                  <div className="mx-2 flex flex-wrap items-center gap-2 rounded-b-xl border border-t-0 border-line bg-sand p-2.5 text-sm" role="group" aria-label={`פעולות: ${x?.label ?? 'התחנה'}`}>
                    {p.days.length > 1 && (
                      <select value="" onChange={(e) => { if (e.target.value) { moveToDay(s, e.target.value); setMenuStop(null); } }} aria-label="הזזה ליום אחר"
                        className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-white px-2 text-base font-bold">
                        <option value="">הזזה ליום אחר…</option>
                        {p.days.filter((d) => d.id !== day.id).map((d) => <option key={d.id} value={d.id}>יום {d.dayIndex}{d.date ? ` · ${formatDayHe(d.date)}` : ''}</option>)}
                      </select>
                    )}
                    <button type="button" disabled={p.busy} onClick={() => { setMenuStop(null); void removeStop(s); }}
                      className="min-h-10 rounded-lg px-3 font-bold text-[#B42318] hover:bg-white">הסרה מהיום</button>
                  </div>
                )}

                {(s.alts?.length ?? 0) > 0 && (
                  <div className="mx-2 flex flex-col gap-1.5 rounded-b-xl border border-t-0 border-[#F2C46D] bg-[#FFF8EA] p-2.5 text-sm" data-tour="d-alt">
                    <p className="font-bold">🤔 מתלבטת? באותו זמן אפשר גם:</p>
                    {s.alts!.map((a) => {
                      const ap = p.byId.get(a.savedPlaceId);
                      return (
                        <div key={a.id} className="flex items-center gap-2">
                          <button type="button" onClick={() => ap && p.onShowOnMap(ap.googlePlaceId)} className="min-w-0 flex-1 truncate text-right font-extrabold">{ap?.label ?? 'מקום שהוסר'}</button>
                          <button type="button" disabled={p.busy} onClick={() => altAct(() => plan.chooseAlt({ tripId: p.tripId, stopId: s.id, altId: a.id }), `בחרת ב${ap?.label ?? 'מקום הזה'}`)}
                            className="min-h-9 shrink-0 rounded-full bg-terracotta px-3 text-xs font-bold text-white disabled:opacity-50">בחרתי בזה</button>
                          <button type="button" disabled={p.busy} aria-label={`הסרת החלופה ${ap?.label ?? ''}`} onClick={() => altAct(() => plan.removeAlt({ tripId: p.tripId, altId: a.id }), 'החלופה הוסרה')}
                            className="h-9 w-9 shrink-0 rounded text-[#B42318] hover:bg-white disabled:opacity-30">✕</button>
                        </div>
                      );
                    })}
                    <button type="button" disabled={p.busy} onClick={() => altAct(() => plan.chooseAlt({ tripId: p.tripId, stopId: s.id, altId: null }), `נשארת עם ${x?.label ?? 'התחנה'}`)}
                      className="min-h-9 self-start rounded-full border border-line bg-white px-3 text-xs font-bold disabled:opacity-50">נשארת עם {x?.label ?? 'התחנה'}</button>
                    <p className="text-xs text-ink-2">המסלול מחושב לפי {x?.label ?? 'התחנה'}. מי שלא נבחר יורד מהיום ונשאר בשמורים.</p>
                  </div>
                )}

                {isOpen && (
                  <div className="mx-2 flex flex-col gap-2 rounded-b-xl border border-t-0 border-line bg-sand p-3 text-sm">
                    <label className="flex flex-col gap-1 font-bold">הערה ליום הזה
                      <input defaultValue={s.note ?? ''} maxLength={2000} placeholder="למשל: כרטיסים בקופה 2"
                        onBlur={(e) => e.target.value.trim() !== (s.note ?? '') && updateStop(s, { note: e.target.value })}
                        className="h-10 rounded-md border border-line bg-white px-2 text-base font-normal" />
                    </label>
                    {FEATURES.alternatives && <label className="flex flex-col gap-1 font-bold" data-tour="d-alt-add">מתלבטת בין המקום הזה למקום אחר?
                      <select value="" disabled={p.busy} onChange={(e) => e.target.value && altAct(() => plan.addAlt({ tripId: p.tripId, stopId: s.id, savedPlaceId: e.target.value }), 'נוספה חלופה לאותו זמן')}
                        className="h-10 rounded-md border border-line bg-white px-2 text-base font-normal">
                        <option value="">הוספת מקום חלופי לאותו זמן…</option>
                        {p.places.filter((pl) => pl.id !== s.savedPlaceId && !s.alts?.some((a) => a.savedPlaceId === pl.id)).map((pl) => <option key={pl.id} value={pl.id}>{pl.label}</option>)}
                      </select>
                      <span className="text-xs font-normal text-ink-2">שני המקומות יופיעו יחד, ובזמן הטיול בוחרים לאן הולכים.</span>
                    </label>}
                    <div className="flex flex-wrap items-center gap-2">
                      {x && <button type="button" onClick={() => p.onShowOnMap(x.googlePlaceId)} className="min-h-10 rounded-md border border-line bg-white px-3 font-bold">במפה</button>}
                      <button type="button" disabled={p.busy} onClick={() => addAgain(s.savedPlaceId, i, `${x?.label ?? 'המקום'} נוסף שוב ליום`)}
                        className="min-h-10 rounded-md border border-line bg-white px-3 font-bold">הוספה שוב אחרי זה</button>
                    </div>
                  </div>
                )}

                {i < stops.length - 1 && legLine((() => {
                  const o = legOpts[i];
                  if (o) return <LegChoice o={o} loading={!p.legs} disabled={p.busy} onPick={(m) => pickLeg(s, m)} />;
                  if (!p.legs) return null;
                  return describeLegHe(legFor(i), p.mode);
                })())}
              </li>
            );
          })}
        </ol>
        {p.hotel && (
          <button type="button" data-tour="d-hotel" disabled={p.busy} onClick={() => addAgain(p.hotel!.id, null, 'החזרה למלון נוספה ליום. אפשר לגרור אותה (⋮⋮) למקום הנכון')}
            className="mt-2 flex min-h-10 items-center gap-1.5 text-sm font-bold text-ink-2 hover:text-ink">
            <span aria-hidden="true">🏨</span> + חזרה למלון ({p.hotel.label})
          </button>
        )}
        </div>
      )}

      {p.afterStops}

      {/* unscheduled: one line until tapped */}
      {unscheduled.length > 0 && (
        <details className="group mt-1" data-tour="d-unscheduled">
          <summary className={`${foldRow} min-h-11 rounded-xl border border-line bg-white px-3 text-ink`}>
            📌 {unscheduled.length === 1 ? 'מקום אחד שעוד לא שובץ' : `${unscheduled.length} מקומות שעוד לא שובצו`} <Chevron />
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={p.busy} onClick={() => suggestPlan(false)} className="min-h-10 rounded-xl border border-line bg-white px-3.5 text-sm font-bold hover:bg-sand disabled:opacity-60">
                חלוקה אוטומטית לפי אזורים
              </button>
              {p.aiAvailable && (
                <button type="button" disabled={p.busy} onClick={() => suggestPlan(true)} className="min-h-10 rounded-xl border border-line bg-white px-3.5 text-sm font-bold hover:bg-sand disabled:opacity-60">
                  ✦ חלוקה חכמה (AI)
                </button>
              )}
            </div>
            {suggestion && (
              <div className="rounded-2xl border border-ink bg-white p-4">
                <p className="font-extrabold">{suggestion.source === 'ai' ? 'הצעה של ה-AI' : 'הצעה לפי אזורים במפה'}</p>
                {suggestion.note && <p className="mt-1 text-sm text-ink-2">{suggestion.note}</p>}
                <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                  {suggestion.assignments.map((a) => (
                    <li key={a.dayIndex}><b>יום {a.dayIndex}:</b> {a.placeIds.map((id) => p.byId.get(id)?.label).filter(Boolean).join(' · ')}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted">רק המקומות ששמרת. שום דבר לא נשמר עד שלוחצים "שיבוץ".</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" disabled={p.busy} onClick={applySuggestion} className="min-h-10 rounded-lg bg-terracotta px-4 text-sm font-bold text-white">שיבוץ</button>
                  <button type="button" onClick={() => setSuggestion(null)} className="min-h-10 px-3 text-sm font-bold">ביטול</button>
                </div>
              </div>
            )}
            <ul className="flex flex-col gap-1.5">
              {unscheduled.map((x) => <UnscheduledRow key={x.id} x={x} day={day} busy={p.busy} addToDay={p.addToDay} onNote={p.onNote} onRemove={p.onRemove} />)}
            </ul>
          </div>
        </details>
      )}
    </div>
  );
}

/**
 * An arrival time the traveller types. Saved as soon as it is a full time (and again when leaving the
 * field), so closing "לקבוע שעות" or tapping elsewhere on a phone never loses it.
 */
function TimeField({ value, onSave }: { value: string | null; onSave: (v: string | null) => Promise<unknown> | void }) {
  const [v, setV] = useState(value ?? '');
  const saved = useRef(value ?? '');
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => { saved.current = value ?? ''; setV(value ?? ''); }, [value]);
  const save = (next: string) => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    if (next === saved.current) return;
    saved.current = next;
    void onSave(next || null);
  };
  // Leaving (e.g. "סיום קביעת שעות" right after picking a time): a time still waiting is saved now.
  const latest = useRef(v);
  latest.current = v;
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => () => { if (timer.current !== undefined) saveRef.current(latest.current); }, []);
  return (
    <input type="time" dir="ltr" value={v} aria-label="שעת הגעה"
      onChange={(e) => {
        const next = e.target.value;
        setV(next);
        window.clearTimeout(timer.current);
        if (/^\d{2}:\d{2}$/.test(next) || next === '') timer.current = window.setTimeout(() => save(next), 700);
      }}
      onBlur={(e) => save(e.target.value)}
      className="h-10 w-28 shrink-0 rounded-md border border-line bg-white px-2 text-base" />
  );
}

const LEG_LOOK: Record<LegMode, { icon: string; label: string }> = {
  walk: { icon: '🚶', label: 'הליכה' }, drive: { icon: '🚗', label: 'נסיעה' }, transit: { icon: '🚇', label: 'תחב״צ' },
};

/**
 * The way to the next stop: one thin gray line with the chosen way and its time ("🚶 9 דק׳").
 * Tapping it shows the other ways (walk, drive, transit); the chosen one sets the times. "~" marks an estimate.
 */
function LegChoice({ o, loading, disabled, onPick }: { o: LegOptions; loading: boolean; disabled: boolean; onPick: (m: LegMode) => void }) {
  const [open, setOpen] = useState(false);
  const opt = (m: LegMode) => (m === 'walk' ? o.walk : m === 'drive' ? o.drive : o.transit);
  const chosen: LegMode = opt(o.chosen) ? o.chosen : 'walk';
  const cur = opt(chosen);
  if (!cur) return null;
  const time = (x: { sec: number; exact: boolean }) => `${x.exact || loading ? '' : '~'}${shortDurationHe(x.sec)}`;
  const ways = (['walk', 'drive', 'transit'] as LegMode[]).filter((m) => opt(m));
  return (
    <span data-tour="d-leg" className="flex flex-wrap items-center gap-1.5">
      <button type="button" aria-expanded={open} disabled={ways.length < 2} onClick={() => setOpen((v) => !v)}
        aria-label={`הדרך לתחנה הבאה: ${LEG_LOOK[chosen].label} ${time(cur)}${ways.length > 1 ? '. לחיצה להחלפה' : ''}`}
        className="relative inline-flex min-h-7 items-center gap-1 text-xs font-semibold text-ink-2 after:absolute after:-inset-x-2 after:-inset-y-1.5 after:content-[''] hover:text-ink disabled:cursor-default">
        <span aria-hidden="true">{LEG_LOOK[chosen].icon}</span> {time(cur)}
        {ways.length > 1 && <span aria-hidden="true" className={`text-[10px] transition-transform ${open ? 'rotate-90' : ''}`}>▸</span>}
      </button>
      {open && ways.map((m) => {
        const on = m === chosen;
        return (
          <button key={m} type="button" disabled={disabled} aria-pressed={on} onClick={() => { if (!on) onPick(m); setOpen(false); }}
            className={`inline-flex min-h-9 items-center gap-1 rounded-full border px-2.5 text-xs font-bold ${on ? 'border-terracotta bg-terracotta text-white' : 'border-line bg-white text-ink-2 hover:border-ink'}`}>
            <span aria-hidden="true">{LEG_LOOK[m].icon}</span>{LEG_LOOK[m].label} {time(opt(m)!)}
          </button>
        );
      })}
    </span>
  );
}
