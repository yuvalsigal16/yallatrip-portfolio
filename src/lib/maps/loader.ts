// Loads the Google Maps JavaScript API once, in Hebrew, with the browser key.
// The browser key is public by design; restrict it to your domains in Google Cloud.

let loading: Promise<void> | null = null;
let authFailed = false;
const authListeners = new Set<() => void>();

declare global {
  interface Window {
    __gotripMapsReady?: () => void;
    gm_authFailure?: () => void;
  }
}

export function loadGoogleMaps(apiKey: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Google Maps loads only in the browser'));
  const g = (window as unknown as { google?: { maps?: { importLibrary?: unknown } } }).google;
  if (g?.maps?.importLibrary) return Promise.resolve();
  if (loading) return loading;

  // Google calls this when the key is wrong or not allowed on this domain.
  window.gm_authFailure = () => {
    authFailed = true;
    authListeners.forEach((fn) => fn());
  };

  loading = new Promise<void>((resolve, reject) => {
    window.__gotripMapsReady = () => resolve();
    const params = new URLSearchParams({
      key: apiKey, v: 'weekly', language: 'he', region: 'IL', loading: 'async', callback: '__gotripMapsReady',
    });
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.async = true;
    script.onerror = () => {
      loading = null;
      reject(new Error('Google Maps script failed to load'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** Subscribe to "the key was rejected". Returns an unsubscribe function. */
export function onMapsAuthFailure(fn: () => void): () => void {
  if (authFailed) fn();
  authListeners.add(fn);
  return () => authListeners.delete(fn);
}
