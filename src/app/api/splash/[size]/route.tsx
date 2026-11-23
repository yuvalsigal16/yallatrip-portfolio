import { ImageResponse } from 'next/og';
import { SPLASH_SIZES } from '@/lib/splash';
import { heeboFont, logoDataUri } from '@/lib/brand';

// iPhone start-up picture for the home-screen app (shown before the first page loads): brand blue with
// the YallaTrip logo and name (Heebo 900), the same colour as the walking screen that follows, so there is no white flash.
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const known = SPLASH_SIZES.find((s) => `${s.w * s.dpr}x${s.h * s.dpr}` === size) ?? SPLASH_SIZES[0];
  const w = known.w * known.dpr;
  const h = known.h * known.dpr;
  const icon = Math.round(w * 0.26);
  const font = await heeboFont(900, 'YallaTrip');
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#1B73C9', color: '#fff', fontFamily: 'Heebo' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoDataUri({ square: true })} width={icon} height={icon} alt="" style={{ borderRadius: Math.round(icon * 0.23), boxShadow: '0 20px 50px rgba(5,26,51,.35)' }} />
        <div style={{ marginTop: Math.round(w * 0.05), fontSize: Math.round(w * 0.1), fontWeight: 900 }}>YallaTrip</div>
      </div>
    ),
    {
      width: w, height: h, headers: { 'cache-control': 'public, max-age=604800, immutable' },
      fonts: font ? [{ name: 'Heebo', data: font, weight: 900, style: 'normal' }] : [],
    },
  );
}
