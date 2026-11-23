'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MarkerClusterer, type Renderer } from '@googlemaps/markerclusterer';
import { loadGoogleMaps, onMapsAuthFailure } from '@/lib/maps/loader';
import { categoryMeta, pinSvg, type CategoryKey } from '@/lib/places/categories';
import type { MapPlace } from '@/lib/places/queries';
import type { Place } from '@/lib/google/mappers';
import type { LatLng } from '@/lib/geo';
import { PlaceSearch } from './PlaceSearch';
import { createClient } from '@/lib/supabase/browser';
import { distanceMeters } from '@/lib/geo';
import { PlaceCard, type CardActions } from './PlaceCard';
import { FEATURES } from '@/lib/features';

export type Selected = { googlePlaceId: string; sessionToken?: string };
export type DaySegment = { path: LatLng[]; mode: 'walk' | 'transit' | 'drive' } | null;
export type AlongKind = 'food' | 'sights' | 'hotels' | 'cool' | 'rest' | 'market';
/** A highly rated place on (or a few minutes off) the day's route, shown automatically. */
export type AlongMarker = { googlePlaceId: string; kind: AlongKind; name: string; rating: number | null; lat: number; lng: number; detourMin: number };
export type DayRouteView = {
  stops: MapPlace[]; start?: MapPlace | null; path: LatLng[] | null; label: string; legs?: string[]; segments?: DaySegment[] | null;
  along?: AlongMarker[] | null;
  /** Short travel time per leg ("🚶 12 דק׳"), drawn on the line itself. */
  legLabels?: (string | null)[] | null;
} | null;
/** One day in the "all days" view: its stops in order (starting point first), its color and its legs. */
export type OverviewDay = {
  id: string; short: string; label: string; color: string; points: MapPlace[]; hasStart: boolean;
  segments: DaySegment[] | null; legLabels: (string | null)[] | null;
};

// Small round badges for "on the way" places: each kind its own color and icon.
const ALONG: Record<AlongKind, { label: string; color: string; icon: string }> = {
  food: { label: 'מסעדות', color: '#E0662F', icon: '<path d="M7 2v8a2 2 0 0 0 2 2v10M11 2v6M5 2v6M17 2c-1.7 1-3 3-3 6v5h3v9" />' },
  sights: { label: 'אטרקציות', color: '#7B3FE4', icon: '<path d="M12 3l2.6 5.6 6 .6-4.5 4 1.3 6-5.4-3.1-5.4 3.1 1.3-6-4.5-4 6-.6z" />' },
  hotels: { label: 'מלונות', color: '#1B73C9', icon: '<path d="M3 20V6M3 16h18v4M21 16v-4a3 3 0 0 0-3-3h-7v7M7 12.5a1.5 1.5 0 1 0 0-.01" />' },
  cool: { label: 'מקומות מגניבים', color: '#2E9E5B', icon: '<path d="M3 20l6-10 4 6 3-4 5 8z M16 7a2 2 0 1 0 0-.01" />' },
  market: { label: 'סופר מרקט', color: '#087F5B', icon: '<path d="M2.5 3.5h2.5l2.2 11h10.6l2-8H6.2M9 19a1.6 1.6 0 1 0 0-.01M17 19a1.6 1.6 0 1 0 0-.01" />' },
  rest: { label: 'עצירה', color: '#8A5A2B', icon: '<path d="M5 8h11v5a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5zM16 9h2a2 2 0 0 1 0 4h-2M8 2v3M12 2v3" />' },
};

const alongEl = (m: AlongMarker) => {
  const k = ALONG[m.kind];
  const el = document.createElement('div');
  el.style.cssText = 'display:flex;align-items:center;gap:3px;padding:3px 7px 3px 3px;border-radius:999px;background:#fff;' +
    `border:2px solid ${k.color};box-shadow:0 3px 10px rgba(12,45,74,.28);font:700 12px var(--font-heebo),sans-serif;color:#0C2D4A;cursor:pointer`;
  el.innerHTML = `<span style="display:flex;width:22px;height:22px;border-radius:50%;background:${k.color};align-items:center;justify-content:center">` +
    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${k.icon}</svg></span>` +
    (m.rating ? `<span>${m.rating.toFixed(1)}★</span>` : '');
  return el;
};

/** "ישראלים ממליצים" appears on the map only once the area has at least this many recommendations. */
const PICKS_MIN = 5;

/** A place YallaTrip travellers rated well ("ישראלים ממליצים"). */
type Pick = { gid: string; lat: number; lng: number; name: string | null; avg: number | null; cnt: number };
const pickEl = (m: Pick) => {
  const el = document.createElement('div');
  el.style.cssText = 'display:flex;align-items:center;gap:3px;padding:3px 8px;border-radius:999px;background:#FFF8E1;' +
    'border:2px solid #E0A21B;box-shadow:0 3px 10px rgba(12,45,74,.28);font:800 12px var(--font-heebo),sans-serif;color:#0C2D4A;cursor:pointer;white-space:nowrap';
  el.textContent = `🇮🇱 ${m.avg ? `${Number(m.avg).toFixed(1)}★` : '👍'}${m.cnt > 1 ? ` · ${m.cnt}` : ''}`;
  return el;
};

/** A small time tag placed on the route line ("🚗 8 דק׳"). */
const legTagEl = (text: string, color: string) => {
  const el = document.createElement('div');
  el.style.cssText = 'padding:2px 7px;border-radius:999px;background:#fff;white-space:nowrap;' +
    `border:1.5px solid ${color};box-shadow:0 2px 6px rgba(12,45,74,.25);font:700 11.5px var(--font-heebo),sans-serif;color:#0C2D4A;transform:translateY(50%)`;
  el.textContent = text;
  return el;
};
/** "יום 3" badge at the start of a day's route in the all-days view. */
const dayBadgeEl = (text: string, color: string) => {
  const el = document.createElement('div');
  el.style.cssText = `padding:2px 8px;border-radius:8px;background:${color};color:#fff;white-space:nowrap;` +
    'box-shadow:0 2px 8px rgba(12,45,74,.35);font:800 12px var(--font-heebo),sans-serif;transform:translateY(-38px)';
  el.textContent = text;
  return el;
};
const midOf = (path: LatLng[]): LatLng => {
  if (path.length === 2) return { lat: (path[0]!.lat + path[1]!.lat) / 2, lng: (path[0]!.lng + path[1]!.lng) / 2 };
  return path[Math.floor(path.length / 2)]!;
};

type Props = {
  destinationName: string;
  center: LatLng | null;
  apiKey: string;
  mapId: string;
  places: MapPlace[];
  hotelId: string | null;
  selected: Selected | null;
  onSelect: (s: Selected | null) => void;
  /** Way back from a place opened out of another card's "near here" list. */
  back?: { label: string; go: () => void } | null;
  openNearby?: boolean;
  /** When set, the map shows this day: numbered pins in order and the route line. */
  dayRoute: DayRouteView;
  /** Otherwise: every day of the trip at once, each in its own color. */
  overview?: OverviewDay[] | null;
  onOpenDay?: (dayId: string) => void;
  onShowAll?: () => void;
  /** "Recommended on the way" stays hidden until the traveler asks for it. */
  alongOn?: boolean;
  alongLoading?: boolean;
  onToggleAlong?: () => void;
  card: CardActions;
  toast: string | null;
  /** Move the map to this area (a place of a trip with several), once per key. */
  focus?: { key: string; center: LatLng | null; points: LatLng[] } | null;
};

const clusterRenderer: Renderer = {
  render: ({ count, position }) => {
    const el = document.createElement('div');
    el.style.cssText =
      'min-width:38px;height:38px;padding:0 8px;border-radius:19px;background:#fff;border:2px solid #0C2D4A;' +
      'display:flex;align-items:center;justify-content:center;font:700 15px var(--font-heebo),sans-serif;color:#0C2D4A;' +
      'box-shadow:0 2px 8px rgba(0,0,0,.2)';
    el.textContent = String(count);
    return new google.maps.marker.AdvancedMarkerElement({ position, content: el, title: `${count} מקומות`, zIndex: 1000 + count });
  },
};

const pinEl = (html: string, dim = false) => {
  const el = document.createElement('div');
  el.innerHTML = html;
  if (dim) el.style.opacity = '0.35';
  return el;
};

/** The trip map. It owns only map things (markers, route line, filter); the data lives in TripWorkspace. */
export function TripMap(p: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const dayMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const linesRef = useRef<google.maps.Polyline[]>([]);
  const tempMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const alongMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const overviewMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const overviewLinesRef = useRef<google.maps.Polyline[]>([]);
  const tagMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const [zoom, setZoom] = useState(13);
  // "Recommended on the way": the bar opens with nothing shown; the traveler picks what to see.
  const [shownKinds, setShownKinds] = useState<Set<AlongKind>>(new Set());
  // "ישראלים ממליצים": our own data, so it costs nothing at Google. Looked up around the map from the start,
  // but the button shows only from PICKS_MIN recommendations in the area, and the pins only when asked.
  const [picksOn, setPicksOn] = useState(false);
  const [picks, setPicks] = useState<Pick[] | null>(null);
  const picksAt = useRef<LatLng | null>(null);
  const picksMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const picksTotal = picks?.reduce((n, x) => n + x.cnt, 0) ?? 0;
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'auth'>('loading');
  const [filter] = useState<CategoryKey | 'all'>('all');

  // ---------- create the map once ----------
  useEffect(() => {
    if (!p.apiKey) return;
    const off = onMapsAuthFailure(() => setStatus('auth'));
    let cancelled = false;
    (async () => {
      try {
        await loadGoogleMaps(p.apiKey);
        const { Map } = (await google.maps.importLibrary('maps')) as google.maps.MapsLibrary;
        await google.maps.importLibrary('marker');
        if (cancelled || !divRef.current) return;
        const map = new Map(divRef.current, {
          mapId: p.mapId,
          center: p.center ?? { lat: 41.9, lng: 12.5 },
          zoom: p.center ? 13 : 3,
          // Map / satellite switch (satellite with place names on top).
          mapTypeControl: true,
          mapTypeControlOptions: {
            mapTypeIds: ['roadmap', 'hybrid'],
            style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
            position: google.maps.ControlPosition.LEFT_BOTTOM,
          },
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: true,
          gestureHandling: 'greedy',
        });
        mapRef.current = map;
        map.addListener('zoom_changed', () => setZoom(map.getZoom() ?? 13));
        clustererRef.current = new MarkerClusterer({ map, renderer: clusterRenderer });
        map.addListener('click', (e: google.maps.MapMouseEvent & { placeId?: string; stop?: () => void }) => {
          if (e.placeId) {
            e.stop?.();
            p.onSelect({ googlePlaceId: e.placeId });
          }
        });
        const focus = p.places.find((x) => x.googlePlaceId === p.selected?.googlePlaceId);
        if (focus) {
          map.setCenter({ lat: focus.lat, lng: focus.lng });
          map.setZoom(16);
        } else fitTo(map, p.places);
        setStatus('ready');
      } catch (e) {
        console.error('[map]', e);
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- a chapter of the trip was chosen: go there ----------
  const focusKey = p.focus?.key ?? null;
  useEffect(() => {
    const map = mapRef.current;
    if (status !== 'ready' || !map || !p.focus) return;
    if (p.focus.points.length) fitTo(map, p.focus.points);
    else if (p.focus.center) { map.panTo(p.focus.center); map.setZoom(12); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey, status]);

  // ---------- all saved places (clustered) ----------
  useEffect(() => {
    const map = mapRef.current;
    const clusterer = clustererRef.current;
    if (status !== 'ready' || !map || !clusterer) return;
    const inDay = new Set([
      ...(p.dayRoute?.stops.map((s) => s.id) ?? []), ...(p.dayRoute?.start ? [p.dayRoute.start.id] : []),
      ...(!p.dayRoute ? (p.overview ?? []).flatMap((d) => d.points.map((x) => x.id)) : []),
    ]);
    const visible = (filter === 'all' ? p.places : p.places.filter((x) => x.categoryKey === filter || (filter === 'must' && x.isMust)))
      .filter((x) => !inDay.has(x.id));
    const markers = visible.map((x) => {
      const isSel = p.selected?.googlePlaceId === x.googlePlaceId;
      const isHotel = x.id === p.hotelId;
      const m = new google.maps.marker.AdvancedMarkerElement({
        position: { lat: x.lat, lng: x.lng },
        content: pinEl(pinSvg(categoryMeta(x.categoryKey), { selected: isSel, hotel: isHotel }), !!p.dayRoute && !isSel && !isHotel),
        title: isHotel ? `${x.label} (המלון)` : x.label,
        gmpClickable: true,
        zIndex: isSel ? 2000 : isHotel ? 1500 : undefined,
      });
      m.addListener('click', () => p.onSelect({ googlePlaceId: x.googlePlaceId }));
      return m;
    });
    clusterer.clearMarkers();
    clusterer.addMarkers(markers);
    return () => clusterer.clearMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, p.places, filter, p.hotelId, p.selected, p.dayRoute, p.overview]);

  // ---------- the selected day: numbered pins + line ----------
  useEffect(() => {
    const map = mapRef.current;
    if (status !== 'ready' || !map) return;
    dayMarkersRef.current.forEach((m) => (m.map = null));
    dayMarkersRef.current = [];
    linesRef.current.forEach((l) => l.setMap(null));
    linesRef.current = [];
    const day = p.dayRoute;
    if (!day || !day.stops.length) return;

    dayMarkersRef.current = day.stops.map((x, i) => {
      const isSel = p.selected?.googlePlaceId === x.googlePlaceId;
      const m = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: x.lat, lng: x.lng },
        content: pinEl(pinSvg(categoryMeta(x.categoryKey), { number: i + 1, selected: isSel })),
        title: `${i + 1}. ${x.label}`,
        gmpClickable: true,
        zIndex: 2500 + i,
      });
      m.addListener('click', () => p.onSelect({ googlePlaceId: x.googlePlaceId }));
      return m;
    });
    // Each leg follows its real route as a dashed line: dark for driving, green for walking.
    // A leg with no route yet (loading) or at all gets only a faint straight connector.
    const dashed = (path: LatLng[], color: string, opacity: number, repeat: string) =>
      new google.maps.Polyline({
        map, path, strokeColor: color, strokeOpacity: 0, strokeWeight: 4, zIndex: 10,
        icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: opacity, scale: 3 }, offset: '0', repeat }],
      });
    if (day.start) {
      const s = day.start;
      const m = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: s.lat, lng: s.lng },
        content: pinEl(pinSvg(categoryMeta(s.categoryKey), { start: true, size: 38 })),
        title: `נקודת יציאה: ${s.label}`,
        gmpClickable: true,
        zIndex: 2600,
      });
      m.addListener('click', () => p.onSelect({ googlePlaceId: s.googlePlaceId }));
      dayMarkersRef.current.push(m);
    }
    const pts = day.start ? [day.start, ...day.stops] : day.stops;
    pts.slice(0, -1).forEach((a, i) => {
      const b = pts[i + 1]!;
      const seg = day.segments?.[i] ?? null;
      let path: LatLng[] = [{ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }];
      let color = '#8A8F98';
      if (seg && seg.path.length > 1) {
        color = seg.mode === 'walk' ? '#2E7D32' : '#0C2D4A';
        // Join the stops to where the road/path starts and ends.
        path = [{ lat: a.lat, lng: a.lng }, ...seg.path, { lat: b.lat, lng: b.lng }];
        linesRef.current.push(dashed(path, color, 0.95, seg.mode === 'walk' ? '10px' : '14px'));
      } else {
        linesRef.current.push(dashed(path, color, 0.45, '12px'));
      }
      // The travel time, on the line itself.
      const tag = day.legLabels?.[i];
      if (tag) {
        dayMarkersRef.current.push(new google.maps.marker.AdvancedMarkerElement({
          map, position: midOf(path), content: legTagEl(tag, color === '#8A8F98' ? '#0C2D4A' : color), zIndex: 2400, title: tag,
        }));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, p.dayRoute, p.selected]);

  // ---------- "ישראלים ממליצים": YallaTrip travellers' well-rated places around the map ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!FEATURES.israeliPicks || status !== 'ready' || !map) return;
    const load = async () => {
      const c = map.getCenter();
      if (!c) return;
      const at = { lat: c.lat(), lng: c.lng() };
      if (picksAt.current && distanceMeters(picksAt.current, at) < 30000) return;
      picksAt.current = at;
      const { data } = await createClient().rpc('israeli_picks', { p_lat: at.lat, p_lng: at.lng, p_km: 80 });
      setPicks((Array.isArray(data) ? data : []) as Pick[]);
    };
    load();
    const l = map.addListener('idle', load);
    return () => l.remove();
  }, [status]);
  useEffect(() => {
    const map = mapRef.current;
    picksMarkersRef.current.forEach((m) => (m.map = null));
    picksMarkersRef.current = [];
    if (status !== 'ready' || !map || !picksOn || !picks) return;
    const savedIds = new Set(p.places.map((x) => x.googlePlaceId));
    picksMarkersRef.current = picks.filter((x) => !savedIds.has(x.gid)).map((x) => {
      const m = new google.maps.marker.AdvancedMarkerElement({
        map, position: { lat: x.lat, lng: x.lng }, content: pickEl(x), gmpClickable: true, zIndex: 1400,
        title: `${x.name ?? ''} · ${x.cnt === 1 ? 'מטייל אחד ב-YallaTrip המליץ' : `${x.cnt} מטיילים ב-YallaTrip המליצו`}`,
      });
      m.addListener('click', () => p.onSelect({ googlePlaceId: x.gid }));
      return m;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, picks, picksOn, p.places]);

  // ---------- recommended places along the day's route (shown without asking) ----------
  useEffect(() => {
    const map = mapRef.current;
    alongMarkersRef.current.forEach((m) => (m.map = null));
    alongMarkersRef.current = [];
    if (status !== 'ready' || !map || !p.dayRoute?.along || !p.alongOn) return;
    const savedIds = new Set(p.places.map((x) => x.googlePlaceId));
    alongMarkersRef.current = p.dayRoute.along
      .filter((a) => shownKinds.has(a.kind) && !savedIds.has(a.googlePlaceId))
      .map((a) => {
        const m = new google.maps.marker.AdvancedMarkerElement({
          map, position: { lat: a.lat, lng: a.lng }, content: alongEl(a), gmpClickable: true, zIndex: 1500,
          title: `${a.name}${a.rating ? ` · ${a.rating.toFixed(1)}★` : ''} · ${a.detourMin <= 1 ? 'על הדרך' : `סטייה של כ-${a.detourMin} דק׳`}`,
        });
        m.addListener('click', () => p.onSelect({ googlePlaceId: a.googlePlaceId }));
        return m;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, p.dayRoute?.along, p.places, shownKinds, p.alongOn]);

  // ---------- all days at once (the default view): each day its own color, numbered stops, time tags ----------
  useEffect(() => {
    const map = mapRef.current;
    overviewMarkersRef.current.forEach((m) => (m.map = null));
    overviewMarkersRef.current = [];
    overviewLinesRef.current.forEach((l) => l.setMap(null));
    overviewLinesRef.current = [];
    tagMarkersRef.current.forEach((m) => (m.map = null));
    tagMarkersRef.current = [];
    if (status !== 'ready' || !map || p.dayRoute || !p.overview?.length) return;
    for (const d of p.overview) {
      d.points.forEach((x, i) => {
        const isStart = d.hasStart && i === 0;
        const n = d.hasStart ? i : i + 1;
        const isSel = p.selected?.googlePlaceId === x.googlePlaceId;
        const m = new google.maps.marker.AdvancedMarkerElement({
          map, position: { lat: x.lat, lng: x.lng },
          content: pinEl(pinSvg({ ...categoryMeta(x.categoryKey), color: d.color }, isStart ? { start: true, size: 34 } : { number: n, selected: isSel })),
          title: `${d.label} · ${isStart ? 'נקודת יציאה' : n}. ${x.label}`, gmpClickable: true, zIndex: isSel ? 2600 : 2000,
        });
        m.addListener('click', () => p.onSelect({ googlePlaceId: x.googlePlaceId }));
        overviewMarkersRef.current.push(m);
      });
      const first = d.points[0];
      if (first) {
        const badge = new google.maps.marker.AdvancedMarkerElement({
          map, position: { lat: first.lat, lng: first.lng }, content: dayBadgeEl(d.short, d.color), zIndex: 2100, title: d.label, gmpClickable: true,
        });
        badge.addListener('click', () => p.onOpenDay?.(d.id));
        overviewMarkersRef.current.push(badge);
      }
      d.points.slice(0, -1).forEach((a, i) => {
        const b = d.points[i + 1]!;
        const seg = d.segments?.[i] ?? null;
        const path = seg && seg.path.length > 1 ? [{ lat: a.lat, lng: a.lng }, ...seg.path, { lat: b.lat, lng: b.lng }] : [{ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }];
        overviewLinesRef.current.push(new google.maps.Polyline({
          map, path, strokeColor: d.color, strokeOpacity: 0, strokeWeight: 4, zIndex: 10,
          icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: seg ? 0.9 : 0.5, scale: 3 }, offset: '0', repeat: seg?.mode === 'walk' ? '10px' : '14px' }],
        }));
        const tag = d.legLabels?.[i];
        if (tag) tagMarkersRef.current.push(new google.maps.marker.AdvancedMarkerElement({ position: midOf(path), content: legTagEl(tag, d.color), zIndex: 1900, title: tag }));
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, p.overview, p.dayRoute, p.selected]);

  // Time tags in the all-days view only when zoomed in enough to read them.
  useEffect(() => {
    const map = mapRef.current;
    const show = !!map && zoom >= 12;
    tagMarkersRef.current.forEach((m) => (m.map = show ? map : null));
  }, [zoom, p.overview, status, p.dayRoute]);

  const alongCounts = useMemo(() => {
    const c = new Map<AlongKind, number>();
    (p.dayRoute?.along ?? []).forEach((a) => c.set(a.kind, (c.get(a.kind) ?? 0) + 1));
    return c;
  }, [p.dayRoute?.along]);

  // Zoom to the day when the chosen day changes (not on every edit).
  const dayKey = p.dayRoute?.label ?? '';
  useEffect(() => {
    if (status === 'ready' && mapRef.current && p.dayRoute?.stops.length) fitTo(mapRef.current, p.dayRoute.start ? [p.dayRoute.start, ...p.dayRoute.stops] : p.dayRoute.stops);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, dayKey]);

  const showTemporaryPin = useCallback((place: Place) => {
    const map = mapRef.current;
    if (tempMarkerRef.current) tempMarkerRef.current.map = null;
    tempMarkerRef.current = null;
    if (!map || !place.location) return;
    map.panTo(place.location);
    if ((map.getZoom() ?? 0) < 15) map.setZoom(15);
    if (p.places.some((x) => x.googlePlaceId === place.googlePlaceId)) return;
    tempMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
      map, position: place.location, content: pinEl(pinSvg({ ...categoryMeta(null), color: '#0C2D4A' }, { selected: true })),
      title: place.name ?? '', zIndex: 3000,
    });
  }, [p.places]);

  // The temporary pin goes away once the place is saved or the card is closed.
  useEffect(() => {
    const saved = p.places.some((x) => x.googlePlaceId === p.selected?.googlePlaceId);
    if ((!p.selected || saved) && tempMarkerRef.current) {
      tempMarkerRef.current.map = null;
      tempMarkerRef.current = null;
    }
  }, [p.selected, p.places]);

  const getBias = useCallback(() => {
    const c = mapRef.current?.getCenter();
    return c ? { lat: c.lat(), lng: c.lng() } : p.center;
  }, [p.center]);


  const saved = p.places.find((x) => x.googlePlaceId === p.selected?.googlePlaceId);

  if (!p.apiKey) {
    return <MapMessage title="המפה עוד לא מוגדרת" text="חסר מפתח הדפדפן של Google (NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY) בהגדרות האתר ב-Vercel." />;
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#E3EEF6]">
      <div ref={divRef} className="h-full w-full" role="region" aria-label={`מפה של ${p.destinationName}`} />

      {status === 'loading' && <MapMessage title="טוענים את המפה..." />}
      {status === 'error' && <MapMessage title="המפה לא נטענה" text="בדקו את החיבור לאינטרנט ורעננו את הדף." />}
      {status === 'auth' && <MapMessage title="Google דחה את מפתח המפה" text="בדקו שהמפתח מורשה ל-Maps JavaScript API ולכתובת האתר הזו." />}

      {status === 'ready' && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2.5 p-3 sm:p-4">
          <div className="pointer-events-auto w-full sm:max-w-[420px]" data-tour="search">
            <PlaceSearch placeholder={`חפשו מקום ב${p.destinationName}`} getBias={getBias}
              onPick={(placeId, sessionToken) => p.onSelect({ googlePlaceId: placeId, sessionToken })} />
          </div>
          {p.dayRoute && p.onShowAll && (
            <button type="button" onClick={p.onShowAll} className="pointer-events-auto w-fit rounded-full bg-white/95 px-3.5 py-1.5 text-sm font-bold text-terracotta shadow">
              הצגת כל הימים
            </button>
          )}
          {p.dayRoute && p.onToggleAlong && p.dayRoute.stops.length + (p.dayRoute.start ? 1 : 0) > 1 && (
            <button type="button" onClick={p.onToggleAlong} aria-pressed={!!p.alongOn} data-tour="along-toggle"
              className={`pointer-events-auto flex w-fit items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-bold shadow ${p.alongOn ? 'bg-ink text-white' : 'bg-white/95 text-ink'}`}>
              <span className={`flex h-4 w-4 items-center justify-center rounded border text-[11px] ${p.alongOn ? 'border-white bg-white text-ink' : 'border-ink'}`} aria-hidden="true">{p.alongOn ? '✓' : ''}</span>
              {p.alongLoading ? 'מחפשים מומלצים בדרך…' : 'הצגת מומלצים בדרך'}
            </button>
          )}
          {FEATURES.israeliPicks && (picksOn || picksTotal >= PICKS_MIN) && (
          <button type="button" onClick={() => setPicksOn((v) => !v)} aria-pressed={picksOn} data-tour="il-picks"
            className={`pointer-events-auto flex w-fit items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-bold shadow ${picksOn ? 'bg-[#E0A21B] text-white' : 'bg-white/95 text-ink'}`}>
            <span className={`flex h-4 w-4 items-center justify-center rounded border text-[11px] ${picksOn ? 'border-white bg-white text-[#B07A00]' : 'border-ink'}`} aria-hidden="true">{picksOn ? '✓' : ''}</span>
            🇮🇱 ישראלים ממליצים
          </button>
          )}
          {picksOn && picks && (picks.length === 0 || picks.every((x) => p.places.some((y) => y.googlePlaceId === x.gid))) && (
            <p className="pointer-events-auto w-fit max-w-full rounded-xl bg-white/95 px-3 py-1.5 text-xs font-bold text-ink-2 shadow">
              {picks.length === 0
                ? 'עוד אין כאן המלצות של מטיילי YallaTrip. מקום שמדרגים ב"⭐ לדרג ולהמליץ" (4 כוכבים ומעלה, או כמה מילים) יופיע כאן לכולם.'
                : 'ההמלצות באזור הזה כבר שמורות בטיול שלך, אז הן מסומנות בסיכה הרגילה שלך.'}
            </p>
          )}
          {p.dayRoute && p.alongOn && alongCounts.size > 0 && (
            <div className="pointer-events-auto flex w-fit max-w-full flex-wrap items-center gap-1.5 rounded-xl bg-white/95 px-2.5 py-1.5 shadow" role="group" aria-label="מומלצים בדרך">
              <span className="text-xs font-extrabold text-ink-2">{shownKinds.size ? 'מומלצים בדרך:' : 'מה להציג?'}</span>
              {(Object.keys(ALONG) as AlongKind[]).filter((k) => alongCounts.has(k)).map((k) => {
                const on = shownKinds.has(k);
                return (
                  <button key={k} type="button" aria-pressed={on}
                    onClick={() => setShownKinds((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; })}
                    className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold transition ${on ? 'bg-white shadow-sm' : 'bg-sand-2 text-ink-2'}`}
                    style={{ borderColor: ALONG[k].color }}>
                    <span className="h-2 w-2 rounded-full" style={{ background: ALONG[k].color }} aria-hidden="true" />
                    {ALONG[k].label} {alongCounts.get(k)}
                  </button>
                );
              })}
            </div>
          )}
          {/* The saved places and their filters live beside the map (under it on a phone), so the map stays clear. */}
          {p.dayRoute || p.places.length > 0 ? null : !p.selected ? (
            <p className="pointer-events-auto w-fit rounded-xl bg-white/95 px-3.5 py-2 text-sm font-semibold text-ink-2 shadow">
              חפשו מקום, או לחצו על כל מקום במפה כדי לשמור אותו לטיול.
            </p>
          ) : null}
        </div>
      )}

      {p.selected && (
        <div className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col sm:absolute sm:z-20 sm:inset-x-auto sm:top-4 sm:bottom-auto sm:left-4 sm:max-h-[calc(100%-2rem)] sm:w-[390px]">
          <div className="flex min-h-0 flex-col">
            <PlaceCard
              key={p.selected.googlePlaceId}
              googlePlaceId={p.selected.googlePlaceId}
              sessionToken={p.selected.sessionToken}
              saved={saved}
              isHotel={!!saved && saved.id === p.hotelId}
              onLoaded={showTemporaryPin}
              onClose={() => p.onSelect(null)}
              back={p.back ?? null}
              openNearby={!!p.openNearby}
              actions={p.card}
            />
          </div>
        </div>
      )}

      <div aria-live="polite" className="pointer-events-none absolute inset-x-0 bottom-6 z-30 flex justify-center">
        {p.toast && <span className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-white shadow-lg">{p.toast}</span>}
      </div>
    </div>
  );
}

function fitTo(map: google.maps.Map, pts: { lat: number; lng: number }[]) {
  if (pts.length === 1) {
    map.setCenter({ lat: pts[0]!.lat, lng: pts[0]!.lng });
    map.setZoom(15);
  } else if (pts.length > 1) {
    const b = new google.maps.LatLngBounds();
    pts.forEach((x) => b.extend({ lat: x.lat, lng: x.lng }));
    map.fitBounds(b, 70);
  }
}

function MapMessage({ title, text }: { title: string; text?: string }) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center p-6">
      <div className="max-w-sm rounded-2xl bg-white/95 p-5 text-center shadow-lg" role="status">
        <p className="text-lg font-extrabold">{title}</p>
        {text && <p className="mt-1 text-ink-2">{text}</p>}
      </div>
    </div>
  );
}
