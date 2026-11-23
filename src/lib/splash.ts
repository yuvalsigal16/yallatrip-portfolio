import { ICON_VERSION } from '@/lib/brand';

// iPhone screens (CSS width × height, pixel ratio) that get a start-up picture for the home-screen app.
export const SPLASH_SIZES = [
  { w: 393, h: 852, dpr: 3 }, // 14 Pro, 15, 15 Pro, 16
  { w: 390, h: 844, dpr: 3 }, // 12, 13, 14, 16e
  { w: 430, h: 932, dpr: 3 }, // 14 Pro Max, 15 Plus / Pro Max, 16 Plus
  { w: 402, h: 874, dpr: 3 }, // 16 Pro
  { w: 440, h: 956, dpr: 3 }, // 16 Pro Max
  { w: 428, h: 926, dpr: 3 }, // 12 / 13 Pro Max, 14 Plus
  { w: 375, h: 812, dpr: 3 }, // X, XS, 11 Pro, 12 / 13 mini
  { w: 414, h: 896, dpr: 3 }, // XS Max, 11 Pro Max
  { w: 414, h: 896, dpr: 2 }, // XR, 11
  { w: 375, h: 667, dpr: 2 }, // SE, 8
] as const;

export const splashStartupImages = SPLASH_SIZES.map((s) => ({
  url: `/api/splash/${s.w * s.dpr}x${s.h * s.dpr}?v=${ICON_VERSION}`,
  media: `(device-width: ${s.w}px) and (device-height: ${s.h}px) and (-webkit-device-pixel-ratio: ${s.dpr}) and (orientation: portrait)`,
}));
