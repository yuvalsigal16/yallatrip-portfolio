// The YallaTrip logo: a yellow pin at the end of a dotted path, on brand blue.
// One source for every place it is drawn: the header, the browser tab, home-screen icons,
// start-up screens and the picture shown when a link is shared.

/** Bump to make phones and browsers fetch the icons and start-up pictures again (they are cached for a week). */
export const ICON_VERSION = '2';

const BLUE = '#1B73C9';
const PIN = 'M78 70 C 66 56 62 50 62 42 a16 16 0 0 1 32 0 c0 8 -4 14 -16 28z';
const PATH = 'M28 92 C 44 66, 64 96, 76 74';

/** The drawing on a 120x120 square, without the background. `small`: thicker dots and no small details (tab, header). */
function drawing(small: boolean): string {
  return small
    ? `<path d="${PATH}" stroke="#FFFFFF" stroke-width="8" stroke-dasharray="2 12" stroke-linecap="round" fill="none"/>`
      + `<path d="${PIN}" fill="#FFD166"/>`
    : `<path d="${PATH}" stroke="#FFFFFF" stroke-width="5" stroke-dasharray="2 9" stroke-linecap="round" fill="none"/>`
      + `<circle cx="28" cy="92" r="6" fill="#FFFFFF"/>`
      + `<path d="${PIN}" fill="#FFD166"/><circle cx="78" cy="42" r="6" fill="#0B3D6E"/>`;
}

/**
 * The logo as SVG text.
 * - `small`: the simple version, for 16–64px (browser tab, header).
 * - `square`: a full square without rounded corners, for a phone that rounds the icon itself (iPhone home screen).
 * - `safe`: the drawing shrunk into the middle 80%, so a phone's round or squircle mask never cuts it (Android "maskable").
 */
export function logoSvg({ small = false, square = false, safe = false }: { small?: boolean; square?: boolean; safe?: boolean } = {}): string {
  const bg = `<rect width="120" height="120"${square || safe ? '' : ' rx="28"'} fill="${BLUE}"/>`;
  const art = safe ? `<g transform="translate(12 12) scale(0.8)">${drawing(small)}</g>` : drawing(small);
  return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">${bg}${art}</svg>`;
}

/** The logo as an image address, for <img> in the image library (icons, start-up screens, share picture). */
export const logoDataUri = (opts?: Parameters<typeof logoSvg>[0]) =>
  `data:image/svg+xml;base64,${Buffer.from(logoSvg(opts)).toString('base64')}`;

/**
 * Heebo, the site's typeface, from Google Fonts as TTF (free; not Google Maps), for pictures made on the server.
 * `text` asks only for the letters needed, so the file is tiny. Null when it can't be fetched (a plain font is used).
 */
export async function heeboFont(weight: number, text?: string): Promise<ArrayBuffer | null> {
  try {
    const q = `family=Heebo:wght@${weight}${text ? `&text=${encodeURIComponent(text)}` : ''}`;
    const css = await (await fetch(`https://fonts.googleapis.com/css2?${q}`)).text();
    const url = css.match(/url\((https:[^)]+)\)\s*format\('(?:truetype|opentype)'\)/)?.[1] ?? css.match(/url\((https:[^)]+\.ttf)\)/)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch {
    return null;
  }
}
