import { ImageResponse } from 'next/og';
import { logoDataUri, logoSvg } from '@/lib/brand';

// The app icon at the size asked for (see src/lib/brand.ts):
// - "svg" and 32: the simple logo, for the browser tab.
// - 180: the iPhone home-screen icon, a full square (the iPhone rounds the corners itself).
// - 192, 512: the home-screen icon with its own rounded corners.
// - "maskable": 512, a full square with the drawing in the middle 80%, so an Android mask never cuts it.
const PNG = new Set(['32', '180', '192', '512', 'maskable']);
const CACHE = { 'cache-control': 'public, max-age=604800, immutable' };

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  if (size === 'svg') return new Response(logoSvg({ small: true }), { headers: { 'content-type': 'image/svg+xml', ...CACHE } });
  const key = PNG.has(size) ? size : '192';
  const s = key === 'maskable' ? 512 : Number(key);
  const src = logoDataUri(key === '32' ? { small: true } : key === '180' ? { square: true } : key === 'maskable' ? { safe: true } : {});
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={s} height={s} alt="" />
      </div>
    ),
    { width: s, height: s, headers: CACHE },
  );
}
