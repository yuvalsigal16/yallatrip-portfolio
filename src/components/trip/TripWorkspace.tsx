'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TripMap, type AlongMarker, type DayRouteView, type OverviewDay, type Selected } from '@/components/map/TripMap';
import { PlaceSearch } from '@/components/map/PlaceSearch';
import type { CardActions } from '@/components/map/PlaceCard';
import { SavedPanel } from './SavedPanel';
import { DaysPlanner, type LegInfo } from './DaysPlanner';
import { HereButton } from './HereButton';
import { PlanGate, type PlanAccess } from '@/components/PlanGate';
import { AlongRoute } from './AlongRoute';
import { ChaptersStrip } from './ChaptersStrip';
import { chapterOfDate } from '@/lib/trips/chapters';
import type { TripLeg } from '@/lib/trips/rules';
import { KidsToggle, NowButton } from './Suggestions';
import { paceOf, pickDay, type Pace } from '@/lib/planning/pace';
import { setTripAutoAssign, setTripKids, setTripPace, setTripShabbat, tradeLegNight } from '@/app/trips/album-actions';
import { closedOn, weekdayOf, WEEKDAYS_HE } from '@/lib/planning/rules';
import type { MapPlace } from '@/lib/places/queries';
import type { PlanDay } from '@/lib/planning/queries';
import type { CategoryKey } from '@/lib/places/categories';
import { decodePolyline, describeLegHe, primaryMode } from '@/lib/planning/rules';
import { formatDayHe } from '@/lib/trips/rules';
import { removeSavedPlace, savePlaceToTrip, setPlaceCategory, setTripHotel } from '@/app/trips/places-actions';
import * as plan from '@/app/trips/plan-actions';
import { CoachTour } from '@/components/tour/CoachTour';
import type { TourKind } from '@/components/tour/steps';
import { FEATURES } from '@/lib/features';
import { offerInstall } from '@/components/pwa/Install';

export type Tab = 'map' | 'days';

type Props = {
  tripId: string;
  destinationName: string;
  center: { lat: number; lng: number } | null;
  transportModes: string[];
  initialPlaces: MapPlace[];
  initialDays: PlanDay[];
  hotelId: string | null;
  tab: Tab;
  initialSelected: string | null;
  initialDayId: string | null;
  apiKey: string;
  mapId: string;
  aiAvailable: boolean;
  travelStyles: string[];
  withKids?: boolean;
  keepsShabbat?: boolean;
  /** The traveller keeps kosher (opening questions / profile): kosher food first on a place card. */
  keepsKosher?: boolean;
  /** The paid-plan tools (what now, I'm here): open, marked "⭐ במנוי", or behind "זה חלק מהמנוי". */
  plan?: PlanAccess;
  /** This is the traveller's first trip: "תוכניות ומחירים" shows once, when its fifth place is saved. */
  firstTrip?: boolean;
  /** How full the days should be (null = from the travel styles). */
  pace?: string | null;
  /** A newly saved place goes straight into the best day. */
  autoAssign?: boolean;
  /** The trip's places in order (a trip with several places shows them as chapters). */
  legs?: TripLeg[];
  /** The other people planning this trip. */
  partners?: { id: string; name: string | null }[];
  /** Planned together with other people (two or more accepted): turns on votes. */
  shared?: boolean;
  /** The manager pressed the trip's "הדרכה" button. */
  replayTour?: boolean;
  /** The guides this traveller has already seen (each opens by itself once: map, place card, days). */
  toursSeen?: string[];
  notices?: React.ReactNode;
};

// Trip travel styles -> the kinds of places to recommend first near a saved place.
const STYLE_TO_CATEGORIES: Record<string, CategoryKey[]> = {
  food: ['restaurant', 'cafe'], attractions: ['attraction'], shopping: ['shopping'], nature: ['nature', 'park'],
  nightlife: ['nightlife'], culture: ['culture', 'attraction'], relax: ['cafe', 'park'], family: ['park', 'attraction', 'nature'],
};
export function interestsOf(styles: string[]): CategoryKey[] {
  const out: CategoryKey[] = [];
  styles.forEach((st) => (STYLE_TO_CATEGORIES[st] ?? []).forEach((c) => !out.includes(c) && out.push(c)));
  return out.length ? out : ['attraction', 'restaurant', 'cafe'];
}

// A color per day for the all-days map (repeats after 12 days).
const DAY_COLORS = ['#1B73C9', '#E0662F', '#2E9E5B', '#7B3FE4', '#C2185B', '#00897B', '#B8860B', '#5C6BC0', '#D84315', '#0097A7', '#6D4C41', '#AD1457'];
const LEG_CACHE = 'gotrip-legs-v1';
const LEG_ICON = { walk: '🚶', transit: '🚌', drive: '🚗' } as const;
/** "🚶 12 דק׳" for the tag on the map line; null when there is no route. */
function legTag(l: LegInfo, fallback: 'walk' | 'transit' | 'drive'): string | null {
  if (l.durationSec == null) return null;
  const m = Math.max(1, Math.round(l.durationSec / 60));
  const t = m < 60 ? `${m} דק׳` : `${Math.floor(m / 60)} ש׳${m % 60 ? ` ${m % 60} ד׳` : ''}`;
  return `${LEG_ICON[l.mode ?? fallback]} ${t}`;
}

/** Opening days of places whose card was opened, kept for this browser session only. */
const HOURS_CACHE = 'gotrip-open-days';

export const dayLabel = (d: PlanDay) => `יום ${d.dayIndex}${d.date ? ` · ${formatDayHe(d.date)}` : ''}${d.title ? ` · ${d.title}` : ''}`;

/**
 * The trip screen's brain: holds the trip's places and days, and hands them to
 * the map, the "What I saved" list and the day planner, so all three stay in sync.
 */
export function TripWorkspace(p: Props) {
  const router = useRouter();
  const [places, setPlaces] = useState(p.initialPlaces);
  const [days, setDays] = useState(p.initialDays);
  const [hotelId, setHotelId] = useState(p.hotelId);
  const [selected, setSelected] = useState<Selected | null>(p.initialSelected ? { googlePlaceId: p.initialSelected } : null);
  const [dayId, setDayId] = useState<string | null>(
    () => (p.initialDays.find((d) => d.id === p.initialDayId) ?? p.initialDays.find((d) => d.stops.length) ?? p.initialDays[0])?.id ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // Opened a place from another place's "near here" list: the way back to the place we came from.
  const [trail, setTrail] = useState<{ googlePlaceId: string; name: string }[]>([]);
  const [reopenNearby, setReopenNearby] = useState(false);
  /** Open a place from anywhere but another card: no way back, it is a fresh start. */
  const openFresh = (g: string) => { setTrail([]); setReopenNearby(false); setSelected({ googlePlaceId: g }); };
  const planAccess = p.plan ?? { active: false, has: true };
  const [kids, setKids] = useState(!!p.withKids);
  const [shabbat, setShabbat] = useState(!!p.keepsShabbat);
  // The Shabbat button shows only on a trip that keeps Shabbat; it stays for this visit even when turned off here.
  const [shabbatTrip] = useState(!!p.keepsShabbat);
  const [pace, setPaceState] = useState<Pace>(() => (FEATURES.pace ? paceOf(p.pace, p.travelStyles) : 'normal'));
  const [autoAssign, setAutoAssignState] = useState(p.autoAssign !== false);
  // ---------- chapters: a trip with several places ----------
  const [tripLegs, setTripLegs] = useState<TripLeg[]>(p.legs ?? []);
  const hasChapters = tripLegs.length >= 2 && tripLegs.every((l) => l.start && l.end);
  const [chapter, setChapter] = useState<number | null>(null);
  const chapterDayIds = useMemo(() => {
    if (!hasChapters || chapter === null) return null;
    return new Set(days.filter((d) => chapterOfDate(tripLegs, d.date) === chapter).map((d) => d.id));
  }, [hasChapters, chapter, tripLegs, days]);
  // Each saved place belongs to one place of the trip: the place of the day it is on, or else the
  // place whose middle or day stops are nearest. Choosing a place shows only its saved places.
  const chapterOfPlace = useMemo(() => {
    const out = new Map<string, number>();
    if (!hasChapters) return out;
    const anchors: { c: number; lat: number; lng: number }[] = [];
    tripLegs.forEach((l, c) => { if (l.lat != null && l.lng != null) anchors.push({ c, lat: l.lat, lng: l.lng }); });
    const pos = new Map(places.map((x) => [x.id, x]));
    for (const d of days) {
      const c = chapterOfDate(tripLegs, d.date);
      if (c < 0) continue;
      for (const st of d.stops) {
        const x = pos.get(st.savedPlaceId);
        if (!x) continue;
        if (!out.has(x.id)) out.set(x.id, c);
        anchors.push({ c, lat: x.lat, lng: x.lng });
      }
    }
    if (!anchors.length) return out;
    for (const x of places) {
      if (out.has(x.id)) continue;
      let best = anchors[0]!, bestD = Infinity;
      for (const a of anchors) {
        const dd = (a.lat - x.lat) ** 2 + ((a.lng - x.lng) * Math.cos((x.lat * Math.PI) / 180)) ** 2;
        if (dd < bestD) { bestD = dd; best = a; }
      }
      out.set(x.id, best.c);
    }
    return out;
  }, [hasChapters, tripLegs, days, places]);
  const chapterPlaces = useMemo(
    () => (hasChapters && chapter !== null ? places.filter((x) => (chapterOfPlace.get(x.id) ?? chapter) === chapter) : places),
    [hasChapters, chapter, places, chapterOfPlace],
  );
  // A place that was just saved: a bar asks whether to put it in a day (with the best day suggested) or keep it in the list.
  const [ask, setAsk] = useState<{ savedPlaceId: string; label: string; suggestId: string | null } | null>(null);
  // "On the trip" helpers (rainy day, what now, with kids, photos) show only while the trip is happening:
  // today (the traveler's own date) between the first and last day. Read after load, so the server's clock never decides.
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    const n = new Date();
    setToday(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`);
  }, []);
  const tripDates = p.initialDays.map((d) => d.date).filter((x): x is string => !!x).sort();
  const onTrip = !!today && tripDates.length > 0 && today >= tripDates[0]! && today <= tripDates[tripDates.length - 1]!;
  // The full guides are the manager's reference, opened with "הדרכה": the open place card, the days, or the
  // trip screen followed by the saved list. Travellers get only the short welcome on their first sign-in.
  // A traveller gets each short guide by itself, once: the map the first time it opens, the place card the
  // first time one opens, and "לפי ימים" the first time. (The manager's "הדרכה" replays the full ones.)
  const [seen, setSeen] = useState<Set<string>>(() => new Set(p.toursSeen ?? []));
  const autoTour = !p.replayTour;
  const [tour, setTour] = useState<TourKind | null>(
    p.replayTour ? (p.tab === 'days' ? 'days' : 'trip')
      : p.tab === 'map' && !p.initialSelected && !seen.has('start') ? 'start'
      : p.tab === 'days' && !seen.has('days') ? 'days' : null,
  );
  const startPlaceTour = useCallback(() => { setSeen((s) => new Set(s).add('place')); setTour('place'); }, []);
  const tourDone = useCallback((k: TourKind) => {
    setSeen((s) => new Set(s).add(k));
    setTour(!autoTour && k === 'trip' && p.tab === 'map' && places.length > 0 ? 'saved' : null);
  }, [autoTour, p.tab, places.length]);
  // Fresh data from the server (after a save, or a change by someone planning with you) wins.
  useEffect(() => setPlaces(p.initialPlaces), [p.initialPlaces]);
  // "תוכניות ומחירים", once: the moment the first trip reaches 5 saved places (remembered on this phone).
  const placesBefore = useRef(p.initialPlaces.length);
  useEffect(() => {
    const before = placesBefore.current;
    placesBefore.current = places.length;
    if (!FEATURES.plans || !p.firstTrip || before >= 5 || places.length < 5) return;
    try {
      if (localStorage.getItem('gotrip-plans-seen')) return;
      localStorage.setItem('gotrip-plans-seen', '1');
    } catch { return; }
    const t = window.setTimeout(() => router.push(`/plans?next=${encodeURIComponent(`/trips/${p.tripId}`)}`), 1500);
    return () => window.clearTimeout(t);
  }, [places.length, p.firstTrip, p.tripId, router]);
  // "YallaTrip במסך הבית": once the first trip has 3 saved places (value seen), when nothing else is open. It decides if it may show.
  const quiet = !tour && !ask && !selected;
  useEffect(() => {
    if (!p.firstTrip || places.length < 3 || !quiet) return;
    const t = window.setTimeout(offerInstall, 2500);
    return () => window.clearTimeout(t);
  }, [p.firstTrip, places.length, quiet]);
  useEffect(() => setDays(p.initialDays), [p.initialDays]);
  useEffect(() => setHotelId(p.hotelId), [p.hotelId]);
  const mode = primaryMode(p.transportModes);

  const say = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 3500);
  }, []);

  const byId = useMemo(() => new Map(places.map((x) => [x.id, x])), [places]);

  /** Runs a server action, shows its error, keeps the rest of the page fresh. */
  const act = useCallback(async <T,>(fn: () => Promise<{ ok: true; data: T } | { ok: false; error: string }>, success?: string) => {
    setBusy(true);
    try {
      const r = await fn();
      if (!r.ok) {
        say(r.error);
        return null;
      }
      if (success) say(success);
      return r as { ok: true; data: T };
    } finally {
      setBusy(false);
    }
  }, [say]);

  const reload = useCallback(async () => {
    const r = await plan.loadPlan({ tripId: p.tripId });
    if (r.ok) {
      setDays(r.data.days);
      setPlaces(r.data.places);
    }
    router.refresh();
  }, [p.tripId, router]);

  // ---------- place card actions ----------
  const daysOf = useCallback(
    (spId: string) => days.filter((d) => d.stops.some((s) => s.savedPlaceId === spId)).map((d) => `יום ${d.dayIndex}`),
    [days],
  );

  const card: CardActions = {
    tripId: p.tripId,
    busy,
    withKids: kids,
    interests: interestsOf(p.travelStyles),
    keepsKosher: !!p.keepsKosher,
    days: days.map((d) => ({ id: d.id, label: dayLabel(d) })),
    daysOf,
    isSaved: (g) => places.some((x) => x.googlePlaceId === g),
    onSave: async (googlePlaceId, category, opts) => {
      const r = await act(() => savePlaceToTrip({ tripId: p.tripId, googlePlaceId, categoryKey: category, ...(opts?.sessionToken && { sessionToken: opts.sessionToken }) }));
      if (!r) return false;
      // A note that comes with the place (an Israeli hostel from our list): written only when there is none yet.
      const note = opts?.note && !r.data.note ? opts.note : null;
      if (note) await plan.updateSavedPlace({ tripId: p.tripId, savedPlaceId: r.data.id, note }).catch(() => null);
      const saved = note ? { ...r.data, note } : r.data;
      setPlaces((ps) => (ps.some((x) => x.id === saved.id) ? ps : [...ps, saved]));
      if (category === 'hotel' && !hotelId) setHotelId(r.data.id);
      if (!askDay(saved)) say(`${r.data.label} נוסף לטיול`);
      router.refresh();
      return true;
    },
    onRemove: async (sp) => {
      const r = await act(() => removeSavedPlace({ tripId: p.tripId, savedPlaceId: sp.id }), `${sp.label} הוסר מהטיול`);
      if (!r) return false;
      setPlaces((ps) => ps.filter((x) => x.id !== sp.id));
      setDays((ds) => ds.map((d) => ({ ...d, stops: d.stops.filter((s) => s.savedPlaceId !== sp.id) })));
      if (hotelId === sp.id) setHotelId(null);
      router.refresh();
      return true;
    },
    onCategory: async (sp, key) => {
      if (await act(() => setPlaceCategory({ tripId: p.tripId, savedPlaceId: sp.id, categoryKey: key }), 'הקטגוריה עודכנה')) {
        setPlaces((ps) => ps.map((x) => (x.id === sp.id ? { ...x, categoryKey: key, isMust: key === 'must' || x.isMust } : x)));
      }
    },
    onToggleHotel: async (sp) => {
      const next = hotelId === sp.id ? null : sp.id;
      if (await act(() => setTripHotel({ tripId: p.tripId, savedPlaceId: next }), next ? 'נקבע כמלון של הטיול' : 'המלון בוטל')) setHotelId(next);
    },
    onAddToDay: async (sp, targetDayId) => addToDayChecked(sp.id, targetDayId),
    onHours: (googlePlaceId, openDays) => {
      if (!openDays) return;
      openDaysRef.current.set(googlePlaceId, openDays);
      try { sessionStorage.setItem(HOURS_CACHE, JSON.stringify([...openDaysRef.current])); } catch { /* no storage */ }
      setHoursVer((v) => v + 1);
    },
    onOpenPlace: (googlePlaceId, from) => {
      setTrail((t) => (from ? [...t, from].slice(-10) : []));
      setReopenNearby(false);
      setSelected({ googlePlaceId });
    },
    onNearbyAdded: (anchor, googlePlaceId, category: CategoryKey) =>
      void plan.logRecommendation({ tripId: p.tripId, anchorSavedPlaceId: anchor?.id ?? null, googlePlaceId, categoryKey: category, action: 'added' }),
  };

  // ---------- a saved place: which day? ----------
  // Asks right away: the suggested day (same area as a day's places, or an empty day for a new area,
  // within the trip's pace), any other day, or just the saved list. Hotels, airports and transport aren't asked about.
  const daysRef = useRef(days);
  daysRef.current = days;
  const askDay = (sp: MapPlace): boolean => {
    const ds = daysRef.current;
    if (!autoAssign || !ds.length || ds.some((d) => d.stops.some((s) => s.savedPlaceId === sp.id))) return false;
    if (sp.categoryKey && ['hotel', 'airport', 'transport', 'parking'].includes(sp.categoryKey)) return false;
    const pos = (id: string) => (id === sp.id ? sp : places.find((x) => x.id === id));
    const openDays = openDaysRef.current.get(sp.googlePlaceId);
    const pick = pickDay(
      { lat: sp.lat, lng: sp.lng, categoryKey: sp.categoryKey },
      ds.map((d) => ({ id: d.id, date: d.date, stops: d.stops.map((s) => { const x = pos(s.savedPlaceId); return { lat: x?.lat ?? null, lng: x?.lng ?? null, categoryKey: x?.categoryKey ?? null }; }) })),
      { pace, fromDate: onTrip ? today : null, closedOn: (date) => closedOn(openDays, date) },
    );
    setAsk({ savedPlaceId: sp.id, label: sp.label, suggestId: pick?.dayId ?? null });
    return true;
  };
  const answerAsk = async (dayId: string | null) => {
    const x = ask;
    if (!x) return;
    setAsk(null);
    if (dayId) await addToDayChecked(x.savedPlaceId, dayId);
    else say(`${x.label} מחכה ברשימת השמורים`);
  };

  const selectChapter = (i: number | null) => {
    setChapter(i);
    if (i === null) return;
    const first = days.find((d) => chapterOfDate(tripLegs, d.date) === i);
    if (first) setDayId(first.id);
  };
  const changeNights = async (i: number, by: 1 | -1) => {
    const r = await act(() => tradeLegNight({ tripId: p.tripId, index: i, by }));
    if (r) { setTripLegs(r.data); router.refresh(); }
  };

  // ---------- day actions ----------
  const addToDay = async (savedPlaceId: string, targetDayId: string) => {
    const r = await act(() => plan.addStop({ tripId: p.tripId, dayId: targetDayId, savedPlaceId }));
    if (!r) return;
    setDays((ds) => ds.map((d) => d.id !== targetDayId ? d : {
      ...d, stops: [...d.stops, { id: r.data, savedPlaceId, position: (d.stops.at(-1)?.position ?? 0) + 1, plannedTime: null, durationMin: null, note: null }],
    }));
    setPlaces((ps) => ps.map((x) => (x.id === savedPlaceId && x.status === 'saved' ? { ...x, status: 'planned' } : x)));
    const d = days.find((x) => x.id === targetDayId);
    say(`נוסף ל${d ? `יום ${d.dayIndex}` : 'יום'}`);
    router.refresh();
  };

  // ---------- closed that day? ----------
  // Opening days come from place cards already opened (Google's hours, no extra call). When the place
  // is known to be closed on the chosen day's weekday, ask before adding and offer the days it is open.
  const openDaysRef = useRef(new Map<string, number[]>());
  const [hoursVer, setHoursVer] = useState(0);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(HOURS_CACHE);
      if (raw) { openDaysRef.current = new Map(JSON.parse(raw) as [string, number[]][]); setHoursVer((v) => v + 1); }
    } catch { /* no storage */ }
  }, []);
  const [closedAsk, setClosedAsk] = useState<{ savedPlaceId: string; dayId: string; name: string; weekday: string; label: string; openIds: string[] } | null>(null);
  const addToDayChecked = async (savedPlaceId: string, targetDayId: string) => {
    const sp = places.find((x) => x.id === savedPlaceId);
    const d = days.find((x) => x.id === targetDayId);
    const openDays = sp ? openDaysRef.current.get(sp.googlePlaceId) : undefined;
    if (sp && d && closedOn(openDays, d.date)) {
      setClosedAsk({
        savedPlaceId, dayId: targetDayId, name: sp.label, weekday: WEEKDAYS_HE[weekdayOf(d.date)!]!, label: dayLabel(d),
        openIds: days.filter((x) => x.id !== targetDayId && x.date && !closedOn(openDays, x.date)).map((x) => x.id),
      });
      return;
    }
    await addToDay(savedPlaceId, targetDayId);
  };

  // ---------- "I'm here": save the place the traveler is standing in, and add it to a day ----------
  const addHere = async (googlePlaceId: string, targetDayId: string | null) => {
    const r = await act(() => savePlaceToTrip({ tripId: p.tripId, googlePlaceId }));
    if (!r) return false;
    setPlaces((ps) => (ps.some((x) => x.id === r.data.id) ? ps : [...ps, r.data]));
    const already = targetDayId ? days.find((d) => d.id === targetDayId)?.stops.some((s) => s.savedPlaceId === r.data.id) : false;
    if (targetDayId && !already) await addToDay(r.data.id, targetDayId);
    else say(`${r.data.label} נשמר בטיול`);
    openFresh(googlePlaceId);
    router.refresh();
    return true;
  };

  // ---------- "stops along the way": save the place and put it in the day between the right stops ----------
  const addAlong = async (googlePlaceId: string, after: number) => {
    const day = days.find((d) => d.id === dayId);
    if (!day) return false;
    const saved = await act(() => savePlaceToTrip({ tripId: p.tripId, googlePlaceId }));
    if (!saved) return false;
    setPlaces((ps) => (ps.some((x) => x.id === saved.data.id) ? ps : [...ps, saved.data]));
    if (day.stops.some((s) => s.savedPlaceId === saved.data.id)) {
      say(`${saved.data.label} כבר ביום הזה`);
      return true;
    }
    const stop = await act(() => plan.addStop({ tripId: p.tripId, dayId: day.id, savedPlaceId: saved.data.id }));
    if (!stop) return false;
    // `after` counts the day's route points, which start with the starting point when there is one.
    const before = Math.min(Math.max(0, day.startPlaceId ? after : after + 1), day.stops.length);
    const ids = day.stops.map((s) => s.id);
    ids.splice(before, 0, stop.data);
    await act(() => plan.setDayOrder({ tripId: p.tripId, dayId: day.id, stopIds: ids }));
    say(`${saved.data.label} נוסף לדרך`);
    router.refresh();
    return true;
  };

  // ---------- the selected day's route (legs + line), fetched from Google ----------
  // On the phone the map is its own tab, so "show the day on the map" opens it with ?day=.
  const showDay = p.tab === 'days' || (p.tab === 'map' && !!p.initialDayId);
  const selectedDay = days.find((d) => d.id === dayId) ?? null;
  // Stops of the selected day whose place is known to be closed on that weekday (hoursVer: recompute when hours arrive).
  const closedIds = useMemo(() => {
    const out = new Set<string>();
    if (!selectedDay?.date) return out;
    for (const st of selectedDay.stops) {
      const sp = places.find((x) => x.id === st.savedPlaceId);
      if (sp && closedOn(openDaysRef.current.get(sp.googlePlaceId), selectedDay.date)) out.add(sp.id);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay, places, hoursVer]);
  const dayStops = useMemo(
    () => (selectedDay?.stops ?? []).map((s) => byId.get(s.savedPlaceId)).filter((x): x is MapPlace => !!x),
    [selectedDay, byId],
  );
  // The day's starting point (hotel, airport...), when one is chosen; the route begins there.
  const dayStart = selectedDay?.startPlaceId ? byId.get(selectedDay.startPlaceId) ?? null : null;
  const routePoints = useMemo(() => (dayStart ? [dayStart, ...dayStops] : dayStops), [dayStart, dayStops]);
  const routeKey = `${mode}|${routePoints.map((s) => `${s.lat},${s.lng}`).join(';')}`;
  // Travel times per route, shared by the selected day and the all-days view, kept for the session
  // so switching tabs doesn't ask Google again.
  const [legStore, setLegStore] = useState<Record<string, LegInfo[]>>({});
  const pendingLegs = useRef(new Set<string>());
  useEffect(() => {
    try { const raw = sessionStorage.getItem(LEG_CACHE); if (raw) setLegStore(JSON.parse(raw) as Record<string, LegInfo[]>); } catch { /* no storage */ }
  }, []);
  const fetchLegs = useCallback(async (key: string, pts: { lat: number; lng: number }[], signal?: AbortSignal) => {
    if (pendingLegs.current.has(key)) return;
    pendingLegs.current.add(key);
    try {
      const res = await fetch('/api/routes/day', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points: pts.map((s) => ({ lat: s.lat, lng: s.lng })), mode }), signal,
      });
      if (!res.ok) return;
      const body = (await res.json()) as { legs: LegInfo[] };
      setLegStore((st) => {
        const keys = Object.keys(st);
        const next: Record<string, LegInfo[]> = { ...(keys.length > 60 ? Object.fromEntries(keys.slice(-40).map((k) => [k, st[k]!])) : st), [key]: body.legs };
        try { sessionStorage.setItem(LEG_CACHE, JSON.stringify(next)); } catch { /* full or blocked */ }
        return next;
      });
    } catch {
      /* aborted or offline: the planner shows estimates */
    } finally {
      pendingLegs.current.delete(key);
    }
  }, [mode]);

  useEffect(() => {
    if (!showDay || routePoints.length < 2 || legStore[routeKey]) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => void fetchLegs(routeKey, routePoints, ctrl.signal), 400);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [showDay, routeKey, routePoints, legStore, fetchLegs]);
  const route = legStore[routeKey] ? { key: routeKey, legs: legStore[routeKey]! } : null;

  // ---------- the default map: every day of the trip at once ----------
  const overviewDays = useMemo<OverviewDay[]>(() => {
    if (showDay) return [];
    return days.filter((d) => !chapterDayIds || chapterDayIds.has(d.id)).flatMap((d) => {
      const start = d.startPlaceId ? byId.get(d.startPlaceId) ?? null : null;
      const stops = d.stops.map((s) => byId.get(s.savedPlaceId)).filter((x): x is MapPlace => !!x);
      if (!stops.length) return [];
      const points = start ? [start, ...stops] : stops;
      const key = `${mode}|${points.map((x) => `${x.lat},${x.lng}`).join(';')}`;
      const l = legStore[key] ?? null;
      return [{
        id: d.id, short: `יום ${d.dayIndex}`, label: dayLabel(d), color: DAY_COLORS[(d.dayIndex - 1) % DAY_COLORS.length]!,
        points, hasStart: !!start,
        segments: l ? l.map((x) => (x.polyline ? { path: decodePolyline(x.polyline), mode: x.mode ?? mode } : null)) : null,
        legLabels: l ? l.map((x) => legTag(x, mode)) : null,
      }];
    });
  }, [showDay, days, byId, mode, legStore, chapterDayIds]);
  // A chapter chosen: the map goes to its places (or, still empty, to the place itself).
  const chapterFocus = hasChapters && chapter !== null && tripLegs[chapter] ? {
    key: `${chapter}|${tripLegs[chapter]!.name}`,
    center: tripLegs[chapter]!.lat != null && tripLegs[chapter]!.lng != null ? { lat: tripLegs[chapter]!.lat!, lng: tripLegs[chapter]!.lng! } : null,
    points: overviewDays.flatMap((d) => d.points.map((x) => ({ lat: x.lat, lng: x.lng }))),
  } : null;
  // Times for the all-days view: one request per day that isn't known yet, one after another (up to 20 days).
  useEffect(() => {
    if (showDay || !overviewDays.length) return;
    const ctrl = new AbortController();
    const missing = overviewDays.filter((d) => d.points.length >= 2 && !d.segments && d.points.length <= 25).slice(0, 20);
    if (!missing.length) return;
    const t = setTimeout(async () => {
      for (const d of missing) {
        if (ctrl.signal.aborted) return;
        const key = `${mode}|${d.points.map((x) => `${x.lat},${x.lng}`).join(';')}`;
        await fetchLegs(key, d.points, ctrl.signal);
      }
    }, 600);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // Only when the set of days changes, not on every result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDay, overviewDays.map((d) => `${d.id}:${d.points.length}:${d.segments ? 1 : 0}`).join('|'), fetchLegs, mode]);

  // Highly rated places along the day's route, drawn on the map automatically (cached per route).
  const alongCache = useRef(new Map<string, AlongMarker[]>());
  const [along, setAlong] = useState<{ key: string; list: AlongMarker[] } | null>(null);
  const [alongOn, setAlongOn] = useState(false);
  useEffect(() => {
    if (!alongOn || !showDay || routePoints.length < 2) return;
    const hit = alongCache.current.get(routeKey);
    if (hit) return setAlong({ key: routeKey, list: hit });
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch('/api/routes/along', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ points: routePoints.map((s) => ({ lat: s.lat, lng: s.lng })), mode, kind: 'best' }),
          signal: ctrl.signal,
        });
        if (!res.ok) return;
        const body = (await res.json()) as { places?: AlongMarker[] };
        const list = body.places ?? [];
        alongCache.current.set(routeKey, list);
        setAlong({ key: routeKey, list });
      } catch {
        /* aborted or offline: no suggestions on the map */
      }
    }, 900);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [alongOn, showDay, routeKey, routePoints, mode]);

  const routeLegs = route?.key === routeKey ? route.legs : null;
  // legs[i] = stop i -> stop i+1; the start leg (start -> first stop) is kept apart.
  const startLeg = dayStart && routeLegs ? routeLegs[0] ?? null : null;
  const legs = routeLegs ? (dayStart ? routeLegs.slice(1) : routeLegs) : null;
  const dayRoute: DayRouteView = showDay && selectedDay
    ? {
        stops: dayStops, start: dayStart, path: null, label: dayLabel(selectedDay),
        along: along?.key === routeKey ? along.list : null,
        // Each leg's real route (walking or driving) to draw, from the start point if any; null while loading.
        segments: routeLegs ? routeLegs.map((l) => (l.polyline ? { path: decodePolyline(l.polyline), mode: l.mode ?? mode } : null)) : null,
        // The phone's map tab has no planner beside it, so the travel times go on the map.
        legLabels: routeLegs ? routeLegs.map((l) => legTag(l, mode)) : null,
        legs: routeLegs
          ? routeLegs.map((l, i) => `${dayStart ? (i === 0 ? 'מנקודת היציאה ל-1' : `מ-${i} ל-${i + 1}`) : `מ-${i + 1} ל-${i + 2}`}: ${describeLegHe(l, mode)}`)
          : undefined,
      }
    : null;

  const hotel = hotelId ? byId.get(hotelId) ?? null : null;
  // A place opened while planning by days (phone): shown over the day, on the map.
  const cardOverDay = p.tab === 'days' && !!selected;

  // Everything saved in the trip: beside the map on a computer, under it on a phone.
  const savedPanel = (
    <SavedPanel
      tripId={p.tripId}
      places={chapterPlaces}
      allPlaces={places}
      chapterName={hasChapters && chapter !== null ? tripLegs[chapter]?.name ?? null : null}
      onShowAll={() => selectChapter(null)}
      setPlaces={setPlaces}
      hotelId={hotelId}
      days={days}
      busy={busy}
      act={act}
      addToDay={addToDayChecked}
      center={p.center}
      shared={p.shared}
      onRemove={card.onRemove}
      onCategory={card.onCategory}
      onShowOnMap={(g) => {
        openFresh(g);
        // On a phone the list is under the map: go back up to it.
        if (window.matchMedia('(max-width: 1023px)').matches) window.scrollTo({ top: 0, behavior: 'smooth' });
      }}
    />
  );

  // During the trip: "I'm here", "what now", rainy day, with/without kids, Shabbat.
  // On a phone's map tab they sit under the map, so the map is on the first screen.
  const helpers = onTrip ? (
    <>
        <PlanGate access={planAccess}><div data-tour="here"><HereButton tripId={p.tripId} days={days} onAdd={addHere} /></div></PlanGate>
        {FEATURES.whatNow && <PlanGate access={planAccess}><div data-tour="now" className="grid"><NowButton kids={kids} days={days} onAdd={addHere} onOpen={openFresh} /></div></PlanGate>}
        <div className="flex flex-wrap gap-1.5">
          <div data-tour="kids"><KidsToggle value={kids} busy={busy} onChange={async (v) => {
            setKids(v);
            const r = await setTripKids({ tripId: p.tripId, value: v });
            if (!r.ok) { setKids(!v); say(r.error); } else say(v ? 'מעכשיו ההמלצות מתאימות לטיול עם ילדים' : 'ההמלצות חזרו למצב רגיל');
          }} /></div>
          {/* Only for a trip that keeps Shabbat (answered "כן" in the opening questions or the trip's settings). */}
          {shabbatTrip && <button type="button" data-tour="shabbat" aria-pressed={shabbat} disabled={busy}
            onClick={async () => {
              const v = !shabbat;
              setShabbat(v);
              const r = await setTripShabbat({ tripId: p.tripId, value: v });
              if (!r.ok) { setShabbat(!v); say(r.error); } else say(v ? 'מעכשיו התוכנית מציגה כניסת וצאת שבת וחג' : 'סימון השבת הוסר');
            }}
            className={`inline-flex min-h-8 items-center gap-1 rounded-full border px-3 text-xs font-bold transition ${shabbat ? 'border-[#1B73C9] bg-[#1B73C9] text-white' : 'border-line bg-white text-ink-2 hover:text-terracotta'}`}>
            🕯️ שומר/ת שבת{shabbat && ' ✓'}
          </button>}
        </div>
    </>
  ) : null;

  return (
    <div className="flex flex-col lg:h-[calc(100dvh-72px-81px)] lg:flex-row">
      <aside className="flex flex-col gap-4 overflow-y-auto border-line bg-sand/70 p-4 sm:p-5 lg:w-[480px] lg:shrink-0 lg:border-l">
        {p.notices}
        <nav aria-label="תצוגות הטיול" data-tour="tabs" className="flex gap-1 rounded-full border border-line bg-white p-1 shadow-[0_8px_24px_-14px_rgba(12,45,74,.35)]">
          {(['map', 'days'] as Tab[]).map((t) => (
            <a key={t} href={`/trips/${p.tripId}?tab=${t}`} aria-current={p.tab === t ? 'page' : undefined}
              className={`flex min-h-10 flex-1 items-center justify-center rounded-full text-[15px] font-bold no-underline transition
                ${p.tab === t ? 'bg-gradient-to-l from-[#1B73C9] to-[#2E9BDB] text-white shadow-[0_6px_16px_-6px_rgba(27,115,201,.7)]' : 'text-ink-2 hover:text-terracotta'}`}>
              {t === 'map' ? 'מפה' : 'לפי ימים'}
            </a>
          ))}
        </nav>

        {/* On a phone the map is hidden in "לפי ימים": the same search, here, opens the place over the day. */}
        {p.tab === 'days' && (
          <div className="lg:hidden [&_input]:scroll-mt-24" data-tour="d-search">
            <PlaceSearch placeholder={`חפשו מקום ב${p.destinationName}`}
              getBias={() => { const f = dayStops[0]; return f ? { lat: f.lat, lng: f.lng } : p.center; }}
              onPick={(placeId, sessionToken) => { setTrail([]); setReopenNearby(false); setSelected({ googlePlaceId: placeId, sessionToken }); }} />
          </div>
        )}

        {hasChapters && <ChaptersStrip legs={tripLegs} selected={chapter} onSelect={selectChapter} onNight={changeNights} busy={busy} />}

        {helpers && <div className={`flex flex-col gap-4 ${p.tab === 'map' ? 'hidden lg:flex' : ''}`}>{helpers}</div>}

        <div className={p.tab === 'map' ? 'hidden lg:block' : ''}>
          {p.tab === 'days' ? (
            <DaysPlanner
              tripId={p.tripId}
              days={days}
              setDays={setDays}
              places={chapterPlaces}
              byId={byId}
              hotel={hotel}
              dayId={dayId}
              setDayId={setDayId}
              legs={legs}
              startLeg={startLeg}
              routeLoading={routePoints.length > 1 && !routeLegs}
              mode={mode}
              busy={busy}
              act={act}
              onNote={async (savedPlaceId, note) => {
                const r = await act(() => plan.updateSavedPlace({ tripId: p.tripId, savedPlaceId, note }), 'ההערה נשמרה');
                if (r) setPlaces((ps) => ps.map((y) => (y.id === savedPlaceId ? { ...y, note: note.trim() || null } : y)));
              }}
              addToDay={addToDayChecked}
              onRemove={card.onRemove}
              reload={reload}
              aiAvailable={p.aiAvailable}
              onShowOnMap={openFresh}
              onShowDayOnMap={() => dayId && router.push(`/trips/${p.tripId}?tab=map&day=${dayId}`)}
              closedIds={closedIds}
              shabbat={shabbat}
              center={p.center}
              visibleDayIds={chapterDayIds}
              chapterName={hasChapters && chapter !== null ? tripLegs[chapter]?.name ?? null : null}
              pace={pace}
              onPace={FEATURES.pace ? async (v) => {
                const was = pace;
                setPaceState(v);
                const r = await setTripPace({ tripId: p.tripId, pace: v });
                if (!r.ok) { setPaceState(was); say(r.error); }
              } : undefined}
              autoAssign={autoAssign}
              onAutoAssign={async (v) => {
                setAutoAssignState(v);
                const r = await setTripAutoAssign({ tripId: p.tripId, value: v });
                if (!r.ok) { setAutoAssignState(!v); say(r.error); }
                else say(v ? 'מעכשיו כל מקום שנשמר נכנס לבד ליום המתאים' : 'מעכשיו מקומות חדשים מחכים ברשימה עד שתשבצי אותם');
              }}
              afterStops={selectedDay && routePoints.length >= 2 && (
                <div data-tour="along"><AlongRoute key={selectedDay.id} points={routePoints.map((s) => ({ lat: s.lat, lng: s.lng }))} mode={mode}
                  dayLabel={dayLabel(selectedDay)} onOpen={openFresh} onAdd={addAlong} /></div>
              )}
            />
          ) : savedPanel}
        </div>
      </aside>

      {/* Phone, "לפי ימים": the map is hidden until a place is opened (search, or "במפה" on a stop);
          then it opens over the day, with the place card, and "חזרה" brings the day back. */}
      <section className={`${p.tab === 'map' ? 'flex h-[62dvh] min-h-[360px]' : cardOverDay ? 'fixed inset-0 z-50 flex h-[100dvh] bg-white' : 'hidden'} flex-col lg:static lg:z-auto lg:flex lg:h-auto lg:min-h-0 lg:flex-1 lg:bg-transparent`}>
        {cardOverDay && (
          <div className="flex shrink-0 items-center gap-2 border-b border-line bg-white px-3 py-2 lg:hidden">
            <button type="button" onClick={() => { setTrail([]); setReopenNearby(false); setSelected(null); }}
              className="flex min-h-11 items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-bold text-white">
              <span aria-hidden="true">→</span> חזרה ל{selectedDay ? `יום ${selectedDay.dayIndex}` : 'תכנון לפי ימים'}
            </button>
          </div>
        )}
        <div className="relative min-h-0 flex-1">
        <TripMap
          destinationName={p.destinationName}
          center={p.center}
          apiKey={p.apiKey}
          mapId={p.mapId}
          places={places}
          hotelId={hotelId}
          selected={selected}
          onSelect={(v) => { setTrail([]); setReopenNearby(false); setSelected(v); }}
          back={trail.length ? {
            label: trail[trail.length - 1]!.name,
            go: () => { const last = trail[trail.length - 1]!; setTrail((t) => t.slice(0, -1)); setReopenNearby(true); setSelected({ googlePlaceId: last.googlePlaceId }); },
          } : null}
          openNearby={reopenNearby}
          dayRoute={dayRoute}
          overview={showDay ? null : overviewDays}
          onOpenDay={(id) => router.push(`/trips/${p.tripId}?tab=map&day=${id}`)}
          onShowAll={p.tab === 'map' ? () => router.push(`/trips/${p.tripId}?tab=map`) : undefined}
          alongOn={alongOn}
          alongLoading={alongOn && along?.key !== routeKey}
          onToggleAlong={() => setAlongOn((v) => !v)}
          card={card}
          toast={toast}
          focus={showDay ? null : chapterFocus}
        />
        </div>
      </section>
      {p.tab === 'map' && <div className="flex flex-col gap-4 bg-sand/70 p-4 sm:p-5 lg:hidden">{helpers}{savedPanel}</div>}
      {tour && <CoachTour key={tour} kind={selected && tour === 'trip' && !autoTour ? 'place' : tour} replay={!autoTour} onDone={() => tourDone(tour)} />}
      <FirstPlaceTour open={autoTour && !!selected && !tour && !seen.has('place')} onStart={startPlaceTour} />
      {closedAsk && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/40 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="closed-h"
          onClick={(e) => { if (e.target === e.currentTarget) setClosedAsk(null); }}>
          <div className="w-full max-w-[440px] rounded-3xl bg-white p-5 shadow-xl">
            <h2 id="closed-h" className="text-lg font-extrabold">{closedAsk.name} סגור ביום {closedAsk.weekday}</h2>
            <p className="mt-1 text-ink-2">
              לפי שעות הפתיחה ב-Google, המקום לא פתוח ב{closedAsk.label}.
              {closedAsk.openIds.length ? ' תרצו להעביר אותו ליום אחר בטיול שלך?' : ' הוא גם לא פתוח באף יום אחר בטיול.'}
            </p>
            {closedAsk.openIds.length > 0 && (
              <div className="mt-3 flex flex-col gap-2">
                {closedAsk.openIds.slice(0, 6).map((id) => {
                  const d = days.find((x) => x.id === id)!;
                  return (
                    <button key={id} type="button" disabled={busy} className="min-h-11 rounded-xl border border-line bg-sand px-3 text-right font-bold hover:border-terracotta"
                      onClick={async () => { const a = closedAsk; setClosedAsk(null); await addToDay(a.savedPlaceId, id); }}>
                      להעביר ל{dayLabel(d)}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <button type="button" disabled={busy} className="min-h-11 flex-1 rounded-full border border-line px-4 text-sm font-bold"
                onClick={async () => { const a = closedAsk; setClosedAsk(null); await addToDay(a.savedPlaceId, a.dayId); }}>להוסיף בכל זאת</button>
              <button type="button" className="min-h-11 flex-1 rounded-full bg-ink px-4 text-sm font-bold text-white" onClick={() => setClosedAsk(null)}>ביטול</button>
            </div>
          </div>
        </div>
      )}
      {ask && (() => {
        const sug = ask.suggestId ? days.find((x) => x.id === ask.suggestId) : null;
        return (
          <div role="dialog" aria-label="לשבץ ליום?" data-tour="placed" className="fixed inset-x-3 bottom-4 z-[60] mx-auto flex max-w-[480px] flex-col gap-2 rounded-2xl bg-ink p-3 text-white shadow-xl">
            <div className="flex items-start gap-2">
              <p className="min-w-0 flex-1 text-sm font-bold">✓ {ask.label} נשמר. לשבץ אותו ליום?</p>
              <button type="button" onClick={() => answerAsk(null)} aria-label="סגירה, להשאיר בשמורים" className="-m-1 h-8 w-8 shrink-0 rounded-full text-lg">✕</button>
            </div>
            {sug && (
              <button type="button" disabled={busy} onClick={() => answerAsk(sug.id)} className="min-h-11 rounded-xl bg-white px-3 text-sm font-extrabold text-ink">
                ✨ ל{dayLabel(sug)} (מתאים לאזור)
              </button>
            )}
            <div className="flex gap-2">
              <label className="sr-only" htmlFor="ask-day">יום אחר</label>
              <select id="ask-day" value="" disabled={busy} onChange={(e) => e.target.value && answerAsk(e.target.value)}
                className="h-10 min-w-0 flex-1 rounded-xl border-0 bg-white/15 px-2 text-sm font-bold text-white">
                <option value="" className="text-ink">{sug ? 'יום אחר…' : 'לבחור יום…'}</option>
                {days.filter((x) => x.id !== sug?.id).map((x) => <option key={x.id} value={x.id} className="text-ink">{dayLabel(x)}</option>)}
              </select>
              <button type="button" onClick={() => answerAsk(null)} className="min-h-10 shrink-0 rounded-xl border border-white/40 px-3 text-sm font-bold">להשאיר בשמורים</button>
            </div>
          </div>
        );
      })()}
      {/* Toasts also show when the map is hidden (phone, list tabs) */}
      {p.tab !== 'map' && toast && (
        <div aria-live="polite" className="fixed inset-x-0 bottom-6 z-40 flex justify-center lg:hidden">
          <span className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-white shadow-lg">{toast}</span>
        </div>
      )}
    </div>
  );
}

/** Opens the place card's short guide the first time a traveller opens a place (after the card has drawn). */
function FirstPlaceTour({ open, onStart }: { open: boolean; onStart: () => void }) {
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(onStart, 900);
    return () => window.clearTimeout(t);
  }, [open, onStart]);
  return null;
}
