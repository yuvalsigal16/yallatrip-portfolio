import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foldDates, legSummaries, monthBlocks, nightsOf, tripOverview } from '../src/lib/trips/overview';

const day = (i: number, date: string, stopCount: number) => ({ id: `d${i}`, dayIndex: i, date, stopCount });

test('folds consecutive dates', () => {
  assert.deepEqual(foldDates(['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-17']).map((r) => [r.from, r.to, r.count]),
    [['2026-11-12', '2026-11-14', 3], ['2026-11-17', '2026-11-17', 1]]);
  assert.deepEqual(foldDates(['2026-12-31', '2027-01-01']).map((r) => r.count), [2]);
});

test('nights of a stay', () => {
  assert.deepEqual(nightsOf({ starts_on: '2026-11-10', ends_on: '2026-11-13' }), ['2026-11-10', '2026-11-11', '2026-11-12']);
  assert.deepEqual(nightsOf({ starts_on: '2026-11-10', ends_on: null }), ['2026-11-10']);
  assert.deepEqual(nightsOf({ starts_on: null, ends_on: null }), []);
});

test('overview: empty days and nights without a stay', () => {
  const days = [day(1, '2026-11-10', 2), day(2, '2026-11-11', 0), day(3, '2026-11-12', 0), day(4, '2026-11-13', 1), day(5, '2026-11-14', 0)];
  const o = tripOverview(days, [{ starts_on: '2026-11-10', ends_on: '2026-11-12' }]);
  assert.equal(o.plannedDays, 2);
  assert.deepEqual(o.emptyRanges.map((r) => [r.from, r.to, r.firstDayId]), [['2026-11-11', '2026-11-12', 'd2'], ['2026-11-14', '2026-11-14', 'd5']]);
  // nights: 10, 11, 12, 13 (the last day has no night); covered: 10, 11
  assert.deepEqual(o.uncoveredNights.map((r) => [r.from, r.to]), [['2026-11-12', '2026-11-13']]);
  assert.deepEqual(tripOverview(days, []).uncoveredNights, []);
});

test('per destination', () => {
  const days = [day(1, '2026-11-10', 2), day(2, '2026-11-11', 0), day(3, '2026-11-12', 1)];
  const [a, b] = legSummaries([{ name: 'A', start: '2026-11-10', end: '2026-11-11' }, { name: 'B', start: '2026-11-12', end: '2026-11-12' }], days, new Set(['2026-11-10']));
  assert.deepEqual([a!.days, a!.planned, a!.nights, a!.nightsCovered], [2, 1, 1, 1]);
  assert.deepEqual([b!.days, b!.planned, b!.nights], [1, 1, 0]);
});

test('month blocks start on the right weekday', () => {
  const b = monthBlocks([day(1, '2026-11-29', 0), day(2, '2026-11-30', 0), day(3, '2026-12-01', 0)]);
  assert.deepEqual(b.map((x) => [x.key, x.offset, x.days.length]), [['2026-11', 0, 2], ['2026-12', 2, 1]]);
});
