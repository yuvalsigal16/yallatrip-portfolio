import type { ReactNode } from 'react';

// Real travel photography (Unsplash license), one per page.
export const HERO_PHOTOS = {
  trips: 'photo-1469854523086-cc02fe5d8800', // open road through the desert
  routes: 'photo-1476514525535-07fb3b4ae5f1', // mountain lake with a boat
  profile: 'photo-1436491865332-7a61a109cc05', // airplane above the clouds
  creator: 'photo-1488646953014-85cb44e25828', // planning a trip on a map
  admin: 'photo-1477959858617-67f85cf4f1df', // city skyline at dusk
  settings: 'photo-1500530855697-b586d89ba3ee', // green valley
  newTrip: 'photo-1507525428034-b723cf961d3e', // tropical beach
  mountains: 'photo-1506905925346-21bda4d32df4', // peaks above the clouds
} as const;

/** An Unsplash photo id, or any full image URL. */
export function photoSrc(photo: string, w = 1600) {
  return photo.startsWith('photo-') ? `https://images.unsplash.com/${photo}?auto=format&fit=crop&q=75&w=${w}` : photo;
}

/**
 * The band at the top of app pages: a real travel photo under a deep-blue shade, the title on top.
 * The page's first card can slide up over its lower edge (overlap + a negative top margin on <main>).
 */
export function PageHero({ title, eyebrow, subtitle, back, photo = HERO_PHOTOS.mountains, width = 'max-w-[1280px]', overlap = false, children }: {
  title: ReactNode;
  eyebrow?: ReactNode;
  subtitle?: ReactNode;
  back?: { href: string; label: string };
  /** Unsplash photo id (see HERO_PHOTOS) or a full image URL. */
  photo?: string;
  width?: string;
  /** Leave room for the first card to overlap the band's lower edge. */
  overlap?: boolean;
  children?: ReactNode;
}) {
  const unsplash = photo.startsWith('photo-');
  return (
    <section className="relative isolate overflow-hidden bg-[#0B3D6E] text-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photoSrc(photo)} alt="" decoding="async" fetchPriority="high"
        {...(unsplash ? { srcSet: [800, 1400, 2000].map((w) => `${photoSrc(photo, w)} ${w}w`).join(', '), sizes: '100vw' } : {})}
        className="absolute inset-0 -z-20 h-full w-full scale-105 object-cover" />
      {/* Shade: darkest behind the text (right side in Hebrew) and at the bottom edge */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-l from-[#051A33]/90 via-[#0B3D6E]/65 to-[#0B3D6E]/25" aria-hidden="true" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#051A33]/60 via-transparent to-[#051A33]/20" aria-hidden="true" />

      <div className={`gt-hero-in mx-auto ${width} px-5 pt-7 sm:px-10 sm:pt-16 ${overlap ? 'pb-16 sm:pb-24' : 'pb-8 sm:pb-14'}`}>
        {back && (
          <a href={back.href} className="mb-3 inline-flex min-h-10 items-center gap-1 rounded-full sm:mb-5 border border-white/25 bg-white/10 px-4 py-1.5 text-sm font-bold text-white no-underline backdrop-blur-md transition hover:bg-white/20">
            {back.label}
          </a>
        )}
        {eyebrow && <p className="mb-1 text-sm font-bold tracking-wide text-white/75">{eyebrow}</p>}
        <h1 className="font-display text-3xl font-black leading-tight [text-shadow:0_2px_24px_rgba(0,0,0,.35)] sm:text-6xl">{title}</h1>
        {subtitle && <div className="mt-2 max-w-2xl text-base leading-relaxed text-white/90 sm:mt-3 sm:text-lg [text-shadow:0_1px_12px_rgba(0,0,0,.3)]">{subtitle}</div>}
        {children && <div className="mt-5 sm:mt-7">{children}</div>}
      </div>

      {unsplash && (
        <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer"
          className="absolute top-2 left-3 text-[11px] text-white/60 no-underline hover:text-white">צילום: Unsplash</a>
      )}
    </section>
  );
}
