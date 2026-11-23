// The traveller's own Google Drive, straight from the browser: sign-in for one hour at a time,
// folders, and uploads. Nothing passes through our server and no password or key is kept:
// the permission ("drive.file") covers only folders and files this site itself created.

const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const GIS = 'https://accounts.google.com/gsi/client';

type TokenResponse = { access_token?: string; expires_in?: number; error?: string };
type TokenClient = { requestAccessToken: (o?: { prompt?: string }) => void; callback: (r: TokenResponse) => void };
type Gis = { accounts: { oauth2: { initTokenClient: (o: { client_id: string; scope: string; callback: (r: TokenResponse) => void; error_callback?: (e: unknown) => void }) => TokenClient } } };

let gisLoading: Promise<void> | null = null;
let token: { value: string; until: number } | null = null;

function loadGis(): Promise<void> {
  if ((window as unknown as { google?: Gis }).google?.accounts?.oauth2) return Promise.resolve();
  gisLoading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GIS;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { gisLoading = null; reject(new Error('gis')); };
    document.head.appendChild(s);
  });
  return gisLoading;
}

/** The sign-in we already hold, while it is still good (a few minutes of margin). */
export const currentToken = () => (token && token.until > Date.now() + 120_000 ? token.value : null);
export const forgetToken = () => { token = null; };

/** Ask Google for access. Opens Google's own window, so it must be called from a tap. */
export async function signIn(clientId: string): Promise<string> {
  const have = currentToken();
  if (have) return have;
  await loadGis();
  const g = (window as unknown as { google: Gis }).google;
  return new Promise<string>((resolve, reject) => {
    const client = g.accounts.oauth2.initTokenClient({
      client_id: clientId, scope: SCOPE,
      callback: (r) => {
        if (!r.access_token) return reject(new Error(r.error ?? 'denied'));
        token = { value: r.access_token, until: Date.now() + (r.expires_in ?? 3600) * 1000 };
        resolve(r.access_token);
      },
      error_callback: () => reject(new Error('closed')),
    });
    client.requestAccessToken();
  });
}

export class DriveError extends Error {
  constructor(public status: number) { super(`drive ${status}`); }
}

async function api(tok: string, url: string, init: RequestInit): Promise<Response> {
  const res = await fetch(url, { ...init, headers: { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${tok}` } });
  if (res.status === 401) forgetToken();
  if (!res.ok) throw new DriveError(res.status);
  return res;
}

/** A new folder (inside `parentId`, or at the top of "My Drive"). Returns its id. */
export async function createFolder(tok: string, name: string, parentId?: string): Promise<string> {
  const res = await api(tok, 'https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', ...(parentId && { parents: [parentId] }) }),
  });
  return ((await res.json()) as { id: string }).id;
}

/** Is the folder still there (not deleted and not in the bin)? */
export async function folderExists(tok: string, id: string): Promise<boolean> {
  try {
    const res = await api(tok, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=id,trashed`, { method: 'GET' });
    return !((await res.json()) as { trashed?: boolean }).trashed;
  } catch (e) {
    if (e instanceof DriveError && e.status === 404) return false;
    throw e;
  }
}

/** One file into a folder, in its original quality (in two steps, so large photos pass too). */
export async function uploadFile(tok: string, folderId: string, name: string, blob: Blob): Promise<void> {
  const start = await api(tok, 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': blob.type || 'application/octet-stream' },
    body: JSON.stringify({ name, parents: [folderId] }),
  });
  const session = start.headers.get('Location');
  if (!session) throw new DriveError(0);
  await api(tok, session, { method: 'PUT', headers: { 'Content-Type': blob.type || 'application/octet-stream' }, body: blob });
}

// ---------- photos waiting on the phone until they are sent to Drive ----------
export type Waiting = { id: string; tripId: string; date: string; name: string; blob: Blob };

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('gotrip-drive', 1);
    open.onupgradeneeded = () => { open.result.createObjectStore('waiting', { keyPath: 'id' }).createIndex('trip', 'tripId'); };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
}
const done = (t: IDBTransaction) => new Promise<void>((resolve, reject) => { t.oncomplete = () => resolve(); t.onerror = () => reject(t.error); t.onabort = () => reject(t.error); });

export async function addWaiting(items: Waiting[]): Promise<void> {
  const d = await db();
  const t = d.transaction('waiting', 'readwrite');
  for (const it of items) t.objectStore('waiting').put(it);
  await done(t);
  d.close();
}

export async function listWaiting(tripId: string): Promise<Waiting[]> {
  const d = await db();
  const t = d.transaction('waiting', 'readonly');
  const req = t.objectStore('waiting').index('trip').getAll(tripId);
  const rows = await new Promise<Waiting[]>((resolve, reject) => { req.onsuccess = () => resolve(req.result as Waiting[]); req.onerror = () => reject(req.error); });
  d.close();
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

export async function removeWaiting(ids: string[]): Promise<void> {
  const d = await db();
  const t = d.transaction('waiting', 'readwrite');
  for (const id of ids) t.objectStore('waiting').delete(id);
  await done(t);
  d.close();
}

/** "wifi" / "other" where the phone tells us (Android Chrome); null where it does not (iPhone, computers). */
export function networkKind(): 'wifi' | 'other' | null {
  const c = (navigator as unknown as { connection?: { type?: string } }).connection;
  if (!c || typeof c.type !== 'string' || c.type === 'unknown') return null;
  return c.type === 'wifi' || c.type === 'ethernet' ? 'wifi' : 'other';
}
