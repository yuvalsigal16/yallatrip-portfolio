import type { Metadata, Viewport } from 'next';
import { Heebo } from 'next/font/google';
import './globals.css';
import { PwaShell } from '@/components/pwa/Pwa';
import { splashStartupImages } from '@/lib/splash';
import { ICON_VERSION } from '@/lib/brand';

// One typeface everywhere (owner request): Heebo, a variable font with every weight 100–900.
const heebo = Heebo({ subsets: ['hebrew', 'latin'], variable: '--font-heebo', display: 'swap' });

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://gotrip-go-trip1.vercel.app';
const DESCRIPTION = 'נועצים על המפה את מה שרוצים לראות, ומקבלים מסלול יומי מסודר.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: 'YallaTrip · תכנון טיולים',
  description: DESCRIPTION,
  // How a shared link looks in WhatsApp, Facebook and the like.
  // The picture comes from app/opengraph-image.tsx (1200x630).
  openGraph: { type: 'website', locale: 'he_IL', siteName: 'YallaTrip', title: 'YallaTrip · תכנון טיולים', description: DESCRIPTION },
  twitter: { card: 'summary_large_image', title: 'YallaTrip · תכנון טיולים', description: DESCRIPTION },
  formatDetection: { telephone: false },
  // Added to the home screen it opens like an app (full screen, its own icon).
  appleWebApp: { capable: true, title: 'YallaTrip', statusBarStyle: 'default', startupImage: splashStartupImages },
  // The tab: the simple logo (SVG, sharp at any size; PNG for older browsers). The iPhone home screen: 180.
  icons: {
    icon: [
      { url: `/api/icons/svg?v=${ICON_VERSION}`, type: 'image/svg+xml' },
      { url: `/api/icons/32?v=${ICON_VERSION}`, sizes: '32x32', type: 'image/png' },
    ],
    apple: `/api/icons/180?v=${ICON_VERSION}`,
  },
};

export const viewport: Viewport = { themeColor: '#1B73C9' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={heebo.variable}>
      <body><PwaShell />{children}</body>
    </html>
  );
}
