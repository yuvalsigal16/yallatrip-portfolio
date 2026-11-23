// Unit tests for trip rules. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays, daysRemovedByNewDates, firstStepWithError, formatDateRangeHe, formatDayHe, formatLengthHe,
  parseDate, parseTripForm, sortTrips, todayInIsrael, tripLengthDays, tripStatus, transportLabel,
} from '../src/lib/trips/rules';

// ---------- dates ----------
test('dates are parsed strictly', () => {
  assert.ok(parseDate('2026-10-10'));
  assert.equal(parseDate('2026-02-30'), null);
  assert.equal(parseDate('10/10/2026'), null);
  assert.equal(parseDate(null), null);
});
test('trip length is inclusive', () => {
  assert.equal(tripLengthDays('2026-10-10', '2026-10-15'), 6);
  assert.equal(tripLengthDays('2026-10-10', '2026-10-10'), 1);
  assert.equal(tripLengthDays('2026-10-10', '2027-04-10'), 183);
  assert.equal(addDays('2026-12-30', 3), '2027-01-02');
});
test('today is computed in Israel time', () => {
  // 22:30 UTC on 24 Sep is already 25 Sep in Israel (UTC+3)
  assert.equal(todayInIsrael(new Date('2026-09-24T22:30:00Z')), '2026-09-25');
});

// ---------- Hebrew labels ----------
test('date ranges in Hebrew', () => {
  assert.equal(formatDateRangeHe('2026-10-10', '2026-10-15'), '10–15 באוקטובר 2026');
  assert.equal(formatDateRangeHe('2026-09-28', '2026-10-03'), '28 בספטמבר – 3 באוקטובר 2026');
  assert.equal(formatDateRangeHe('2026-12-30', '2027-01-02'), '30 בדצמבר 2026 – 2 בינואר 2027');
  assert.equal(formatDateRangeHe('2026-10-10', '2026-10-10'), '10 באוקטובר 2026');
  assert.equal(formatDateRangeHe(null, null), null);
});
test('day labels in Hebrew', () => {
  assert.equal(formatDayHe('2026-10-10'), 'שבת, 10 באוקטובר');
  assert.equal(formatDayHe('2026-10-11'), 'ראשון, 11 באוקטובר');
});
test('trip length labels', () => {
  assert.equal(formatLengthHe(6), '6 ימים · 5 לילות');
  assert.equal(formatLengthHe(1), 'יום אחד');
  assert.equal(formatLengthHe(2), 'יומיים · לילה אחד');
  assert.equal(formatLengthHe(3), '3 ימים · שני לילות');
  assert.equal(transportLabel(['walk', 'transit']), 'הליכה + תחבורה ציבורית');
});

// ---------- status ----------
test('trip status chip', () => {
  const t = '2026-09-24';
  assert.deepEqual(tripStatus('2026-10-10', '2026-10-15', t), { kind: 'upcoming', label: 'בעוד 16 ימים', daysUntil: 16 });
  assert.equal(tripStatus('2026-09-25', '2026-09-30', t).label, 'מחר!');
  assert.equal(tripStatus('2026-09-24', '2026-09-30', t).label, 'עכשיו בטיול · יום 1');
  assert.equal(tripStatus('2026-09-20', '2026-09-30', t).label, 'עכשיו בטיול · יום 5');
  assert.equal(tripStatus('2026-09-01', '2026-09-10', t).kind, 'past');
  assert.equal(tripStatus(null, null, t).kind, 'draft');
});
test('trips are sorted: now, upcoming (soonest), drafts, past', () => {
  const trips = [
    { id: 'past', start_date: '2026-01-01', end_date: '2026-01-05', created_at: '2026-01-01' },
    { id: 'paris', start_date: '2026-12-18', end_date: '2026-12-22', created_at: '2026-09-01' },
    { id: 'draft', start_date: null, end_date: null, created_at: '2026-09-10' },
    { id: 'rome', start_date: '2026-10-10', end_date: '2026-10-15', created_at: '2026-08-01' },
    { id: 'now', start_date: '2026-09-20', end_date: '2026-09-30', created_at: '2026-07-01' },
  ];
  assert.deepEqual(sortTrips(trips, '2026-09-24').map((t) => t.id), ['now', 'rome', 'paris', 'draft', 'past']);
});

// ---------- form ----------
const good = {
  destinationName: 'רומא, איטליה', placeId: 'ChIJu46S-ZZhLxMROG5lkwZ3D7k', sessionToken: 'a1b2c3d4-e5f6',
  startDate: '2026-10-10', endDate: '2026-10-15', travelers: '2',
  transport: ['walk', 'transit'], styles: ['food', 'attractions', 'hacking'], budget: 'medium',
};
test('a full wizard form is accepted, unknown styles dropped, title defaults to destination', () => {
  const r = parseTripForm(good);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.value.title, 'רומא, איטליה');
  assert.deepEqual(r.value.styles, ['food', 'attractions']);
  assert.equal(r.value.travelers, 2);
  assert.equal(r.value.startDate, '2026-10-10');
});
test('"no dates yet" skips the dates', () => {
  const r = parseTripForm({ destinationName: 'ניו יורק', noDates: 'on', startDate: 'garbage' });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.startDate, null);
    assert.deepEqual(r.value.transport, ['walk', 'transit']); // sensible default
  }
});
test('form errors point to the right wizard step', () => {
  const r = parseTripForm({ ...good, destinationName: '', travelers: '0' });
  assert.ok(!r.ok);
  if (r.ok) return;
  assert.ok(r.fieldErrors.destinationName && r.fieldErrors.travelers);
  assert.equal(firstStepWithError(r.fieldErrors), 1);
  assert.equal(firstStepWithError({ travelers: 'x' }), 2);
});
test('bad dates are refused', () => {
  const back = parseTripForm({ ...good, startDate: '2026-10-15', endDate: '2026-10-10' });
  assert.ok(!back.ok && back.fieldErrors.endDate);
  const tooLong = parseTripForm({ ...good, startDate: '2026-01-01', endDate: '2027-06-01' });
  assert.ok(!tooLong.ok && tooLong.fieldErrors.endDate);
  const halfYear = parseTripForm({ ...good, startDate: '2026-10-10', endDate: '2027-04-10' });
  assert.ok(halfYear.ok, 'a half-year trip is fine');
});
test('a forged place id is ignored, not trusted', () => {
  const r = parseTripForm({ ...good, placeId: '../../evil' });
  assert.ok(r.ok && r.value.placeId === null);
});
test('shortening detection', () => {
  assert.equal(daysRemovedByNewDates('2026-10-10', '2026-10-15', '2026-10-10', '2026-10-12'), 3);
  assert.equal(daysRemovedByNewDates('2026-10-10', '2026-10-15', '2026-10-12', '2026-10-20'), 0);
  assert.equal(daysRemovedByNewDates(null, null, '2026-10-10', '2026-10-12'), 0);
});
