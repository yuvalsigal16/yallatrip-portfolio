'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getTripStory, type TripStory } from '@/app/trips/story-actions';

const W = 1080;
const H = 1920;
const BLUE = '#1B73C9';
const DEEP = '#0B3D6E';

type State = { kind: 'idle' } | { kind: 'making' } | { kind: 'ready'; url: string; file: File } | { kind: 'error'; text: string };

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Long titles: as many words as fit on a line, at most two lines. */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > max && line) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  if (lines.length > 2) return [lines[0]!, `${lines.slice(1).join(' ').slice(0, 24)}…`];
  return lines;
}

/** The story picture (1080x1920), drawn on the phone: no map service, nothing sent anywhere. */
export async function drawTripStory(s: TripStory): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const font = getComputedStyle(document.body).fontFamily || 'sans-serif';
  await document.fonts?.ready;
  ctx.direction = 'rtl';

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, DEEP);
  bg.addColorStop(1, BLUE);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // The cover photo, or a soft blue block when the trip has none (or the photo can't be read).
  const img = s.cover ? await loadImage(s.cover) : null;
  ctx.save();
  roundRect(ctx, 70, 90, W - 140, 760, 56);
  ctx.clip();
  if (img) {
    const scale = Math.max((W - 140) / img.width, 760 / img.height);
    const w = img.width * scale, h = img.height * scale;
    ctx.drawImage(img, 70 + (W - 140 - w) / 2, 90 + (760 - h) / 2, w, h);
  } else {
    const g = ctx.createLinearGradient(70, 90, W - 70, 850);
    g.addColorStop(0, '#35A7E0');
    g.addColorStop(1, '#1B73C9');
    ctx.fillStyle = g;
    ctx.fillRect(70, 90, W - 140, 760);
  }
  const shade = ctx.createLinearGradient(0, 450, 0, 850);
  shade.addColorStop(0, 'rgba(5,26,51,0)');
  shade.addColorStop(1, 'rgba(5,26,51,.75)');
  ctx.fillStyle = shade;
  ctx.fillRect(70, 450, W - 140, 400);
  ctx.restore();

  // The trip's name, over the bottom of the photo.
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'right';
  ctx.font = `900 84px ${font}`;
  const lines = wrap(ctx, s.title, W - 260);
  lines.forEach((l, i) => ctx.fillText(l, W - 130, 820 - (lines.length - 1 - i) * 96));

  // "הטיול במספרים": four tiles.
  ctx.font = `800 46px ${font}`;
  ctx.fillText('הטיול במספרים', W - 90, 960);
  const tiles: [number, string][] = [
    [s.days, s.days === 1 ? 'יום' : 'ימים'],
    [s.countries, s.countries === 1 ? 'מדינה' : 'מדינות'],
    [s.cities, s.cities === 1 ? 'עיר' : 'ערים'],
    [s.places, s.placesVisited ? 'מקומות שביקרנו' : 'מקומות בטיול'],
  ];
  const tw = (W - 180 - 3 * 24) / 4;
  tiles.forEach(([n, label], i) => {
    const x = W - 90 - (i + 1) * tw - i * 24;
    ctx.fillStyle = 'rgba(255,255,255,.14)';
    roundRect(ctx, x, 1000, tw, 220, 36);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = `900 88px ${font}`;
    ctx.fillText(String(n), x + tw / 2, 1110);
    ctx.font = `600 ${label.length > 8 ? 26 : 32}px ${font}`;
    ctx.fillText(label, x + tw / 2, 1175);
  });

  // A small map: the route as a line over a light card (drawn from the places' positions, no map tiles).
  const mx = 90, my = 1270, mw = W - 180, mh = 470;
  ctx.fillStyle = '#EAF4FC';
  roundRect(ctx, mx, my, mw, mh, 44);
  ctx.fill();
  const pts = s.path;
  if (pts.length >= 1) {
    const lats = pts.map((p) => p.lat), lngs = pts.map((p) => p.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const midLat = ((minLat + maxLat) / 2) * Math.PI / 180;
    const spanX = Math.max((maxLng - minLng) * Math.cos(midLat), 1e-4), spanY = Math.max(maxLat - minLat, 1e-4);
    const k = Math.min((mw - 140) / spanX, (mh - 140) / spanY);
    const cx = mx + mw / 2, cy = my + mh / 2;
    const at = (p: { lat: number; lng: number }) => ({
      x: cx + ((p.lng - (minLng + maxLng) / 2) * Math.cos(midLat)) * k,
      y: cy - (p.lat - (minLat + maxLat) / 2) * k,
    });
    const xy = pts.map(at);
    ctx.strokeStyle = BLUE;
    ctx.lineWidth = 10;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.setLineDash([]);
    ctx.beginPath();
    xy.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
    xy.forEach((p, i) => {
      const end = i === 0 || i === xy.length - 1;
      ctx.fillStyle = end ? '#F2A93B' : '#fff';
      ctx.strokeStyle = BLUE;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, end ? 20 : 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  } else {
    ctx.fillStyle = DEEP;
    ctx.textAlign = 'center';
    ctx.font = `700 40px ${font}`;
    ctx.fillText('עוד אין תחנות בימים', mx + mw / 2, my + mh / 2);
  }

  // YallaTrip, small at the bottom.
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,.92)';
  ctx.font = `900 44px ${font}`;
  ctx.direction = 'ltr';
  ctx.fillText('📍 YallaTrip', W / 2, H - 80);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('no image'))), 'image/png'));
}

/**
 * "📸 סיכום הטיול": a story-sized picture of the trip (name, cover, the trip in numbers, the route),
 * to share through the phone's own share sheet (WhatsApp, Instagram) or save to the gallery.
 */
export function TripStoryButton({ tripId, className, children }: { tripId: string; className: string; children: React.ReactNode }) {
  const [state, setState] = useState<State>({ kind: 'idle' });
  useEffect(() => () => { if (state.kind === 'ready') URL.revokeObjectURL(state.url); }, [state]);

  const make = async () => {
    setState({ kind: 'making' });
    const r = await getTripStory(tripId).catch(() => ({ ok: false as const, error: 'אין חיבור. נסו שוב בעוד רגע.' }));
    if (!r.ok) return setState({ kind: 'error', text: r.error });
    try {
      const blob = await drawTripStory(r.story);
      const file = new File([blob], 'yallatrip-trip.png', { type: 'image/png' });
      setState({ kind: 'ready', url: URL.createObjectURL(blob), file });
    } catch {
      setState({ kind: 'error', text: 'לא הצלחנו ליצור את התמונה. נסו שוב.' });
    }
  };
  const share = async (file: File) => {
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.canShare?.({ files: [file] })) {
      try { await nav.share({ files: [file], title: 'הטיול שלי ב-YallaTrip' }); } catch { /* closed the share sheet */ }
    } else save();
  };
  const save = () => {
    if (state.kind !== 'ready') return;
    const a = document.createElement('a');
    a.href = state.url;
    a.download = 'yallatrip-trip.png';
    a.click();
  };

  return (
    <>
      <button type="button" onClick={make} className={className}>{children}</button>
      {/* On <body>: the trip's header (blur, clipped photo) would trap and cut a window opened inside it. */}
      {state.kind !== 'idle' && createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="story-title"
          onClick={(e) => e.target === e.currentTarget && setState({ kind: 'idle' })}>
          <div className="flex max-h-[92dvh] w-full max-w-sm flex-col gap-3 overflow-y-auto rounded-t-3xl bg-white p-5 text-ink shadow-xl sm:rounded-3xl">
            <div className="flex items-center justify-between gap-3">
              <h2 id="story-title" className="text-xl font-extrabold">סיכום הטיול</h2>
              <button type="button" onClick={() => setState({ kind: 'idle' })} aria-label="סגירה" className="h-10 w-10 rounded-full text-lg font-bold hover:bg-sand">✕</button>
            </div>
            {state.kind === 'making' && <p className="py-10 text-center font-bold text-ink-2">מכינים את התמונה…</p>}
            {state.kind === 'error' && <p role="alert" className="py-6 text-center text-ink-2">{state.text}</p>}
            {state.kind === 'ready' && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={state.url} alt="סיכום הטיול: שם הטיול, הטיול במספרים ומפת המסלול" className="mx-auto max-h-[55dvh] w-auto rounded-2xl shadow-md" />
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => share(state.file)}
                    className="min-h-12 rounded-full bg-gradient-to-l from-[#1B73C9] to-[#2E9BDB] px-4 font-bold text-white">שיתוף</button>
                  <button type="button" onClick={save}
                    className="min-h-12 rounded-full border border-line bg-white px-4 font-bold text-ink">שמירה לגלריה</button>
                </div>
                <p className="text-center text-xs text-muted">בשיתוף בוחרים ווטסאפ, אינסטגרם או כל אפליקציה אחרת.</p>
              </>
            )}
          </div>
        </div>
      , document.body)}
    </>
  );
}
