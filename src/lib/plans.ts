/**
 * "תוכניות ומחירים": what is free (everything on the site today, with no limits) and what paid plans will add.
 * Display only: card payments are off, nothing is charged and nothing is limited by these.
 */
export const PAID_EXTRAS = [
  '✨ מה יש בסביבה, בלי הגבלה',
  'כרטיסי מקום מלאים (דירוג, שעות ותמונה), בלי תקרה חודשית',
  'בזמן הטיול: מה עושים עכשיו, יורד גשם? ואני כאן',
  'סיכום טיול יפה לשיתוף בסטורי',
  'ייצוא הטיול ל-PDF',
  'סנכרון הימים ליומן בטלפון',
] as const;

export const FREE_FEATURES = [
  'כל מה שיש היום באתר',
  'מפה, שמירת מקומות וחלוקה לימים',
  'עבודה בלי אינטרנט',
  '"סדר את היום"',
  'תקציב וחלוקת הוצאות',
  'תכנון משותף עם חברים',
  'בלי הגבלה על אורך הטיול או על מספר הטיולים',
] as const;

/** Prices in shekels. Approved content creators see their own lower prices, with the regular one struck through. */
export const PRICES = {
  tripShort: { regular: 39, creator: 29 }, // a trip of up to 6 days
  tripLong: { regular: 59, creator: 49 },  // a trip of 7 days or more
  year: { regular: 199, creator: 99 },
} as const;
export const TRIP_SHORT_MAX_DAYS = 6;

/** Whether to show creator prices: approved creators only; the admin picks a version ("תצוגה כמו"). */
export function showsCreatorPrices(role: 'user' | 'creator' | 'admin' | null | undefined, view?: string): boolean {
  return role === 'admin' ? view === 'creator' : role === 'creator';
}

/** The prices a page shows, in order: up to 6 days, 7 days and more, a year. */
export function shownPrices(creator: boolean): number[] {
  return [PRICES.tripShort, PRICES.tripLong, PRICES.year].map((p) => (creator ? p.creator : p.regular));
}
