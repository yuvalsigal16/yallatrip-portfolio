// AI trip planner: the model may only ARRANGE places the user already saved.
// It never adds places or facts. Every answer is validated; anything invalid
// falls back to the geographic algorithm. Pure parts are unit-tested.

import { clusterIntoDays } from '@/lib/planning/rules';

export type PlanPlace = { id: string; name: string; category: string | null; lat: number; lng: number };
export type PlanDay = { index: number; date: string | null; existing: string[] };
export type Assignment = { dayIndex: number; placeIds: string[] };
export type PlanResult = { source: 'ai' | 'algorithm'; assignments: Assignment[]; note: string | null };

/** The algorithm's answer: one geographic cluster per day. */
export function algorithmPlan(places: PlanPlace[], days: PlanDay[]): PlanResult {
  const groups = clusterIntoDays(places, days.length);
  // emptier days get the bigger groups
  const dayOrder = [...days].sort((a, b) => a.existing.length - b.existing.length || a.index - b.index);
  const groupOrder = groups.map((g, i) => ({ g, i })).sort((a, b) => b.g.length - a.g.length || a.i - b.i);
  const assignments = groupOrder
    .map(({ g }, n) => ({ dayIndex: dayOrder[n]!.index, placeIds: g.map((p) => p.id) }))
    .filter((a) => a.placeIds.length > 0)
    .sort((a, b) => a.dayIndex - b.dayIndex);
  return { source: 'algorithm', assignments, note: null };
}

export function buildPrompt(places: PlanPlace[], days: PlanDay[], styles: string[], destination: string): string {
  return [
    `You are helping plan a trip to ${destination}. Travel styles: ${styles.join(', ') || 'not specified'}.`,
    'Assign EVERY place below to exactly one day, so each day stays in one area and is not overloaded.',
    'Rules: use only the given place ids; do not invent places; keep restaurants spread so each day has food if possible;',
    'days that already have stops should get fewer new places.',
    '',
    'DAYS (index, date, places already planned):',
    ...days.map((d) => `- ${d.index} | ${d.date ?? 'no date'} | ${d.existing.length ? d.existing.join('; ') : 'empty'}`),
    '',
    'PLACES TO ASSIGN (id | name | category | lat,lng):',
    ...places.map((p) => `- ${p.id} | ${p.name} | ${p.category ?? 'other'} | ${p.lat.toFixed(5)},${p.lng.toFixed(5)}`),
    '',
    'Answer with JSON only, no other text, in this exact shape:',
    '{"days":[{"dayIndex":1,"placeIds":["..."]}],"note":"one short sentence in Hebrew explaining the logic"}',
  ].join('\n');
}

/**
 * Checks the model's answer. Unknown ids, unknown days and duplicates are dropped;
 * places it forgot are placed by the algorithm. Returns null when nothing usable came back.
 */
export function validateAiPlan(raw: string, places: PlanPlace[], days: PlanDay[]): PlanResult | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  let data: unknown;
  try {
    data = JSON.parse(match[0]);
  } catch {
    return null;
  }
  const obj = data as { days?: unknown; note?: unknown };
  if (!Array.isArray(obj.days)) return null;

  const known = new Set(places.map((p) => p.id));
  const dayIdx = new Set(days.map((d) => d.index));
  const used = new Set<string>();
  const byDay = new Map<number, string[]>();

  for (const d of obj.days as { dayIndex?: unknown; placeIds?: unknown }[]) {
    if (typeof d?.dayIndex !== 'number' || !dayIdx.has(d.dayIndex) || !Array.isArray(d.placeIds)) continue;
    for (const id of d.placeIds) {
      if (typeof id !== 'string' || !known.has(id) || used.has(id)) continue;
      used.add(id);
      byDay.set(d.dayIndex, [...(byDay.get(d.dayIndex) ?? []), id]);
    }
  }
  if (used.size === 0) return null;

  // anything the model skipped: let the algorithm place it
  const missing = places.filter((p) => !used.has(p.id));
  if (missing.length) {
    for (const a of algorithmPlan(missing, days).assignments) {
      byDay.set(a.dayIndex, [...(byDay.get(a.dayIndex) ?? []), ...a.placeIds]);
    }
  }
  const note = typeof obj.note === 'string' ? obj.note.slice(0, 300) : null;
  return {
    source: 'ai',
    assignments: [...byDay.entries()].sort((a, b) => a[0] - b[0]).map(([dayIndex, placeIds]) => ({ dayIndex, placeIds })),
    note,
  };
}
