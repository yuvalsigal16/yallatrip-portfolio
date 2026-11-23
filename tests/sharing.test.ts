import { test } from 'node:test';
import assert from 'node:assert/strict';
import { googleDirectionsUrl, googlePlaceUrl, isShareToken, isVisibility } from '../src/lib/sharing/rules';

test('a day opens as Google Maps directions with waypoints', () => {
  const url = new URL(googleDirectionsUrl([{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }, { lat: 5, lng: 6 }], 'walk')!);
  assert.equal(url.searchParams.get('origin'), '1,2');
  assert.equal(url.searchParams.get('destination'), '5,6');
  assert.equal(url.searchParams.get('waypoints'), '3,4');
  assert.equal(url.searchParams.get('travelmode'), 'walking');
  assert.equal(googleDirectionsUrl([{ lat: 1, lng: 2 }]), null);
});
test('a place link carries its Google id', () => {
  const url = new URL(googlePlaceUrl({ lat: 1, lng: 2, google_place_id: 'ChIJabc', label: 'הפנתיאון' }));
  assert.equal(url.searchParams.get('query_place_id'), 'ChIJabc');
  assert.equal(url.searchParams.get('query'), 'הפנתיאון');
});
test('share tokens and visibility values are validated', () => {
  assert.ok(isShareToken('a'.repeat(64)));
  assert.ok(!isShareToken('../../etc'));
  assert.ok(isVisibility('link'));
  assert.ok(!isVisibility('everyone'));
});
