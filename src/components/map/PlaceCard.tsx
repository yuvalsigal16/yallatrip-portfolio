'use client';

import { looksKosher, nearbyDetail } from '@/lib/places/nearbyGroups';
import { ISRAELI_NOTE, israeliHostelsNear } from '@/lib/places/israeliHostels';
import { useEffect, useState } from 'react';
import { Avatar } from '@/components/Avatar';
import { getPlaceReviews, type TravelerReview } from '@/app/trips/plan-actions';
import { CATEGORIES, categoryMeta, guessCategory, type CategoryKey } from '@/lib/places/categories';
import type { NearbyPlace, Place } from '@/lib/google/mappers';
import type { MapPlace } from '@/lib/places/queries';
import { formatDistanceHe } from '@/lib/geo';
import { ReviewEditor } from '@/components/trip/ReviewEditor';
import { AROUND_KINDS, type AroundKind } from '@/lib/places/around';
import { CreatorRecs } from './CreatorRecs';
import { recommendationsNear } from '@/app/recommendation-actions';
import type { CreatorRec, RecCategory } from '@/lib/recommendations';
import { FEATURES } from '@/lib/features';

/** What the card can do. Implemented by TripWorkspace, which owns the trip's data. */
export type CardActions = {
  tripId: string;
  busy: boolean;
  days: { id: string; label: string }[];
  daysOf: (savedPlaceId: string) => string[];
  isSaved: (googlePlaceId: string) => boolean;
  /** `note` is written as the traveller's own note on the saved place (only when it has none). */
  onSave: (googlePlaceId: string, category: CategoryKey, opts?: { note?: string; sessionToken?: string }) => Promise<boolean>;
  onRemove: (saved: MapPlace) => Promise<boolean>;
  onCategory: (saved: MapPlace, key: CategoryKey) => Promise<void>;
  onToggleHotel: (saved: MapPlace) => Promise<void>;
  onAddToDay: (saved: MapPlace, dayId: string) => Promise<void>;
  /** The days of the week the place opens (from the card's details, no extra call), for the "closed that day" check. */
  onHours?: (googlePlaceId: string, openDays: number[] | null) => void;
  /** `from` = the card this place was opened from (its "near here" list), so the new card can lead back to it. */
  onOpenPlace: (googlePlaceId: string, from?: { googlePlaceId: string; name: string }) => void;
  /** The kinds of places this trip is about (from the trip's travel styles), best first. */
  interests: CategoryKey[];
  /** Trip with children: "near here" leads with kid-friendly places. */
  withKids?: boolean;
  /** The traveller keeps kosher: "מסעדות כשרות" leads, and stands out, under "🇮🇱 ישראלי". */
  keepsKosher?: boolean;
  onNearbyAdded: (anchor: MapPlace | undefined, googlePlaceId: string, category: CategoryKey) => void;
};

type Props = {
  googlePlaceId: string;
  sessionToken?: string;
  saved?: MapPlace;
  isHotel: boolean;
  onLoaded: (place: Place) => void;
  onClose: () => void;
  /** Came here from another place's "near here" list: a way back to that place. */
  back?: { label: string; go: () => void } | null;
  /** Open with the "near here" list showing (when coming back to it). */
  openNearby?: boolean;
  actions: CardActions;
};

// key = what to search for nearby; save = the category a found place is saved under.
/**
 * The place card: real details from Google (a missing field says so, never guessed),
 * the actions on it, and "near here" suggestions around it.
 */
export function PlaceCard({ googlePlaceId, sessionToken, saved, isHotel, onLoaded, onClose, back, openNearby, actions: a }: Props) {
  const [place, setPlace] = useState<Place | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [category, setCategory] = useState<CategoryKey>('attraction');
  const [showNearby, setShowNearby] = useState(!!openNearby);
  const [showAround, setShowAround] = useState(false);
  // "Rate & recommend": stars, a few words and photos, seen only by YallaTrip travellers. A place not in the trip is saved first.
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewsKey, setReviewsKey] = useState(0);
  // The month's full place cards are used up: name and address only, until the start of the month.
  const [limited, setLimited] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams({ level: 'card' });
    if (sessionToken) qs.set('sessionToken', sessionToken);
    fetch(`/api/places/${encodeURIComponent(googlePlaceId)}?${qs}`)
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as { place?: Place; error?: string; limited?: boolean };
        if (cancelled) return;
        if (!res.ok || !body.place) return setError(body.error ?? 'לא הצלחנו לטעון את פרטי המקום');
        setPlace(body.place);
        setLimited(body.limited === true);
        setCategory(guessCategory(body.place.primaryType));
        onLoaded(body.place);
        a.onHours?.(googlePlaceId, body.place.openDays ?? null);
      })
      .catch(() => !cancelled && setError('אין חיבור. נסו שוב'));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googlePlaceId]);

  const meta = categoryMeta(saved?.categoryKey ?? category);
  const name = place?.name ?? saved?.label ?? '';
  const inDays = saved ? a.daysOf(saved.id) : [];
  const hasIsraeli = !!place?.location && israeliChoices(place.location, a.keepsKosher).length > 0;

  return (
    <article aria-label={name || 'פרטי מקום'} className="flex min-h-0 flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
      <div className="relative h-28 shrink-0 sm:h-36" style={{ background: meta.tint }}>
        {place?.photo && !photoFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/places/photo?w=800&name=${encodeURIComponent(place.photo.name)}`} alt={name} className="h-full w-full object-cover" loading="lazy" onError={() => setPhotoFailed(true)} />
        ) : (
          <div className="flex h-full items-center justify-center" aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: `<svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="${meta.color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${meta.icon}</svg>` }} />
        )}
        {back && (
          <button type="button" onClick={back.go} data-tour="p-back"
            className="absolute right-3 top-3 flex h-10 max-w-[70%] items-center gap-1.5 rounded-full bg-white/95 px-3 text-sm font-bold text-[#0C2D4A] shadow">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            <span className="truncate">חזרה ל{back.label}</span>
          </button>
        )}
        <button type="button" onClick={onClose} aria-label="סגירת כרטיס המקום"
          className="absolute top-3 left-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 shadow">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0C2D4A" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
        {place?.photo?.attributions[0]?.displayName && (
          <span className="absolute right-3 bottom-2 rounded bg-black/45 px-1.5 text-[11px] text-white">
            צילום: {place.photo.attributions[0].uri
              ? <a href={place.photo.attributions[0].uri} target="_blank" rel="noopener noreferrer" className="text-white">{place.photo.attributions[0].displayName}</a>
              : place.photo.attributions[0].displayName}
          </span>
        )}
      </div>

      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain p-5">
        {error ? (
          <p role="alert" className="font-semibold text-danger">{error}</p>
        ) : !place ? (
          <div className="flex flex-col gap-2" aria-busy="true" aria-label="טוען">
            <div className="h-7 w-2/3 animate-pulse rounded bg-sand-2" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-sand-2" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-sand-2" />
          </div>
        ) : (
          <>
            <div>
              <h2 className="font-display text-[27px] font-bold leading-tight">{name || 'מקום בלי שם'}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-2">
                <span className="font-semibold" style={{ color: meta.color }}>● {isHotel ? 'המלון של הטיול' : meta.name}</span>
                {!limited && <span className="text-[#A9C3D8]">·</span>}
                {limited ? null : place.rating !== null ? (
                  <span><b className="text-ink">★ {place.rating.toFixed(1)}</b>{place.ratingCount ? ` (${place.ratingCount.toLocaleString('he-IL')} דירוגים ב-Google)` : ''}</span>
                ) : <span className="text-muted">אין עדיין דירוג</span>}
              </div>
            </div>

            {FEATURES.routes && <CreatorRecs googlePlaceId={googlePlaceId} />}

            <div className="flex flex-col gap-1.5 text-[15px]">
              <p className={place.address ? '' : 'text-muted'}>{place.address ?? 'אין מידע על הכתובת'}</p>
              {limited && <p className="rounded-lg bg-sand-2 px-3 py-2 text-sm text-ink-2">דירוג, שעות ותמונה יחזרו בתחילת החודש.</p>}
              <div className={limited ? 'hidden' : ''}>
                {place.openNow === null ? <span className="text-muted">אין מידע על שעות פתיחה</span>
                  : place.openNow ? <b className="text-sea">פתוח עכשיו</b> : <b className="text-danger">סגור עכשיו</b>}
                {place.weeklyHours && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-sm font-bold text-ink-2">שעות לכל השבוע</summary>
                    <ul className="mt-1 text-sm text-ink-2">{place.weeklyHours.map((h) => <li key={h}>{h}</li>)}</ul>
                  </details>
                )}
              </div>
              {place.googleMapsUrl && (
                <a href={place.googleMapsUrl} target="_blank" rel="noopener noreferrer" data-tour="p-gmaps" className="w-fit text-sm font-bold">פתיחה ב-Google Maps ↗</a>
              )}
            </div>

            <hr className="border-line" />

            {!saved ? (
              <div className="flex flex-col gap-2.5">
                <div data-tour="p-category"><Select label="קטגוריה" value={category} onChange={(v) => setCategory(v as CategoryKey)}
                  options={CATEGORIES.map((c) => ({ value: c.key, label: c.name }))} /></div>
                <button type="button" disabled={a.busy} onClick={() => a.onSave(googlePlaceId, category)} data-tour="p-save"
                  className="min-h-12 rounded-xl bg-terracotta px-5 font-bold text-white hover:bg-[#135CA6] disabled:opacity-60">
                  {a.busy ? 'שומרים...' : '+ הוספה לטיול'}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                <p className="font-bold text-sea">
                  ✓ שמור בטיול{inDays.length ? ` · ${inDays.join(', ')}` : ' · עוד לא משובץ ביום'}
                </p>
                <Select label="קטגוריה" value={saved.categoryKey ?? ''} disabled={a.busy}
                  onChange={(v) => a.onCategory(saved, v as CategoryKey)}
                  options={[...(saved.categoryKey ? [] : [{ value: '', label: 'בלי קטגוריה' }]), ...CATEGORIES.map((c) => ({ value: c.key, label: c.name }))]} />
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={a.busy} onClick={() => a.onToggleHotel(saved)} data-tour="p-hotel"
                    className="min-h-11 flex-1 rounded-xl border border-line bg-white px-3 text-sm font-bold hover:bg-sand disabled:opacity-60">
                    {isHotel ? 'ביטול "המלון שלנו"' : 'זה המלון שלנו'}
                  </button>
                  {!confirmRemove ? (
                    <button type="button" disabled={a.busy} onClick={() => setConfirmRemove(true)}
                      className="min-h-11 flex-1 rounded-xl px-3 text-sm font-bold text-[#B42318] hover:bg-[#FEF3F2]">הסרה מהטיול</button>
                  ) : (
                    <div className="flex w-full items-center gap-2 rounded-xl bg-[#FEF3F2] p-2" role="group" aria-label="אישור הסרה">
                      <span className="flex-1 px-1 text-sm font-semibold">להסיר? הוא יוסר גם מכל הימים.</span>
                      <button type="button" disabled={a.busy} onClick={async () => { if (await a.onRemove(saved)) onClose(); }}
                        className="min-h-10 rounded-lg bg-[#B42318] px-3 text-sm font-bold text-white">כן, להסיר</button>
                      <button type="button" onClick={() => setConfirmRemove(false)} className="min-h-10 rounded-lg px-3 text-sm font-bold">ביטול</button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tickets after the main action, so "+ add to trip" is on a phone's first screen */}
            <div data-tour="p-tickets"><Tickets place={place} name={name} /></div>

            {/* Rating is for a place already in the trip; while just searching, the card stays short. */}
            {saved && (
              <div className="flex flex-col gap-2" data-tour="p-my-review">
                <button type="button" aria-expanded={reviewOpen} disabled={a.busy} onClick={() => setReviewOpen((v) => !v)}
                  className="flex min-h-11 w-full items-center justify-between rounded-xl border border-line bg-white px-4 font-extrabold hover:bg-sand disabled:opacity-60">
                  <span>⭐ לדרג ולהמליץ</span>
                  <span aria-hidden="true">{reviewOpen ? '−' : '+'}</span>
                </button>
                {reviewOpen && (
                  <ReviewEditor tripId={a.tripId} savedPlaceId={saved.id} onSaved={() => setReviewsKey((k) => k + 1)} />
                )}
              </div>
            )}

            {saved && <div data-tour="p-reviews"><TravelerReviews key={reviewsKey} googlePlaceId={googlePlaceId} /></div>}

            {place.location && (
              <div className="mt-1">
                {/* Two ways to look around this place, side by side; one opens at a time. "🇮🇱 ישראלי" only when it has something for this traveller here. */}
                <div className={`grid gap-2 ${hasIsraeli ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {hasIsraeli && <button type="button" aria-expanded={showNearby} onClick={() => { setShowNearby((v) => !v); setShowAround(false); }} data-tour={a.keepsKosher ? 'p-nearby-kosher' : 'p-nearby'}
                    className="flex min-h-11 items-center justify-between gap-0.5 rounded-xl bg-terracotta-tint px-2.5 text-sm font-extrabold min-[380px]:text-[15px] text-terracotta">
                    <span className="whitespace-nowrap">🇮🇱 ישראלי</span>
                    <Chevron open={showNearby} />
                  </button>}
                  <button type="button" aria-expanded={showAround} onClick={() => { setShowAround((v) => !v); setShowNearby(false); }} data-tour="p-around"
                    className="flex min-h-11 items-center justify-between gap-0.5 rounded-xl bg-terracotta-tint px-2.5 text-sm font-extrabold min-[380px]:text-[15px] text-terracotta">
                    <span className="whitespace-nowrap">✨ מה יש בסביבה</span>
                    <Chevron open={showAround} />
                  </button>
                </div>
                {hasIsraeli && showNearby && (
                  <Nearby center={place.location} anchor={saved} selfId={googlePlaceId}
                    actions={{ ...a, onOpenPlace: (g) => a.onOpenPlace(g, { googlePlaceId, name: place.name ?? saved?.label ?? 'המקום הקודם' }) }} />
                )}
                {showAround && (
                  <Around center={place.location} anchor={saved} selfId={googlePlaceId}
                    actions={{ ...a, onOpenPlace: (g) => a.onOpenPlace(g, { googlePlaceId, name: place.name ?? saved?.label ?? 'המקום הקודם' }) }} />
                )}
              </div>
            )}
          </>
        )}
      </div>
    </article>
  );
}

/** "Near here": real places around this one. Opens on "for you" (the trip's travel styles). */
type NearbyItem = NearbyPlace & { cat: CategoryKey; detail: string | null; kosher: boolean };

// Kept for the visit: coming back to a card (the "back" arrow) shows the same list without asking Google again.
const nearbyCache = new Map<string, NearbyItem[]>();
const nearbyChoice = new Map<string, { cat: string; kosherOnly: boolean }>();

async function fetchNearby(center: { lat: number; lng: number }, search: string, cat: CategoryKey, radius: number): Promise<NearbyItem[]> {
  const key = `${center.lat.toFixed(5)},${center.lng.toFixed(5)}|${search}|${cat}|${radius}`;
  const hit = nearbyCache.get(key);
  if (hit) return hit;
  const list = await fetchNearbyFresh(center, search, cat, radius);
  nearbyCache.set(key, list);
  return list;
}

async function fetchNearbyFresh(center: { lat: number; lng: number }, search: string, cat: CategoryKey, radius: number): Promise<NearbyItem[]> {
  const res = await fetch('/api/places/nearby', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat: center.lat, lng: center.lng, category: search, radius }),
  });
  const body = (await res.json().catch(() => ({}))) as { places?: NearbyPlace[]; error?: string };
  if (!res.ok) throw new Error(body.error ?? 'לא הצלחנו לטעון המלצות');
  return (body.places ?? []).map((x) => {
    const d = nearbyDetail(x.primaryType, cat);
    return { ...x, cat: d.save, detail: d.label, kosher: search === 'kosher' || (d.food && looksKosher(x.name)) };
  });
}

/** Hostels known among Israeli travellers, from our own fixed list (no search until one is tapped). */
function IsraeliHostels({ center, actions: a }: { center: { lat: number; lng: number }; actions: CardActions }) {
  const list = israeliHostelsNear(center);
  const [busyName, setBusyName] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [miss, setMiss] = useState<string | null>(null);
  if (!list.length) return null;
  // The list holds names only: the place itself is found on Google when tapped.
  const find = async (h: (typeof list)[number]) => {
    const sessionToken = crypto.randomUUID();
    const res = await fetch('/api/places/autocomplete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: `${h.name} ${h.town}`, sessionToken, bias: { lat: h.lat, lng: h.lng } }),
    }).catch(() => null);
    const body = res ? ((await res.json().catch(() => ({}))) as { suggestions?: { placeId: string }[] }) : {};
    const placeId = res?.ok ? body.suggestions?.[0]?.placeId : undefined;
    if (!placeId) setMiss(`לא מצאנו את ${h.name} ב-Google. אפשר לחפש אותו בשם בשורת החיפוש.`);
    return placeId ? { placeId, sessionToken } : null;
  };
  const run = async (h: (typeof list)[number], save: boolean) => {
    setMiss(null);
    setBusyName(h.name);
    const hit = await find(h);
    if (hit && !save) a.onOpenPlace(hit.placeId);
    if (hit && save && (a.isSaved(hit.placeId) || (await a.onSave(hit.placeId, 'hotel', { note: ISRAELI_NOTE, sessionToken: hit.sessionToken })))) {
      setAdded((s) => new Set(s).add(h.name));
    }
    setBusyName(null);
  };
  return (
    <section className="rounded-xl border border-[#BFD9F2] bg-[#F1F7FD] p-2.5" aria-label="הוסטלים של ישראלים" data-tour="il-hostels">
      <p className="text-sm font-extrabold">הוסטלים של ישראלים בסביבה</p>
      <ul className="flex flex-col divide-y divide-[#D5E6F7]">
        {list.map((h) => (
          <li key={h.name} className="flex items-center gap-2 py-1.5">
            <button type="button" disabled={!!busyName} onClick={() => run(h, false)} className="min-w-0 flex-1 text-right">
              <span className="block truncate font-bold"><span dir="ltr">{h.name}</span>{h.he && ` · ${h.he}`}</span>
              <span className="text-xs text-ink-2"><span dir="ltr">{h.town}</span> · {formatDistanceHe(h.meters)} · {ISRAELI_NOTE}</span>
            </button>
            {added.has(h.name) ? <span className="text-xs font-bold text-sea">✓ שמור</span> : (
              <button type="button" disabled={!!busyName || a.busy} aria-label={`הוספה לטיול: ${h.name}`} onClick={() => run(h, true)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-xl font-bold hover:bg-sand disabled:opacity-50">
                {busyName === h.name ? '…' : '+'}
              </button>
            )}
          </li>
        ))}
      </ul>
      {miss && <p role="alert" className="text-xs font-semibold text-danger">{miss}</p>}
      <p className="text-xs text-muted">רשימה שאספנו מאתרי מטיילים ישראלים. נשמר עם ההערה {ISRAELI_NOTE}. כדאי לוודא מול המקום שהוא פעיל.</p>
    </section>
  );
}

/**
 * What is close to this place, only where YallaTrip is unique for Israelis: kosher food, Chabad, Israeli hostels.
 * Kosher food and Chabad show only to a traveller who keeps kosher. Nothing is searched until one is tapped.
 */
const ISRAELI_NEARBY = [
  { key: 'kosher', label: 'מסעדות כשרות', save: 'restaurant' as CategoryKey, kosher: true },
  { key: 'chabad', label: 'בית חב״ד', save: 'attraction' as CategoryKey, kosher: true },
  { key: 'hostels', label: 'הוסטלים של ישראלים', save: 'hotel' as CategoryKey, kosher: false },
];
/** The "🇮🇱 ישראלי" choices for this traveller here (the hostels only where our list has one nearby). None = no "🇮🇱 ישראלי" button. */
const israeliChoices = (center: { lat: number; lng: number }, keepsKosher?: boolean) =>
  ISRAELI_NEARBY.filter((c) => (c.kosher ? !!keepsKosher : israeliHostelsNear(center).length > 0));

function Nearby({ center, anchor, selfId, actions: a }: { center: { lat: number; lng: number }; anchor?: MapPlace; selfId: string; actions: CardActions }) {
  const spot = `${center.lat.toFixed(5)},${center.lng.toFixed(5)}`;
  const choices = israeliChoices(center, a.keepsKosher);
  // Only one choice (the hostels, from our own list, no search): open it right away.
  const [cat, setCat] = useState<string | null>(() => {
    const was = nearbyChoice.get(spot)?.cat ?? null;
    if (was && choices.some((c) => c.key === was)) return was;
    return choices.length === 1 ? choices[0]!.key : null;
  });
  const [items, setItems] = useState<NearbyItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setError(null);
    if (!cat || cat === 'hostels') return;
    nearbyChoice.set(spot, { cat, kosherOnly: false });
    const save = ISRAELI_NEARBY.find((c) => c.key === cat)?.save ?? 'attraction';
    fetchNearby(center, cat, save, 1000)
      // The place itself is not "near here".
      .then((list) => !cancelled && setItems(list.filter((x) => x.googlePlaceId !== selfId)))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : 'אין חיבור'));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, center.lat, center.lng]);

  return (
    <div className="mt-3 flex flex-col gap-2">
      {choices.length > 1 && <div className="flex flex-wrap gap-1.5" role="group" aria-label="מה לחפש בסביבה">
        {choices.map((c) => {
          // Keeps kosher: the kosher button is first (it already is) and stands out in green until chosen.
          const strong = a.keepsKosher && c.key === 'kosher' && cat !== c.key;
          return (
            <button key={c.key} type="button" aria-pressed={cat === c.key} onClick={() => setCat(c.key)}
              className={`min-h-10 shrink-0 rounded-full border px-3 text-sm font-bold ${cat === c.key ? 'border-ink bg-ink text-white' : strong ? 'border-[#3F7F4A] bg-[#E3F0E3] text-[#24613A]' : 'border-line bg-white'}`}>
              {c.label}
            </button>
          );
        })}
      </div>}
      {!cat && <p className="text-xs text-muted">בוחרים מה לחפש, ורק אז מחפשים.</p>}
      {cat === 'hostels' && <IsraeliHostels center={center} actions={a} />}
      {cat === 'kosher' && <p className="text-xs text-muted">מקומות שמופיעים ב-Google ככשרים, עד 10 ק״מ, מהקרוב לרחוק. את תעודת הכשרות כדאי לבדוק במקום.</p>}
      {cat === 'chabad' && <p className="text-xs text-muted">בתי חב״ד עד 60 ק״מ, מהקרוב לרחוק. מידע מ-Google.</p>}
      {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
      {cat && cat !== 'hostels' && !items && !error && <div className="h-16 animate-pulse rounded-xl bg-sand-2" aria-label="טוען" />}
      {items && items.length === 0 && <p className="text-sm text-ink-2">{cat === 'kosher' ? 'לא נמצאו מקומות כשרים עד 10 ק״מ מכאן.' : 'לא נמצא בית חב״ד עד 60 ק״מ מכאן.'}</p>}
      {items && items.length > 0 && (
        <ul className="flex flex-col divide-y divide-line">
          {items.map((n) => {
            const already = a.isSaved(n.googlePlaceId);
            return (
              <li key={n.googlePlaceId} className="flex items-center gap-2 py-2">
                <button type="button" onClick={() => a.onOpenPlace(n.googlePlaceId)} className="min-w-0 flex-1 text-right">
                  <span className="block truncate font-bold">{n.name ?? 'מקום בלי שם'}</span>
                  <span className="text-xs text-ink-2">
                    {(n.detail ?? categoryMeta(n.cat)?.name) && `${n.detail ?? categoryMeta(n.cat)?.name} · `}
                    {n.kosher && <b className="text-[#3F7F4A]">כשר · </b>}
                    {n.rating !== null ? `★ ${n.rating.toFixed(1)}` : 'אין דירוג'}
                    {n.distanceMeters !== null && ` · ${formatDistanceHe(n.distanceMeters)}`}
                    {n.openNow !== null && (n.openNow ? ' · פתוח עכשיו' : ' · סגור עכשיו')}
                  </span>
                </button>
                {already ? (
                  <span className="text-xs font-bold text-sea">✓ שמור</span>
                ) : (
                  <button type="button" disabled={!!adding || a.busy} aria-label={`הוספה לטיול: ${n.name ?? ''}`}
                    onClick={async () => {
                      setAdding(n.googlePlaceId);
                      if (await a.onSave(n.googlePlaceId, n.cat)) a.onNearbyAdded(anchor, n.googlePlaceId, n.cat);
                      setAdding(null);
                    }}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line text-xl font-bold hover:bg-sand disabled:opacity-50">
                    {adding === n.googlePlaceId ? '…' : '+'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}><path d="M6 9l6 6 6-6" /></svg>
  );
}

/** "✨ מה יש בסביבה": one search at Google, only once a kind is chosen; best-loved first. */
type AroundItem = NearbyPlace & { cat: CategoryKey; detail: string | null };

// Kept on this phone for the visit only (Google's terms don't allow storing the results), so going back
// to a card shows the same list without searching again.
const aroundCache = new Map<string, AroundItem[]>();

async function fetchAround(center: { lat: number; lng: number }, kind: AroundKind): Promise<AroundItem[]> {
  const key = `${center.lat.toFixed(5)},${center.lng.toFixed(5)}|${kind}`;
  const hit = aroundCache.get(key);
  if (hit) return hit;
  const res = await fetch('/api/places/around', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat: center.lat, lng: center.lng, kind }),
  });
  const body = (await res.json().catch(() => ({}))) as { places?: NearbyPlace[]; error?: string };
  if (!res.ok) throw new Error(body.error ?? 'לא הצלחנו לחפש כרגע');
  const list = (body.places ?? []).map((x) => {
    const d = nearbyDetail(x.primaryType, AROUND_KINDS[kind].save);
    return { ...x, cat: d.save, detail: d.label };
  });
  aroundCache.set(key, list);
  return list;
}

// Which creators' recommendations go with each kind ("איך מגיעים" has none).
const REC_KINDS: Record<AroundKind, RecCategory[]> = { eat: ['food'], sleep: ['sleep'], see: ['see', 'other'], getthere: [] };

function Around({ center, anchor, selfId, actions: a }: { center: { lat: number; lng: number }; anchor?: MapPlace; selfId: string; actions: CardActions }) {
  const [kind, setKind] = useState<AroundKind | null>(null);
  const [items, setItems] = useState<AroundItem[] | null>(null);
  // Creators' recommendations near here come first, marked ⭐ (free, from our own table).
  const [recs, setRecs] = useState<CreatorRec[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setError(null);
    setRecs([]);
    if (!kind) return;
    if (FEATURES.routes && REC_KINDS[kind].length) {
      recommendationsNear({ lat: center.lat, lng: center.lng, radius: AROUND_KINDS[kind].radius, categories: REC_KINDS[kind] })
        .then((r) => !cancelled && setRecs(r.filter((x) => x.googlePlaceId !== selfId)))
        .catch(() => {});
    }
    fetchAround(center, kind)
      // The place itself is not "around" it.
      .then((list) => !cancelled && setItems(list.filter((x) => x.googlePlaceId !== selfId)))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : 'אין חיבור'));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, center.lat, center.lng]);

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="מה לחפש בסביבה">
        {(Object.keys(AROUND_KINDS) as AroundKind[]).map((k) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}
            className={`min-h-10 shrink-0 rounded-full border px-3 text-sm font-bold ${kind === k ? 'border-ink bg-ink text-white' : 'border-line bg-white'}`}>
            {AROUND_KINDS[k].label}
          </button>
        ))}
      </div>
      {!kind && <p className="text-xs text-muted">בוחרים מה לחפש, ורק אז מחפשים. האהובים ביותר קודם.</p>}
      {error && <p role="alert" className="text-sm font-semibold text-danger">{error}</p>}
      {kind && recs.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="המלצות של יוצרי תוכן">
          {recs.map((r) => {
            const already = a.isSaved(r.googlePlaceId);
            return (
              <li key={r.id} className="flex items-start gap-2 rounded-xl border border-[#F2D58A] bg-[#FFF8E6] p-2.5">
                <button type="button" onClick={() => a.onOpenPlace(r.googlePlaceId)} className="min-w-0 flex-1 text-right">
                  <span className="block truncate font-bold">⭐ {r.name}</span>
                  <span className="block text-xs font-bold text-[#8A5A00]">מומלץ ע״י {r.creator}{r.distanceMeters != null && ` · ${formatDistanceHe(r.distanceMeters)}`}</span>
                  <span className="mt-0.5 line-clamp-2 block text-xs text-ink-2">{r.body}</span>
                </button>
                {already ? (
                  <span className="pt-2 text-xs font-bold text-sea">✓ שמור</span>
                ) : (
                  <button type="button" disabled={!!adding || a.busy} aria-label={`הוספה לטיול: ${r.name}`}
                    onClick={async () => {
                      setAdding(r.googlePlaceId);
                      const cat = AROUND_KINDS[kind].save;
                      if (await a.onSave(r.googlePlaceId, cat)) a.onNearbyAdded(anchor, r.googlePlaceId, cat);
                      setAdding(null);
                    }}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-xl font-bold hover:bg-sand disabled:opacity-50">
                    {adding === r.googlePlaceId ? '…' : '+'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {kind && !items && !error && <div className="h-16 animate-pulse rounded-xl bg-sand-2" aria-label="טוען" />}
      {items && items.length === 0 && recs.length === 0 && <p className="text-sm text-ink-2">לא נמצאו מקומות כאלה בסביבה.</p>}
      {items && items.length > 0 && (
        <ul className="flex flex-col divide-y divide-line">
          {items.filter((n) => !recs.some((r) => r.googlePlaceId === n.googlePlaceId)).map((n) => {
            const already = a.isSaved(n.googlePlaceId);
            return (
              <li key={n.googlePlaceId} className="flex items-center gap-2 py-2">
                <button type="button" onClick={() => a.onOpenPlace(n.googlePlaceId)} className="min-w-0 flex-1 text-right">
                  <span className="block truncate font-bold">{n.name ?? 'מקום בלי שם'}</span>
                  <span className="text-xs text-ink-2">
                    {n.detail ?? categoryMeta(n.cat)?.name}
                    {n.distanceMeters !== null && ` · ${formatDistanceHe(n.distanceMeters)}`}
                  </span>
                </button>
                {already ? (
                  <span className="text-xs font-bold text-sea">✓ שמור</span>
                ) : (
                  <button type="button" disabled={!!adding || a.busy} aria-label={`הוספה לטיול: ${n.name ?? ''}`}
                    onClick={async () => {
                      setAdding(n.googlePlaceId);
                      if (await a.onSave(n.googlePlaceId, n.cat)) a.onNearbyAdded(anchor, n.googlePlaceId, n.cat);
                      setAdding(null);
                    }}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line text-xl font-bold hover:bg-sand disabled:opacity-50">
                    {adding === n.googlePlaceId ? '…' : '+'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Select({ label, value, options, onChange, disabled }: {
  label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-bold">
      {label}
      <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-xl border border-line bg-white px-3 text-base font-normal disabled:opacity-60">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

/** What YallaTrip travelers who were there wrote about this place, with their own photos. */
function TravelerReviews({ googlePlaceId }: { googlePlaceId: string }) {
  const [list, setList] = useState<TravelerReview[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    getPlaceReviews({ googlePlaceId }).then((r) => !cancelled && setList(r.ok ? r.data : []));
    return () => { cancelled = true; };
  }, [googlePlaceId]);
  if (!list || list.length === 0) return null;
  const rated = list.filter((r) => r.rating);
  const avg = rated.length ? rated.reduce((s, r) => s + r.rating!, 0) / rated.length : null;
  return (
    <section aria-labelledby="gt-reviews" className="flex flex-col gap-2.5">
      <h3 id="gt-reviews" className="font-extrabold">המלצות של מטיילים ב-YallaTrip <span className="font-semibold text-muted">({list.length})</span></h3>
      {avg !== null && (
        <p className="text-sm font-bold"><span className="text-[#F5A623]">★</span> {avg.toFixed(1)} <span className="font-semibold text-muted">· {rated.length === 1 ? 'דירוג אחד' : `${rated.length} דירוגים`} של מטיילי YallaTrip</span></p>
      )}
      {list.map((r, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-xl bg-sand p-3">
          <div className="flex items-center gap-2">
            <Avatar url={r.avatar} name={r.name} size={28} />
            <b className="text-sm">{r.mine ? 'ההמלצה שלך' : r.name || 'מטייל/ת'}</b>
            {r.rating && <span className="text-sm text-[#F5A623]" aria-label={`${r.rating} כוכבים`}>{'★'.repeat(r.rating)}</span>}
            <span className="text-xs text-muted">{new Date(r.updated_at).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })}</span>
          </div>
          {r.review && <p className="whitespace-pre-line text-[15px] leading-relaxed">{r.review}</p>}
          {r.photos.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {r.photos.map((u) => (
                <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="תמונה של מטייל/ת מהמקום" loading="lazy" className="h-24 w-24 rounded-lg object-cover" />
                </a>
              ))}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

// Places that usually sell entry tickets (museums, attractions, parks with a gate...).
const TICKETED = new Set([
  'museum', 'art_gallery', 'art_museum', 'history_museum', 'tourist_attraction', 'amusement_park', 'theme_park', 'water_park',
  'zoo', 'aquarium', 'wildlife_park', 'planetarium', 'observation_deck', 'historical_landmark', 'cultural_landmark',
  'historical_place', 'monument', 'castle', 'palace', 'botanical_garden', 'performing_arts_theater', 'opera_house',
  'concert_hall', 'national_park', 'amphitheatre', 'cathedral',
]);

/** Where to buy tickets and what they cost, for places that usually charge entry (like the Louvre). */
function Tickets({ place, name }: { place: Place; name: string }) {
  const types = [place.primaryType, ...(place.types ?? [])].filter(Boolean) as string[];
  if (!types.some((t) => TICKETED.has(t))) return null;
  const q = encodeURIComponent(name);
  const r = place.priceRange;
  const fmt = (n: number, c: string) => {
    try { return new Intl.NumberFormat('he-IL', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n); }
    catch { return `${Math.round(n)} ${c}`; }
  };
  const range = r && r.start !== null
    ? (r.end !== null && r.end !== r.start ? `${fmt(r.start, r.currency)}–${fmt(r.end, r.currency)}` : `מ-${fmt(r.start, r.currency)}`)
    : r && r.end !== null ? `עד ${fmt(r.end, r.currency)}` : null;
  const sellers = [
    { label: 'GetYourGuide', href: `https://www.getyourguide.com/s/?q=${q}` },
    { label: 'Tiqets', href: `https://www.tiqets.com/en/search?q=${q}` },
    { label: 'Viator', href: `https://www.viator.com/searchResults/all?text=${q}` },
  ];
  const link = 'inline-flex min-h-10 items-center rounded-full border border-line bg-white px-3.5 text-sm font-bold text-ink no-underline hover:border-terracotta hover:text-terracotta';
  return (
    <section aria-labelledby="tickets-h" className="flex flex-col gap-2 rounded-xl border border-[#D6E6F4] bg-[#F4F9FE] p-3">
      <h3 id="tickets-h" className="font-extrabold">כרטיסים ומחירים</h3>
      <p className="text-sm">
        {range ? <>טווח מחירים לפי Google: <b>{range}</b></> : <span className="text-ink-2">Google לא מפרסם מחיר למקום הזה. המחיר המעודכן מופיע באתרים למטה.</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        {place.website && (
          <a href={place.website} target="_blank" rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center rounded-full bg-terracotta px-4 text-sm font-bold text-white no-underline hover:brightness-110">האתר הרשמי ↗</a>
        )}
        {sellers.map((s) => (
          <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className={link}>{s.label} ↗</a>
        ))}
      </div>
      <p className="text-xs text-muted">החיפוש נפתח באתר המוכר לפי שם המקום. המחיר ותנאי הכניסה נקבעים שם, וחלק מהמקומות בכניסה חופשית.</p>
    </section>
  );
}
