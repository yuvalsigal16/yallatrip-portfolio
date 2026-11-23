// The service worker, served from the site root so it may look after every page.
// It keeps the app's own files and the trip pages someone opened (network first, so online they are always fresh),
// and shows them when there is no internet. It never touches sign-in, the API or other sites.

const SW = String.raw`
const PAGES = 'gotrip-pages-v1';
const STATIC = 'gotrip-static-v1';
const OFFLINE = '/offline';
const LAUNCH = '/launch';
const INDEX = '/__offline-index';
const PAGE_RE = /^\/trips(?:\/[0-9a-f-]{36}(?:\/(?:plan|checklist|budget|bookings|summary|today|overview|outline))?)?\/?$/;

self.addEventListener('install', (e) => {
  e.waitUntil(Promise.all([saveOfflinePage(), saveLaunch()]).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('gotrip-') && k !== PAGES && k !== STATIC) await caches.delete(k);
    await self.clients.claim();
  })());
});

// The "no connection" page lives with the app files, so clearing a user's trips on sign-out keeps it.
async function saveOfflinePage() {
  try {
    const cache = await caches.open(STATIC);
    if (await cache.match(OFFLINE)) return;
    const res = await fetch(OFFLINE, { credentials: 'same-origin' });
    if (!res.ok) return;
    const html = await res.clone().text();
    // its scripts and styles too, so the list of saved trips on it works without internet
    const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s)]+\.(?:js|css)/g) || [])];
    await Promise.all(assets.map((a) => cache.match(a).then((hit) => hit || cache.add(a)).catch(() => {})));
    await cache.put(OFFLINE, res);
  } catch {}
}

// The walking start screen of the home-screen app: shown from the phone at once, refreshed in the background.
async function saveLaunch() {
  try {
    const res = await fetch(LAUNCH, { credentials: 'same-origin' });
    if (res.ok) await (await caches.open(STATIC)).put(LAUNCH, res);
  } catch {}
}

async function launch(e) {
  const hit = await caches.match(LAUNCH, { ignoreSearch: true, ignoreVary: true });
  if (hit) { e.waitUntil(saveLaunch()); return hit; }
  try { return await fetch(e.request); } catch { return (await caches.match(OFFLINE, { ignoreVary: true })) || Response.error(); }
}

async function readIndex(cache) {
  try { const r = await cache.match(INDEX); return r ? await r.json() : {}; } catch { return {}; }
}

async function keep(url, title) {
  const cache = await caches.open(PAGES);
  try {
    const res = await fetch(url, { credentials: 'same-origin', redirect: 'manual' });
    if (!res.ok || res.type !== 'basic') return;
    await cache.put(url, res);
    if (title) {
      const index = await readIndex(cache);
      index[url] = { title, at: Date.now() };
      await cache.put(INDEX, new Response(JSON.stringify(index), { headers: { 'content-type': 'application/json' } }));
    }
  } catch {}
}

self.addEventListener('message', (e) => {
  const d = e.data || {};
  if (d.type === 'keep' && Array.isArray(d.urls)) {
    e.waitUntil(Promise.all([saveOfflinePage(), ...d.urls.filter((u) => typeof u === 'string' && PAGE_RE.test(u)).map((u) => keep(u, u.endsWith('/plan') ? d.title : null))]));
  } else if (d.type === 'clear') {
    e.waitUntil(caches.delete(PAGES));
  }
});

async function cacheFirst(req) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.type === 'basic') cache.put(req, res.clone()).catch(() => {});
  return res;
}

async function page(req, url) {
  const cache = await caches.open(PAGES);
  let res;
  try {
    res = await fetch(req);
  } catch {
    return (await cache.match(url.pathname + url.search, { ignoreVary: true }))
      || (await cache.match(url.pathname, { ignoreVary: true, ignoreSearch: true }))
      || (await caches.match(OFFLINE, { ignoreVary: true }))
      || Response.error();
  }
  if (res.ok && !res.redirected && res.type === 'basic') cache.put(url.pathname + url.search, res.clone()).catch(() => {});
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/api/icons/')) {
    e.respondWith(cacheFirst(req));
    return;
  }
  if (req.mode !== 'navigate') return;
  if (url.pathname === LAUNCH) {
    e.respondWith(launch(e));
    return;
  }
  if (PAGE_RE.test(url.pathname)) {
    e.respondWith(page(req, url));
    return;
  }
  e.respondWith(fetch(req).catch(async () => (await caches.match(OFFLINE, { ignoreVary: true })) || Response.error()));
});
`;

export function GET() {
  return new Response(SW, {
    headers: {
      'content-type': 'text/javascript; charset=utf-8',
      'cache-control': 'no-cache',
      'service-worker-allowed': '/',
    },
  });
}
