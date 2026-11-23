// The landing page's background: an original sky-and-sea illustration (no photos to load).
// Sky fades from deep blue to a light horizon, a low sun, soft clouds, two mountain ridges
// and a sea with a sun path. Drawn to cover any screen size.
export function HeroScene({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="hs-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0A2F57" />
          <stop offset="0.45" stopColor="#1E6FB8" />
          <stop offset="0.72" stopColor="#6FB9E6" />
          <stop offset="0.8" stopColor="#CDEBF8" />
        </linearGradient>
        <radialGradient id="hs-sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFF7DC" stopOpacity="0.95" />
          <stop offset="0.35" stopColor="#FFE9A8" stopOpacity="0.45" />
          <stop offset="1" stopColor="#FFE9A8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hs-sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3D9BD6" />
          <stop offset="0.4" stopColor="#1B73C9" />
          <stop offset="1" stopColor="#072A4F" />
        </linearGradient>
        <linearGradient id="hs-far" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5E9ECF" />
          <stop offset="1" stopColor="#8CC4E6" />
        </linearGradient>
        <linearGradient id="hs-near" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1C5A8F" />
          <stop offset="1" stopColor="#2F79B3" />
        </linearGradient>
        <filter id="hs-blur" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
      </defs>

      <rect width="1440" height="900" fill="url(#hs-sky)" />
      <circle cx="1040" cy="585" r="260" fill="url(#hs-sun)" />
      <circle cx="1040" cy="585" r="46" fill="#FFF4CF" />

      <g fill="#FFFFFF" filter="url(#hs-blur)">
        <ellipse cx="260" cy="190" rx="210" ry="38" opacity="0.35" />
        <ellipse cx="420" cy="230" rx="160" ry="28" opacity="0.25" />
        <ellipse cx="1180" cy="150" rx="240" ry="40" opacity="0.3" />
        <ellipse cx="880" cy="300" rx="190" ry="30" opacity="0.22" />
        <ellipse cx="120" cy="420" rx="180" ry="26" opacity="0.2" />
      </g>

      <g fill="none" stroke="#0A2F57" strokeWidth="3" strokeLinecap="round" opacity="0.55">
        <path d="M600 250 q10 -9 20 0 q10 -9 20 0" />
        <path d="M660 225 q7 -6 14 0 q7 -6 14 0" />
        <path d="M560 280 q6 -5 12 0 q6 -5 12 0" />
      </g>

      <path fill="url(#hs-far)" opacity="0.85"
        d="M0 610 L120 540 L210 575 L330 480 L450 560 L560 515 L680 590 L760 560 L860 600 L980 545 L1120 600 L1240 530 L1340 575 L1440 540 L1440 640 L0 640 Z" />
      <path fill="url(#hs-near)"
        d="M0 640 L90 600 L180 625 L300 560 L420 628 L520 600 L640 640 L0 640 Z" />
      <path fill="url(#hs-near)" opacity="0.9"
        d="M900 640 L1010 612 L1100 628 L1210 585 L1320 622 L1440 596 L1440 640 Z" />

      <rect y="638" width="1440" height="262" fill="url(#hs-sea)" />
      <ellipse cx="1040" cy="700" rx="60" ry="70" fill="#FFF4CF" opacity="0.16" />
      <g stroke="#FFFFFF" strokeLinecap="round" fill="none">
        <path d="M985 660 h110 M965 685 h150 M990 712 h100 M950 742 h180 M1000 776 h80" strokeWidth="3" opacity="0.35" />
        <path d="M80 690 q60 -12 120 0 t120 0 M340 740 q70 -14 140 0 t140 0 M120 800 q80 -14 160 0 t160 0 M620 700 q50 -10 100 0 t100 0 M1200 760 q60 -12 120 0 t120 0 M760 830 q70 -14 140 0 t140 0" strokeWidth="2" opacity="0.18" />
      </g>
    </svg>
  );
}

/** A small illustrated map with a dashed route between three pins (decorative). */
export function HeroMapCard({ className }: { className?: string }) {
  return (
    <div className={`overflow-hidden rounded-2xl border-4 border-white/90 bg-white shadow-2xl ${className ?? ''}`} aria-hidden="true">
      <svg width="260" height="170" viewBox="0 0 260 170">
        <rect width="260" height="170" fill="#CFE8F7" />
        <path d="M0 40 C40 20 70 55 110 42 C150 28 170 60 200 50 C225 42 245 55 260 48 L260 0 L0 0 Z" fill="#EEF6FB" />
        <path d="M0 170 L0 120 C30 110 60 132 95 118 C120 108 140 125 160 140 C185 158 220 132 260 140 L260 170 Z" fill="#EEF6FB" />
        <path d="M150 70 C170 62 195 75 205 92 C212 106 196 116 180 110 C165 104 145 88 150 70 Z" fill="#E4F0F8" />
        <path d="M50 78 C95 60 150 120 205 90" fill="none" stroke="#0C2D4A" strokeWidth="2.5" strokeDasharray="6 6" strokeLinecap="round" />
        {[[50, 78, '#1B73C9'], [128, 96, '#0B8FB8'], [205, 90, '#1B73C9']].map(([x, y, c], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            <path d="M0 0 C-8 -10 -9 -14 -9 -17 A9 9 0 0 1 9 -17 C9 -14 8 -10 0 0 Z" fill={c as string} stroke="#fff" strokeWidth="2" />
            <circle cy="-17" r="3.2" fill="#fff" />
          </g>
        ))}
      </svg>
    </div>
  );
}
