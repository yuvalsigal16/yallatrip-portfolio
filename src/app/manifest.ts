import type { MetadataRoute } from 'next';
import { ICON_VERSION } from '@/lib/brand';

// Lets the phone add YallaTrip to the home screen and open it like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/launch',
    name: 'YallaTrip',
    short_name: 'YallaTrip',
    description: 'נועצים על המפה את מה שרוצים לראות, ומקבלים מסלול יומי מסודר.',
    lang: 'he',
    dir: 'rtl',
    // Opens on the walking screen, which moves on to the trips by itself.
    start_url: '/launch',
    scope: '/',
    display: 'standalone',
    background_color: '#1B73C9',
    theme_color: '#1B73C9',
    icons: [
      { src: `/api/icons/192?v=${ICON_VERSION}`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `/api/icons/512?v=${ICON_VERSION}`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Full square, drawing in the safe middle: Android cuts it to its own shape.
      { src: `/api/icons/maskable?v=${ICON_VERSION}`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
