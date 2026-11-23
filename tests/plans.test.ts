// "תוכניות ומחירים": who sees which prices. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shownPrices, showsCreatorPrices } from '../src/lib/plans';

test('a regular user sees only the regular prices', () => {
  assert.equal(showsCreatorPrices('user'), false);
  assert.equal(showsCreatorPrices('user', 'creator'), false, 'the view switch is for the admin only');
  assert.equal(showsCreatorPrices(null, 'creator'), false, 'visitors who are not signed in too');
  assert.deepEqual(shownPrices(false), [39, 59, 199]);
});

test('approved creators see their lower prices', () => {
  assert.equal(showsCreatorPrices('creator'), true);
  assert.deepEqual(shownPrices(true), [29, 49, 99]);
});

test('the admin sees the version she picks, regular by default', () => {
  assert.equal(showsCreatorPrices('admin'), false);
  assert.equal(showsCreatorPrices('admin', 'user'), false);
  assert.equal(showsCreatorPrices('admin', 'creator'), true);
});
