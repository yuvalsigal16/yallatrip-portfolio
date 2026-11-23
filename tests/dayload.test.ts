import { test } from 'node:test';
import assert from 'node:assert/strict';
import { closedOn, dayLoad, weekdayOf } from '../src/lib/planning/rules';

const stops = (n: number, stayMin: number) => Array.from({ length: n }, () => ({ stayMin, isMust: false }));

test('a normal day is fine', () => {
    assert.equal(dayLoad('09:00', null, stops(4, 60), [900, 900, 900]).overloaded, false);
  });
test('a day ending late is too full and suggests non-must stops, longest first', () => {
    const r = dayLoad('09:00', 600, [
      { stayMin: 180, isMust: true }, { stayMin: 120, isMust: false }, { stayMin: 90, isMust: false },
      { stayMin: 60, isMust: false }, { stayMin: 150, isMust: false }, { stayMin: 60, isMust: false },
    ], [1800, 1800, 2400, 1200, 1800]);
    assert.equal(r.overloaded, true);
    assert.equal(r.endsAt, '22:40');
    assert.deepEqual(r.suggest, [1, 4]);
  });
test('one stop is never "too full"', () => {
    assert.equal(dayLoad('09:00', null, [{ stayMin: 900, isMust: false }], []).overloaded, false);
  });
test('uses Google weekdays (0 = Sunday)', () => {
    assert.equal(weekdayOf('2026-10-04'), 0);
    assert.equal(closedOn([1, 2, 3, 4, 5], '2026-10-04'), true);
    assert.equal(closedOn([1, 2, 3, 4, 5], '2026-10-05'), false);
  });
test('unknown hours or no date never warn', () => {
    assert.equal(closedOn(null, '2026-10-04'), false);
    assert.equal(closedOn([1], null), false);
  });
