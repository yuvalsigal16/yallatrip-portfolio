import { ImageResponse } from 'next/og';
import sharp from 'sharp';
import { logoDataUri } from '@/lib/brand';

// How a link to YallaTrip looks when shared (WhatsApp, Facebook, Telegram): 1200x630, a landscape photo under the
// site's deep blue, the logo, and the line from the home page. Made once when the site is built.
export const alt = 'YallaTrip: נועצים על המפה, מקבלים מסלול יומי מסודר';
export const size = { width: 1200, height: 630 };
// JPEG, well under WhatsApp's size limit (the PNG with the photo was almost 2MB, and WhatsApp showed no picture).
export const contentType = 'image/jpeg';

const PHOTO = 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&h=630&q=70'; // lake and forest, as on the home page

/** Heebo, the site's typeface (Hebrew glyphs), from Google Fonts as TTF. */
async function heebo(weight: number): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Heebo:wght@${weight}`)).text();
    const url = css.match(/url\((https:[^)]+\.ttf)\)/)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch {
    return null;
  }
}

async function photo(): Promise<string | null> {
  try {
    const res = await fetch(PHOTO);
    if (!res.ok) return null;
    return `data:image/jpeg;base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
  } catch {
    return null;
  }
}

/** The image library lays text out left to right: a Hebrew line is given in the order it is seen, one line each (never wrapped). */
const seen = (text: string) => [...text].reverse().join('');

export default async function OpengraphImage() {
  const [bold, bg] = await Promise.all([heebo(900), photo()]);
  const fonts = bold ? [{ name: 'Heebo', data: bold, weight: 900 as const, style: 'normal' as const }] : [];
  const png = new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: 'linear-gradient(135deg, #1B73C9, #0B3D6E)', fontFamily: 'Heebo' }}>
        {bg && <img src={bg} alt="" width={1200} height={630} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
        {/* Darkest behind the text (right side), as on the site's photo bands */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', background: 'linear-gradient(270deg, rgba(5,26,51,.92) 0%, rgba(11,61,110,.7) 55%, rgba(11,61,110,.25) 100%)' }} />
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 1000, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', padding: '0 80px', gap: 34 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
            <div style={{ fontSize: 84, fontWeight: 900, color: 'white', letterSpacing: -1 }}>YallaTrip</div>
            <img src={logoDataUri()} width={104} height={104} alt="" style={{ boxShadow: '0 12px 30px rgba(0,0,0,.35)', borderRadius: 24 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', color: 'white', fontSize: 58, fontWeight: 900, lineHeight: 1.2 }}>
            <div style={{ display: 'flex', whiteSpace: 'nowrap' }}>{seen('נועצים על המפה,')}</div>
            <div style={{ display: 'flex', whiteSpace: 'nowrap' }}>{seen('מקבלים מסלול יומי מסודר')}</div>
          </div>
          <div style={{ display: 'flex', width: 120, height: 8, borderRadius: 99, background: 'linear-gradient(90deg, #35A7E0, #1B73C9)' }} />
        </div>
      </div>
    ),
    { ...size, fonts },
  );
  const jpeg = await sharp(Buffer.from(await png.arrayBuffer())).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpeg), { headers: { 'Content-Type': 'image/jpeg' } });
}

