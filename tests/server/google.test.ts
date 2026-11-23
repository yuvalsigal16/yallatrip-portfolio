// The Google Places flow, against a stand-in for Google's servers (no network, no key needed).
// Checks the exact requests YallaTrip sends and what it keeps from the answers.
// Run with the react-server condition so 'server-only' imports resolve: npm test
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { autocomplete, placeDetails } from '../../src/lib/google/places';
import { googleErrorMessage } from '../../src/lib/google/client';

type Call = { url: string; init: RequestInit & { headers: Record<string, string> } };
let calls: Call[] = [];
let reply: (url: string) => Response;

beforeEach(() => {
  calls = [];
  process.env.GOOGLE_MAPS_SERVER_KEY = 'test-server-key';
  globalThis.fetch = (async (url: string, init: Call['init']) => { calls.push({ url: String(url), init }); return reply(String(url)); }) as typeof fetch;
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

test('search "Eiffel Tower": Places API (New) autocomplete request and results', async () => {
  reply = () => json({ suggestions: [{ placePrediction: { placeId: 'ChIJLU7jZClu5kcR4PcOOO6p3I0', text: { text: 'Eiffel Tower, Paris, France' },
    structuredFormat: { mainText: { text: 'מגדל אייפל' }, secondaryText: { text: 'פריז, צרפת' } }, types: ['tourist_attraction'] } }] });
  const out = await autocomplete({ input: 'Eiffel Tower', sessionToken: '11111111-2222-4333-8444-555555555555', bias: { lat: 48.85, lng: 2.35 } });
  const c = calls[0]!;
  assert.equal(c.url, 'https://places.googleapis.com/v1/places:autocomplete');
  assert.equal(c.init.method, 'POST');
  assert.equal(c.init.headers['X-Goog-Api-Key'], 'test-server-key', 'server key goes in a header, never in the URL');
  assert.ok(!c.url.includes('test-server-key'));
  assert.ok(c.init.headers['X-Goog-FieldMask'], 'field mask is always sent (billing)');
  const body = JSON.parse(String(c.init.body));
  assert.equal(body.input, 'Eiffel Tower');
  assert.equal(body.languageCode, 'he');
  assert.deepEqual(body.locationBias.circle.center, { latitude: 48.85, longitude: 2.35 });
  assert.deepEqual(out, [{ placeId: 'ChIJLU7jZClu5kcR4PcOOO6p3I0', mainText: 'מגדל אייפל', secondaryText: 'פריז, צרפת', types: ['tourist_attraction'] }]);
});

test('choosing a result: details give name, address, latitude, longitude and Place ID', async () => {
  reply = () => json({ id: 'ChIJLU7jZClu5kcR4PcOOO6p3I0', displayName: { text: 'מגדל אייפל' }, formattedAddress: 'Av. Gustave Eiffel, 75007 Paris, צרפת',
    location: { latitude: 48.8583701, longitude: 2.2944813 }, primaryType: 'tourist_attraction' });
  const p = await placeDetails({ placeId: 'ChIJLU7jZClu5kcR4PcOOO6p3I0', level: 'basic', sessionToken: '11111111-2222-4333-8444-555555555555' });
  const c = calls[0]!;
  assert.ok(c.url.startsWith('https://places.googleapis.com/v1/places/ChIJLU7jZClu5kcR4PcOOO6p3I0?'));
  assert.ok(c.url.includes('sessionToken=11111111-2222-4333-8444-555555555555'), 'closes the autocomplete session (billed as one)');
  assert.equal(c.init.headers['X-Goog-FieldMask'], 'id,displayName,formattedAddress,location,primaryType');
  assert.equal(p?.googlePlaceId, 'ChIJLU7jZClu5kcR4PcOOO6p3I0');
  assert.equal(p?.name, 'מגדל אייפל');
  assert.equal(p?.address, 'Av. Gustave Eiffel, 75007 Paris, צרפת');
  assert.deepEqual(p?.location, { lat: 48.8583701, lng: 2.2944813 });
});

test('missing fields stay empty instead of being invented', async () => {
  reply = () => json({ id: 'ChIJx', displayName: { text: 'מקום' } });
  const p = await placeDetails({ placeId: 'ChIJx', level: 'basic' });
  assert.equal(p?.address, null);
  assert.equal(p?.location, null);
});

test('Places API not enabled or not allowed on the key: a clear setup message', async () => {
  reply = () => json({ error: { code: 403, message: 'Places API (New) has not been used in project 123 before or it is disabled.', status: 'PERMISSION_DENIED' } }, 403);
  const err = await autocomplete({ input: 'Eiffel Tower', sessionToken: '11111111-2222-4333-8444-555555555555' }).then(() => null, (e) => e);
  const m = googleErrorMessage(err);
  assert.equal(m?.status, 503);
  assert.match(m!.message, /Places API \(New\)/);
  assert.match(m!.message, /Google Cloud/);
});

test('wrong key and missing key are named', async () => {
  reply = () => json({ error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT' } }, 400);
  const bad = await placeDetails({ placeId: 'ChIJx', level: 'basic' }).then(() => null, (e) => e);
  assert.match(googleErrorMessage(bad)!.message, /GOOGLE_MAPS_SERVER_KEY/);

  delete process.env.GOOGLE_MAPS_SERVER_KEY;
  const missing = await placeDetails({ placeId: 'ChIJx', level: 'basic' }).then(() => null, (e) => e);
  assert.match(googleErrorMessage(missing)!.message, /עוד לא הוגדר/);
  assert.equal(calls.length, 1, 'no request leaves without a key');
});

test('Routes API errors name Routes API', async () => {
  const { GoogleApiError } = await import('../../src/lib/google/client');
  const m = googleErrorMessage(new GoogleApiError(403, 'Google returned 403', 'Routes API'));
  assert.match(m!.message, /Routes API/);
  assert.equal(googleErrorMessage(new Error('something else')), null);
});
