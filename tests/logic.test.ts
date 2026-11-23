// Unit tests for the server's pure logic. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { distanceMeters, formatDistanceHe, isLatLng } from '../src/lib/geo';
import { NEARBY_TYPES } from '../src/lib/categories';
import { isCategoryKey } from '../src/lib/places/categories';
import { parseAround, parseAutocomplete, parseDetails, parseMatrix, parseNearby, isPhotoName } from '../src/lib/validation';
import { AROUND } from '../src/lib/google/fields';
import { AROUND_KINDS } from '../src/lib/places/around';
import { mapAutocomplete, mapMatrix, mapNearby, mapPlace, parseDuration } from '../src/lib/google/mappers';

const PANTHEON = { lat: 41.8986, lng: 12.4769 };
const COLOSSEUM = { lat: 41.8902, lng: 12.4922 };

// ---------- geo ----------
test('distance Pantheon -> Colosseum is about 1.6 km', () => {
  const d = distanceMeters(PANTHEON, COLOSSEUM);
  assert.ok(d > 1500 && d < 1700, `got ${d}`);
});
test('distance to itself is 0', () => assert.equal(distanceMeters(PANTHEON, PANTHEON), 0));
test('Hebrew distance labels', () => {
  assert.equal(formatDistanceHe(448), '450 מ׳');
  assert.equal(formatDistanceHe(1432), '1.4 ק״מ');
  assert.equal(formatDistanceHe(3), '10 מ׳');
});
test('coordinates are validated', () => {
  assert.ok(isLatLng(PANTHEON));
  assert.ok(!isLatLng({ lat: 91, lng: 0 }));
  assert.ok(!isLatLng({ lat: '41', lng: 12 }));
  assert.ok(!isLatLng(null));
});

// ---------- categories ----------
test('every "near you" category exists in the database seed', () => {
  const seed = readFileSync(new URL('../supabase/seed.sql', import.meta.url), 'utf8');
  // Other "near you" tabs (train, food, kids...) are searches, not categories.
  for (const key of Object.keys(NEARBY_TYPES).filter(isCategoryKey)) assert.match(seed, new RegExp(`'${key}'`), key);
});

// ---------- validation ----------
test('autocomplete: valid input passes, trimmed', () => {
  const r = parseAutocomplete({ input: '  רומא ', sessionToken: 'a1b2c3d4-e5f6' });
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.value.input, 'רומא');
});
test('autocomplete: empty, too long, missing token are refused', () => {
  assert.ok(!parseAutocomplete({ input: '', sessionToken: 'a1b2c3d4-e5f6' }).ok);
  assert.ok(!parseAutocomplete({ input: 'x'.repeat(121), sessionToken: 'a1b2c3d4-e5f6' }).ok);
  assert.ok(!parseAutocomplete({ input: 'רומא' }).ok);
  assert.ok(!parseAutocomplete('רומא').ok);
});
test('details: rejects place ids that could break the URL', () => {
  assert.ok(parseDetails('ChIJqUCGZ09gLxMRLbCNMGOqyZo', null, null).ok);
  assert.ok(!parseDetails('../../admin', null, null).ok);
  assert.ok(!parseDetails('ChIJqUCGZ09gLxMRLbCNMGOqyZo?key=1', null, null).ok);
  assert.ok(!parseDetails('ChIJqUCGZ09gLxMRLbCNMGOqyZo', 'everything', null).ok);
});
test('nearby: radius and category are checked', () => {
  assert.ok(parseNearby({ ...PANTHEON, category: 'restaurant' }).ok);
  assert.ok(!parseNearby({ ...PANTHEON, category: 'casino' }).ok);
  assert.ok(!parseNearby({ ...PANTHEON, category: 'cafe', radius: 50000 }).ok);
  assert.ok(!parseNearby({ lat: 200, lng: 0, category: 'cafe' }).ok);
});
test('matrix: size limits protect the budget', () => {
  const ten = Array.from({ length: 10 }, () => PANTHEON);
  assert.ok(parseMatrix({ origins: ten, destinations: ten, mode: 'walk' }).ok);
  assert.ok(!parseMatrix({ origins: [...ten, PANTHEON], destinations: [PANTHEON], mode: 'walk' }).ok);
  assert.ok(!parseMatrix({ origins: [], destinations: [PANTHEON], mode: 'walk' }).ok);
  assert.ok(!parseMatrix({ origins: [PANTHEON], destinations: [PANTHEON], mode: 'rocket' }).ok);
});
test('photo names must look like Google photo names', () => {
  assert.ok(isPhotoName('places/ChIJqUCGZ09gLxMRLbCNMGOqyZo/photos/AcJnMuF123456789abc'));
  assert.ok(!isPhotoName('https://evil.example/photo'));
  assert.ok(!isPhotoName('places/ChIJqUCGZ09gLxMRLbCNMGOqyZo/photos/../../x'));
});

// ---------- Google response mapping ----------
test('autocomplete response is mapped, broken rows skipped', () => {
  const out = mapAutocomplete({
    suggestions: [
      { placePrediction: { placeId: 'ChIJ1', text: { text: 'Pantheon, Rome' },
        structuredFormat: { mainText: { text: 'Pantheon' }, secondaryText: { text: 'Rome, Italy' } }, types: ['tourist_attraction'] } },
      { queryPrediction: { text: { text: 'pantheon hours' } } },
    ],
  });
  assert.deepEqual(out, [{ placeId: 'ChIJ1', mainText: 'Pantheon', secondaryText: 'Rome, Italy', types: ['tourist_attraction'] }]);
});

test('missing Google fields become null, never invented', () => {
  const p = mapPlace({ id: 'ChIJ1', displayName: { text: 'Pantheon' }, location: { latitude: 41.8986, longitude: 12.4769 } });
  assert.ok(p);
  assert.equal(p!.rating, null);
  assert.equal(p!.openNow, null);
  assert.equal(p!.weeklyHours, null);
  assert.equal(p!.address, null);
  assert.equal(p!.photo, null);
  assert.deepEqual(p!.location, PANTHEON);
});
test('a place without an id is dropped', () => assert.equal(mapPlace({ displayName: { text: 'x' } }), null));

test('full place card is mapped', () => {
  const p = mapPlace({
    id: 'ChIJ1', displayName: { text: 'הפנתיאון' }, formattedAddress: 'Piazza della Rotonda, Roma',
    rating: 4.8, userRatingCount: 250000, currentOpeningHours: { openNow: true },
    regularOpeningHours: { weekdayDescriptions: ['יום שני: 9:00–19:00'] },
    photos: [{ name: 'places/ChIJ1/photos/abc', authorAttributions: [{ displayName: 'Dana', uri: 'https://maps.google.com/x' }] }],
  })!;
  assert.equal(p.rating, 4.8);
  assert.equal(p.openNow, true);
  assert.deepEqual(p.weeklyHours, ['יום שני: 9:00–19:00']);
  assert.equal(p.photo?.attributions[0]?.displayName, 'Dana');
});

test('nearby results are sorted by real distance', () => {
  const out = mapNearby({
    places: [
      { id: 'far', location: { latitude: COLOSSEUM.lat, longitude: COLOSSEUM.lng } },
      { id: 'near', location: { latitude: 41.8990, longitude: 12.4770 } },
    ],
  }, PANTHEON);
  assert.deepEqual(out.map((p) => p.googlePlaceId), ['near', 'far']);
  assert.ok((out[0]!.distanceMeters ?? 0) < 100);
});

test('route matrix: durations parsed, missing routes marked', () => {
  assert.equal(parseDuration('754s'), 754);
  assert.equal(parseDuration('12.6s'), 13);
  assert.equal(parseDuration('soon'), null);
  const out = mapMatrix([
    { originIndex: 0, destinationIndex: 1, duration: '600s', distanceMeters: 800, condition: 'ROUTE_EXISTS' },
    { originIndex: 0, destinationIndex: 0, condition: 'ROUTE_NOT_FOUND' },
  ]);
  assert.deepEqual(out[0], { origin: 0, destination: 0, durationSec: null, distanceMeters: null, found: false });
  assert.deepEqual(out[1], { origin: 0, destination: 1, durationSec: 600, distanceMeters: 800, found: true });
});

// ---------- "✨ מה יש בסביבה" ----------
test('"around" asks Google only for basic fields (the cheaper Pro tier)', () => {
  const fields = AROUND.split(',');
  assert.deepEqual(fields, ['places.id', 'places.displayName', 'places.location', 'places.primaryType']);
  for (const f of fields) assert.ok(!/rating|OpeningHours|priceLevel|website|phone|reviews/i.test(f), f);
});
test('"around": a known kind and a real location only', () => {
  assert.ok(parseAround({ lat: 41.9, lng: 12.5, kind: 'eat' }).ok);
  assert.ok(!parseAround({ lat: 41.9, lng: 12.5, kind: 'kosher' }).ok);
  assert.ok(!parseAround({ lat: 91, lng: 12.5, kind: 'eat' }).ok);
  for (const k of Object.values(AROUND_KINDS)) assert.ok(k.radius >= 300 && k.radius <= 2000 && k.types.length > 0);
});
