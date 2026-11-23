import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, parseRate, settleUp, parseChecklistText } from '../src/lib/trips/extras';

const E = (id: string, paid: string, amt: number, shared = true) => ({
  id, title: 'x', category: 'food', amount: amt, currency: 'ILS', rate: 1, home_amount: amt, paid_by: paid, shared, spent_on: '2026-10-01',
});

test('amounts and rates', () => {
  assert.equal(parseAmount('12,5'), 12.5);
  assert.equal(parseAmount('1,234.5'), 1234.5);
  assert.equal(parseAmount('₾ 12'), 12);
  assert.equal(parseAmount('0'), null);
  assert.equal(parseRate('1,35'), 1.35);
  assert.equal(parseRate('0'), null);
});

test('settle up splits shared expenses equally', () => {
  assert.deepEqual(settleUp([E('1', 'a', 90), E('2', 'b', 30)], ['a', 'b', 'c']),
    [{ from: 'c', to: 'a', amount: 40 }, { from: 'b', to: 'a', amount: 10 }]);
  assert.deepEqual(settleUp([E('1', 'a', 50, false)], ['a', 'b']), []);
  assert.deepEqual(settleUp([E('1', 'a', 50)], ['a']), []);
});

test('checklist text', () => {
  assert.equal(parseChecklistText('  דרכון   בתוקף '), 'דרכון בתוקף');
  assert.equal(parseChecklistText(''), null);
  assert.equal(parseChecklistText('x'.repeat(201)), null);
});
