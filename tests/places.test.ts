// Unit tests for place categories. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CATEGORIES, categoryMeta, guessCategory, isCategoryKey, pinSvg } from '../src/lib/places/categories';

test('browser categories match the database seed exactly (key, Hebrew name, color)', () => {
  const seed = readFileSync(new URL('../supabase/seed.sql', import.meta.url), 'utf8');
  const rows = [...seed.matchAll(/\('([a-z_]+)',\s*'([^']+)',\s*'[^']+',\s*'[^']+',\s*'(#[0-9A-Fa-f]{6})'/g)].map((m) => ({
    key: m[1], name: m[2], color: m[3]!.toUpperCase(),
  }));
  assert.equal(rows.length, 16);
  // The browser's order is the order on screen, so compare by key.
  const byKey = (a: { key?: string }, b: { key?: string }) => String(a.key).localeCompare(String(b.key));
  assert.deepEqual(
    CATEGORIES.map((c) => ({ key: c.key, name: c.name, color: c.color.toUpperCase() })).sort(byKey),
    rows.sort(byKey),
  );
});

test('Google types are mapped to sensible categories', () => {
  assert.equal(guessCategory('italian_restaurant'), 'restaurant');
  assert.equal(guessCategory('coffee_shop'), 'cafe');
  assert.equal(guessCategory('museum'), 'attraction');
  assert.equal(guessCategory('lodging'), 'hotel');
  assert.equal(guessCategory('night_club'), 'nightlife');
  assert.equal(guessCategory('shoe_store'), 'shopping');
  assert.equal(guessCategory('vegan_restaurant'), 'restaurant', 'unknown *_restaurant falls back to restaurant');
  assert.equal(guessCategory(null, ['point_of_interest', 'park']), 'park');
  assert.equal(guessCategory('something_new'), 'attraction');
});

test('category lookups are safe', () => {
  assert.ok(isCategoryKey('cafe'));
  assert.ok(!isCategoryKey('casino'));
  assert.equal(categoryMeta('nope').name, 'בלי קטגוריה');
  assert.equal(categoryMeta('photo').color, '#5E6B22');
});

test('pins carry the category color; the hotel pin is square', () => {
  assert.match(pinSvg(categoryMeta('restaurant')), /#C2481F/);
  assert.match(pinSvg(categoryMeta('attraction'), { hotel: true }), /<rect/);
  assert.match(pinSvg(categoryMeta('cafe'), { selected: true }), /width="44"/);
  assert.match(pinSvg(categoryMeta('cafe'), { number: 3 }), />3<\/text>/, 'day stops show their number');
});
