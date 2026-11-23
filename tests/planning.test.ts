// Unit tests for planning logic. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clusterIntoDays, dayTimeline, decodePolyline, filterSaved, formatLegHe, normalizeHe, optimizeOrder, primaryMode,
  routeLength, scheduleDay, timesOutOfOrder, toMinutes, walkingSecondsEstimate,
} from '../src/lib/planning/rules';

const item = (label: string, categoryKey: string | null, status = 'saved', isMust = false, note: string | null = null) =>
  ({ label, categoryKey, status, isMust, note });

test('Hebrew search ignores final letters, niqqud and punctuation', () => {
  assert.equal(normalizeHe('שָׁלוֹם!'), 'שלומ');
  const items = [item('מסעדת רוסקיולי', 'restaurant'), item('הפנתיאון', 'attraction', 'planned', true, 'להגיע מוקדם')];
  assert.equal(filterSaved(items, { category: 'all', status: 'all', q: 'רוסקיולי' }).length, 1);
  assert.equal(filterSaved(items, { category: 'all', status: 'all', q: 'מוקדם' })[0]!.label, 'הפנתיאון', 'searches notes too');
  assert.equal(filterSaved(items, { category: 'must', status: 'all', q: '' }).length, 1, '"must" matches the must flag');
  assert.equal(filterSaved(items, { category: 'all', status: 'planned', q: '' }).length, 1);
  assert.equal(filterSaved(items, { category: 'restaurant', status: 'visited', q: '' }).length, 0);
});

// A zig-zag across Rome that should be untangled.
const P = (id: string, lat: number, lng: number) => ({ id, lat, lng });
const zigzag = [P('a', 41.900, 12.470), P('b', 41.890, 12.495), P('c', 41.901, 12.472), P('d', 41.889, 12.493), P('e', 41.902, 12.474)];

test('optimizing a day shortens a zig-zag route and keeps every stop', () => {
  const before = routeLength(zigzag);
  const after = optimizeOrder(zigzag);
  assert.equal(after.length, zigzag.length);
  assert.deepEqual([...after].map((p) => p.id).sort(), ['a', 'b', 'c', 'd', 'e']);
  assert.ok(routeLength(after) < before * 0.6, `expected a much shorter route: ${before} -> ${routeLength(after)}`);
});
test('with a hotel, the day starts from the stop closest to it', () => {
  const hotel = { lat: 41.8895, lng: 12.4945 };
  const after = optimizeOrder(zigzag, hotel);
  assert.ok(['b', 'd'].includes(after[0]!.id));
});
test('tiny days are left alone', () => {
  assert.deepEqual(optimizeOrder([zigzag[0]!]), [zigzag[0]]);
  assert.deepEqual(optimizeOrder([]), []);
});

test('automatic times: start, durations, travel, rounded to 5 minutes', () => {
  const times = scheduleDay(
    [{ categoryKey: 'cafe', durationMin: null }, { categoryKey: 'attraction', durationMin: null }, { categoryKey: 'restaurant', durationMin: 60 }],
    [120, 600],
    '09:00',
  );
  // 09:00 cafe (40) + 2 min -> 09:42 -> 09:45 ; attraction 90 + 10 -> 11:25
  assert.deepEqual(times, ['09:00', '09:45', '11:25']);
});
test('times out of order are detected', () => {
  assert.ok(timesOutOfOrder(['10:00', '09:00']));
  assert.ok(!timesOutOfOrder(['09:00', null, '10:00']));
  assert.equal(toMinutes('25:00'), null);
});
test('walking estimate is realistic', () => {
  const s = walkingSecondsEstimate({ lat: 41.8986, lng: 12.4769 }, { lat: 41.8902, lng: 12.4922 });
  assert.ok(s > 20 * 60 && s < 35 * 60, `Pantheon -> Colosseum ~ 28 min, got ${s / 60}`);
});

test('splitting into days: balanced, geographic, deterministic', () => {
  const west = [P('w1', 41.90, 12.45), P('w2', 41.901, 12.451), P('w3', 41.902, 12.452)];
  const east = [P('e1', 41.89, 12.50), P('e2', 41.891, 12.501), P('e3', 41.892, 12.502)];
  const days = clusterIntoDays([...east, ...west], 2);
  assert.equal(days.length, 2);
  assert.deepEqual(days.map((d) => d.map((p) => p.id).sort()), [['w1', 'w2', 'w3'], ['e1', 'e2', 'e3']]);
  assert.deepEqual(clusterIntoDays([...west, ...east], 2), days, 'same answer regardless of input order');
  const three = clusterIntoDays([...west, ...east], 4);
  assert.equal(three.length, 4);
  assert.ok(three.every((d) => d.length <= 2), 'no day is overloaded');
  assert.equal(clusterIntoDays([], 3).length, 3);
});

test('Google polylines decode', () => {
  // Google's documented example
  const pts = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
  assert.deepEqual(pts, [{ lat: 38.5, lng: -120.2 }, { lat: 40.7, lng: -120.95 }, { lat: 43.252, lng: -126.453 }]);
});

test('leg labels and travel mode', () => {
  assert.equal(formatLegHe(720, 950, 'walk'), '12 דק׳ הליכה · 950 מ׳');
  assert.equal(formatLegHe(4000, 25000, 'drive'), '1 ש׳ 7 דק׳ נסיעה · 25.0 ק״מ');
  assert.equal(formatLegHe(null, null, 'walk'), 'אין מידע על זמן ההגעה');
  assert.equal(primaryMode(['transit', 'walk']), 'walk');
  assert.equal(primaryMode(['car']), 'drive');
  assert.equal(primaryMode(['walk', 'transit', 'car', 'taxi']), 'drive');
});

// ---------- AI planner guard rails (Phase 10) ----------
import { algorithmPlan, buildPrompt, validateAiPlan } from '../src/lib/planning/ai';
import { mapComputeRoutes } from '../src/lib/google/mappers';
import { parseDayRoute } from '../src/lib/validation';

const places = [
  { id: 'p1', name: 'פנתיאון', category: 'attraction', lat: 41.8986, lng: 12.4769 },
  { id: 'p2', name: 'נבונה', category: 'attraction', lat: 41.8992, lng: 12.4731 },
  { id: 'p3', name: 'קולוסיאום', category: 'must', lat: 41.8902, lng: 12.4922 },
  { id: 'p4', name: 'פורום', category: 'attraction', lat: 41.8925, lng: 12.4853 },
];
const days = [{ index: 1, date: '2026-10-10', existing: [] }, { index: 2, date: '2026-10-11', existing: ['וטיקן'] }];

test('a valid AI answer is accepted as-is', () => {
  const r = validateAiPlan('```json\n{"days":[{"dayIndex":1,"placeIds":["p1","p2"]},{"dayIndex":2,"placeIds":["p3","p4"]}],"note":"מרכז ביום 1"}\n```', places, days);
  assert.ok(r);
  assert.equal(r!.source, 'ai');
  assert.deepEqual(r!.assignments, [{ dayIndex: 1, placeIds: ['p1', 'p2'] }, { dayIndex: 2, placeIds: ['p3', 'p4'] }]);
  assert.equal(r!.note, 'מרכז ביום 1');
});
test('invented places, unknown days and duplicates are dropped; forgotten places are still placed', () => {
  const r = validateAiPlan('{"days":[{"dayIndex":1,"placeIds":["p1","p1","FAKE"]},{"dayIndex":9,"placeIds":["p2"]}]}', places, days)!;
  const all = r.assignments.flatMap((a) => a.placeIds).sort();
  assert.deepEqual(all, ['p1', 'p2', 'p3', 'p4'], 'every real place exactly once, nothing invented');
  assert.ok(r.assignments.every((a) => a.dayIndex === 1 || a.dayIndex === 2));
});
test('garbage from the model falls back (null)', () => {
  assert.equal(validateAiPlan('sorry, I cannot help', places, days), null);
  assert.equal(validateAiPlan('{"days":"nope"}', places, days), null);
  assert.equal(validateAiPlan('{"days":[{"dayIndex":1,"placeIds":["FAKE"]}]}', places, days), null);
});
test('the algorithm splits by area and gives the emptier day more', () => {
  const r = algorithmPlan(places, days);
  assert.equal(r.source, 'algorithm');
  assert.deepEqual(r.assignments.flatMap((a) => a.placeIds).sort(), ['p1', 'p2', 'p3', 'p4']);
  const day1 = r.assignments.find((a) => a.dayIndex === 1)!.placeIds.sort();
  assert.ok(JSON.stringify(day1) === '["p1","p2"]' || JSON.stringify(day1) === '["p3","p4"]', 'each day is one area');
});
test('the prompt lists only the given places', () => {
  const p = buildPrompt(places, days, ['food'], 'רומא');
  assert.match(p, /p1 \| פנתיאון/);
  assert.match(p, /do not invent places/);
});

// ---------- day route ----------
test('computeRoutes response becomes legs, each with its own line', () => {
  const r = mapComputeRoutes({ routes: [{ legs: [{ duration: '300s', distanceMeters: 400, polyline: { encodedPolyline: 'abc' } }, { duration: '120s' }] }] });
  assert.deepEqual(r, { legs: [{ durationSec: 300, distanceMeters: 400, polyline: 'abc' }, { durationSec: 120, distanceMeters: null, polyline: null }], polyline: null });
  assert.equal(mapComputeRoutes({ routes: [] }), null);
});
test('day route input limits', () => {
  const pt = { lat: 41.9, lng: 12.5 };
  assert.ok(parseDayRoute({ points: [pt, pt], mode: 'walk' }).ok);
  assert.ok(!parseDayRoute({ points: [pt], mode: 'walk' }).ok);
  assert.ok(!parseDayRoute({ points: Array(28).fill(pt), mode: 'walk' }).ok);
  assert.ok(!parseDayRoute({ points: Array(14).fill(pt), mode: 'transit' }).ok);
});

test('dayTimeline: start + real leg time + stay, exact to the minute', () => {
  const t = dayTimeline('11:00', 34 * 60, [{ categoryKey: 'cafe', durationMin: 30 }, { categoryKey: null, durationMin: 60 }], [20 * 60]);
  assert.deepEqual(t.map((x) => [x.arrive, x.leave]), [['11:34', '12:04'], ['12:24', '13:24']]);
});
