// Checks the Google keys in .env.local against the real Google APIs.
// Run: npm run check:google   (needs Node 20+; prints no key values)
import { readFileSync, existsSync } from 'node:fs';

const env = {};
if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} else {
  console.log('✗ .env.local not found. Copy .env.example to .env.local and fill in the keys.');
  process.exit(1);
}

const server = env.GOOGLE_MAPS_SERVER_KEY;
const browser = env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
const mapId = env.NEXT_PUBLIC_GOOGLE_MAP_ID;
let ok = true;
const fail = (name, why) => { ok = false; console.log(`✗ ${name}: ${why}`); };
const pass = (name, extra = '') => console.log(`✓ ${name}${extra ? ` (${extra})` : ''}`);
const get = (url, init) => fetch(url, init).catch((e) => ({ ok: false, status: 0, json: async () => ({ error: { message: `no connection to Google (${e.cause?.code ?? e.message})` } }) }));
const reason = async (res) => { try { const j = await res.json(); return j.error?.message ?? JSON.stringify(j).slice(0, 200); } catch { return `HTTP ${res.status}`; } };

if (!server) fail('GOOGLE_MAPS_SERVER_KEY', 'missing in .env.local');
if (!browser) fail('NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY', 'missing in .env.local');
if (!mapId) console.log('! NEXT_PUBLIC_GOOGLE_MAP_ID is empty: DEMO_MAP_ID will be used (fine for testing).');

if (server) {
  // Places API (New): the same text search a user runs for "Eiffel Tower"
  const r1 = await get('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': server, 'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location' },
    body: JSON.stringify({ textQuery: 'Eiffel Tower', languageCode: 'he', maxResultCount: 1 }),
  });
  if (r1.ok) {
    const p = (await r1.json()).places?.[0];
    pass('Places API (New)', p ? `${p.displayName?.text} · ${p.formattedAddress} · ${p.location?.latitude},${p.location?.longitude} · ${p.id}` : 'no result');
  } else fail('Places API (New)', await reason(r1));

  // Routes API: a short walking route in Paris
  const r2 = await get('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': server, 'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters' },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: 48.8584, longitude: 2.2945 } } },
      destination: { location: { latLng: { latitude: 48.8606, longitude: 2.3376 } } },
      travelMode: 'WALK',
    }),
  });
  if (r2.ok) { const rt = (await r2.json()).routes?.[0]; pass('Routes API', rt ? `${rt.distanceMeters} m, ${rt.duration}` : 'no route'); }
  else fail('Routes API', await reason(r2));
}

if (browser) {
  // Maps JavaScript API: Google only reports a bad browser key inside the browser,
  // so this checks that the key is accepted by a lightweight request with a localhost referrer.
  const r3 = await get(`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(browser)}&v=weekly`, { headers: { Referer: 'http://localhost:3000/' } });
  if (r3.ok) pass('Maps JavaScript API script', 'downloaded. The final check is the map itself at http://localhost:3000');
  else fail('Maps JavaScript API script', r3.status ? `HTTP ${r3.status}` : 'no connection to Google');
  if (server && browser === server) console.log('! The browser key and the server key are the same key. Use two keys (see docs/google-maps-setup.md).');
}

console.log(ok ? '\nGoogle is set up. Run: npm run dev' : '\nFix the ✗ lines (docs/google-maps-setup.md) and run this again.');
process.exit(ok ? 0 : 1);
