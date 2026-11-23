'use client';

import { useEffect, useMemo, useState } from 'react';
import { CATEGORIES, categoryMeta, type CategoryKey } from '@/lib/places/categories';
import type { MapPlace } from '@/lib/places/queries';
import type { PlanDay } from '@/lib/planning/queries';
import { filterSaved, type SavedFilter } from '@/lib/planning/rules';
import { setVisited, updateSavedPlace } from '@/app/trips/plan-actions';
import { ReviewEditor } from './ReviewEditor';
import { getVotes, votePlace, type PlaceVotes } from '@/app/trips/votes-actions';
import { FEATURES } from '@/lib/features';

export type Act = <T>(
  fn: () => Promise<{ ok: true; data: T } | { ok: false; error: string }>,
  success?: string,
) => Promise<{ ok: true; data: T } | null>;

type Props = {
  tripId: string;
  places: MapPlace[];
  setPlaces: (fn: (ps: MapPlace[]) => MapPlace[]) => void;
  hotelId: string | null;
  days: PlanDay[];
  busy: boolean;
  act: Act;
  addToDay: (savedPlaceId: string, dayId: string) => Promise<void>;
  onRemove: (sp: MapPlace) => Promise<boolean>;
  onCategory: (sp: MapPlace, key: CategoryKey) => Promise<void>;
  onShowOnMap: (googlePlaceId: string) => void;
  /** The trip's destination, to search imported names near it. */
  center?: { lat: number; lng: number } | null;
  /** A trip planned together: people vote on the saved places. */
  shared?: boolean;
  /** One place of a long trip is chosen: `places` holds only its saved places. */
  chapterName?: string | null;
  allPlaces?: MapPlace[];
  onShowAll?: () => void;
};

const STATUS: { key: SavedFilter['status']; label: string }[] = [
  { key: 'all', label: 'הכול' }, { key: 'saved', label: 'שמור' }, { key: 'planned', label: 'במסלול' }, { key: 'visited', label: 'ביקרתי' },
];

/** "What I saved": every saved place, with filters, search, notes and statuses. */
export function SavedPanel(p: Props) {
  const [filter, setFilter] = useState<SavedFilter>({ category: 'all', status: 'all', q: '' });
  const [open, setOpen] = useState<string | null>(null);
  const shown = useMemo(() => filterSaved(p.places, filter), [p.places, filter]);

  // ---------- votes (shared trips) ----------
  const [votes, setVotes] = useState<Map<string, PlaceVotes>>(new Map());
  const { tripId } = p;
  const shared = FEATURES.votes && !!p.shared;
  useEffect(() => {
    if (!shared) return;
    let off = false;
    void getVotes({ tripId }).then((r) => { if (!off && r.ok) setVotes(new Map(r.data.map((v) => [v.savedPlaceId, v]))); });
    return () => { off = true; };
  }, [shared, tripId]);
  const vote = async (savedPlaceId: string, want: 1 | -1) => {
    const cur = votes.get(savedPlaceId) ?? { savedPlaceId, up: 0, down: 0, mine: 0 as const };
    const next: 1 | -1 | 0 = cur.mine === want ? 0 : want;
    const updated: PlaceVotes = {
      savedPlaceId,
      up: cur.up - (cur.mine === 1 ? 1 : 0) + (next === 1 ? 1 : 0),
      down: cur.down - (cur.mine === -1 ? 1 : 0) + (next === -1 ? 1 : 0),
      mine: next,
    };
    setVotes((m) => new Map(m).set(savedPlaceId, updated));
    const r = await votePlace({ tripId, savedPlaceId, vote: next });
    if (!r.ok) setVotes((m) => new Map(m).set(savedPlaceId, cur));
  };

  const all = p.allPlaces ?? p.places;
  const chapterLine = p.chapterName && all.length !== p.places.length ? (
    <p className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-ink-2" data-tour="s-chapter">
      מוצג רק מה ששמרת ב{p.chapterName}{' '}
      <button type="button" onClick={p.onShowAll} className="font-bold text-[#1B73C9] underline">להציג את כל הטיול</button>
    </p>
  ) : null;

  if (p.places.length === 0 && all.length > 0) {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="font-display text-2xl font-bold">מה שמרתי</h2>
        {chapterLine}
        <p className="text-ink-2">עוד לא שמרת מקומות ב{p.chapterName}.</p>
      </div>
    );
  }

  if (p.places.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-line p-6 text-center" data-tour="s-empty">
        <p className="text-lg font-extrabold">עוד לא שמרת מקומות</p>
        <p className="mt-1 text-ink-2">חפשו מקום במפה, או לחצו על כל מקום שמסומן במפה, ובחרו "הוספה לטיול".</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {chapterLine}

      <div className="flex gap-1 rounded-xl bg-sand-2 p-1" role="group" aria-label="סינון לפי סטטוס" data-tour="s-status">
        {STATUS.map((s) => (
          <button key={s.key} type="button" aria-pressed={filter.status === s.key} onClick={() => setFilter({ ...filter, status: s.key })}
            className={`min-h-9 flex-1 rounded-lg text-sm font-bold ${filter.status === s.key ? 'bg-white shadow-sm' : 'text-ink-2'}`}>
            {s.label}
          </button>
        ))}
      </div>

      {shown.length === 0 && <p className="py-4 text-center text-ink-2">אין מקומות שמתאימים לסינון.</p>}
      <ul className="flex flex-col gap-2" data-tour="s-list">
        {shown.map((x) => (
          <Row key={x.id} x={x} {...p} isOpen={open === x.id} toggle={() => setOpen(open === x.id ? null : x.id)}
            votes={shared ? votes.get(x.id) ?? { savedPlaceId: x.id, up: 0, down: 0, mine: 0 } : null} onVote={(w) => vote(x.id, w)} />
        ))}
      </ul>
    </div>
  );
}

function Row({ x, isOpen, toggle, votes, onVote, ...p }: Props & { x: MapPlace; isOpen: boolean; toggle: () => void; votes: PlaceVotes | null; onVote: (want: 1 | -1) => void }) {
  const meta = categoryMeta(x.categoryKey);
  const isHotel = x.id === p.hotelId;
  const [label, setLabel] = useState(x.label);
  const [note, setNote] = useState(x.note ?? '');
  const [confirm, setConfirm] = useState(false);
  const inDays = p.days.filter((d) => d.stops.some((s) => s.savedPlaceId === x.id)).map((d) => d.dayIndex);

  const save = async (patch: { label?: string; note?: string | null; isMust?: boolean }, msg: string) => {
    const r = await p.act(() => updateSavedPlace({ tripId: p.tripId, savedPlaceId: x.id, ...patch }), msg);
    if (r) p.setPlaces((ps) => ps.map((y) => (y.id === x.id ? {
      ...y,
      ...(patch.label !== undefined && { label: patch.label.trim() }),
      ...(patch.note !== undefined && { note: patch.note?.trim() || null }),
      ...(patch.isMust !== undefined && { isMust: patch.isMust }),
    } : y)));
  };

  const toggleVisited = async () => {
    const r = await p.act(() => setVisited({ tripId: p.tripId, savedPlaceId: x.id, visited: x.status !== 'visited' }),
      x.status !== 'visited' ? 'סומן "ביקרתי"' : 'הסימון בוטל');
    if (r) p.setPlaces((ps) => ps.map((y) => (y.id === x.id ? { ...y, status: r.data } : y)));
  };

  return (
    <li className={`rounded-2xl border bg-white ${isOpen ? 'border-ink' : 'border-line'}`}>
      <button type="button" onClick={toggle} aria-expanded={isOpen} className="flex w-full items-center gap-3 p-3 text-right">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: meta.tint }} aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${meta.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${isHotel ? categoryMeta('hotel').icon : meta.icon}</svg>` }} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate font-extrabold">{x.label}</span>
            {x.isMust && <span className="shrink-0 rounded bg-[#F6EBD6] px-1.5 text-xs font-bold text-[#9A6412]">★ חובה</span>}
          </span>
          <span className="block text-sm text-ink-2">
            {isHotel ? 'המלון של הטיול' : meta.name}{inDays.length > 0 && ` · יום ${inDays.join(', ')}`}
          </span>
          {x.note && !isOpen && <span className="block truncate text-sm text-muted">✎ {x.note}</span>}
        </span>
        {/* A tag only for a place not in any day yet ("שמור"): the days are already written under the name. */}
        {x.status === 'saved' && <span className="shrink-0 rounded-full bg-sand-2 px-2.5 py-0.5 text-xs font-bold text-ink-2">שמור</span>}
      </button>
      {votes && (
        <div data-tour="s-votes" className="flex items-center gap-2 px-3 pb-2.5 text-sm" role="group" aria-label={`הצבעה על ${x.label}`}>
          <span className="text-ink-2">רוצים ללכת?</span>
          <button type="button" aria-pressed={votes.mine === 1} onClick={() => onVote(1)}
            className={`min-h-9 rounded-full border px-3 font-bold ${votes.mine === 1 ? 'border-[#3F7F4A] bg-[#E3F0E3] text-[#3F7F4A]' : 'border-line bg-white'}`}>👍 {votes.up}</button>
          <button type="button" aria-pressed={votes.mine === -1} onClick={() => onVote(-1)}
            className={`min-h-9 rounded-full border px-3 font-bold ${votes.mine === -1 ? 'border-[#B42318] bg-[#FDECEA] text-[#B42318]' : 'border-line bg-white'}`}>👎 {votes.down}</button>
        </div>
      )}

      {isOpen && (
        <div className="flex flex-col gap-3 border-t border-line p-3">
          <label className="flex flex-col gap-1 text-sm font-bold">שם
            <input value={label} maxLength={200} onChange={(e) => setLabel(e.target.value)}
              onBlur={() => label.trim() && label.trim() !== x.label && save({ label }, 'השם עודכן')}
              className="h-10 rounded-lg border border-line px-3 text-base font-normal" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-bold">הערה אישית
            <textarea value={note} maxLength={2000} rows={2} onChange={(e) => setNote(e.target.value)}
              onBlur={() => note.trim() !== (x.note ?? '') && save({ note }, 'ההערה נשמרה')}
              placeholder="למשל: להזמין מקום מראש" className="rounded-lg border border-line px-3 py-2 text-base font-normal" />
          </label>
          <ReviewEditor tripId={p.tripId} savedPlaceId={x.id} />
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-sm font-bold">קטגוריה
              <select value={x.categoryKey ?? ''} disabled={p.busy} onChange={(e) => p.onCategory(x, e.target.value as CategoryKey)}
                className="h-10 rounded-lg border border-line bg-white px-2 text-base font-normal">
                {!x.categoryKey && <option value="">בלי</option>}
                {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
              </select>
            </label>
            {p.days.length > 0 && (
              <label className="flex flex-col gap-1 text-sm font-bold">הוספה ליום
                <select value="" disabled={p.busy} onChange={(e) => e.target.value && p.addToDay(x.id, e.target.value)}
                  className="h-10 rounded-lg border border-line bg-white px-2 text-base font-normal">
                  <option value="">בחרו…</option>
                  {p.days.map((d) => <option key={d.id} value={d.id}>יום {d.dayIndex}</option>)}
                </select>
              </label>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-line px-3 text-sm font-bold">
              <input type="checkbox" checked={x.isMust} disabled={p.busy} onChange={(e) => save({ isMust: e.target.checked }, e.target.checked ? 'סומן כמקום חובה' : 'הסימון בוטל')}
                className="h-4 w-4 accent-[#9A6412]" /> מקום חובה
            </label>
            <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-line px-3 text-sm font-bold">
              <input type="checkbox" checked={x.status === 'visited'} disabled={p.busy} onChange={toggleVisited} className="h-4 w-4 accent-[#3F7F4A]" /> ביקרתי
            </label>
            <button type="button" onClick={() => p.onShowOnMap(x.googlePlaceId)} className="min-h-10 rounded-lg border border-line px-3 text-sm font-bold hover:bg-sand">הצגה במפה</button>
          </div>
          {!confirm ? (
            <button type="button" onClick={() => setConfirm(true)} className="w-fit text-sm font-bold text-[#B42318]">הסרה מהטיול</button>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-[#FEF3F2] p-2">
              <span className="flex-1 text-sm font-semibold">להסיר? הוא יוסר גם מכל הימים.</span>
              <button type="button" disabled={p.busy} onClick={() => p.onRemove(x)} className="min-h-10 rounded-lg bg-[#B42318] px-3 text-sm font-bold text-white">כן</button>
              <button type="button" onClick={() => setConfirm(false)} className="min-h-10 px-2 text-sm font-bold">ביטול</button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

