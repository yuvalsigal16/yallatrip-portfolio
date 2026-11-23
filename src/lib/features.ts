// Feature switches: one place to turn whole features on and off.
//
// A feature that is off does not show anywhere: no button, link, menu line, guide step or mark,
// and its pages send visitors to "הטיולים שלי". Nothing is deleted: the code and the data
// (saved bookings, votes, chat messages, creator recommendations...) stay, and come back as they
// were when the switch is turned on again. To turn one on: change `false` to `true` below.

export const FEATURES = {
  /** "🇮🇱 ישראלים ממליצים" on the trip map. */
  israeliPicks: false,
  /** "🇮🇱 ישראלים כאן" in "מה צריך לדעת": finding Israelis who will be in the same country on the same dates. */
  israelisHere: false,
  /**
   * Routes and creators: the routes page (/routes) and its links, the creator area (/creator),
   * creators' pages (/creators/…), "הרשמה כיוצר/ת תוכן" (sign-up, menu, profile),
   * "⭐ מומלץ ע״י" on a place card and in "מה יש בסביבה", and a trip's "ציבורי" (in "מסלולים") sharing.
   */
  routes: false,
  /** The trip's chat (for trips planned together). */
  chat: false,
  /** 👍 / 👎 votes on saved places (for trips planned together). */
  votes: false,
  /** "מה עושים עכשיו?" (with "☔ יורד גשם?" inside it) during the trip. */
  whatNow: false,
  /** "מתלבטים בין שניים": a second place for the same time in a day. */
  alternatives: false,
  /** "📸 סיכום הטיול": the story picture to share. */
  tripStory: false,
  /** Bookings and documents ("הזמנות" in "עוד בטיול", and the day's bookings in "היום" and in the plan). */
  bookings: false,
  /**
   * "תוכניות ומחירים": the page, its menu line, the page that opens after saving places on the first trip,
   * and the "⭐ במנוי" marks. While off, everything is free and open to everyone.
   */
  plans: false,
  /**
   * "קצב הטיול" (רגוע / רגיל / מלא): the question in the new-trip form and the "קצב" row in "לפי ימים".
   * While off, every trip plans at the normal pace (up to 5 things a day, from 09:00), and the row's checkbox
   * "לשאול לאיזה יום לשבץ" stands by itself. A pace already saved stays in the database.
   */
  pace: false,
} as const;

export type FeatureKey = keyof typeof FEATURES;

/** Pages that belong to a feature that is off: anyone who opens them goes to "הטיולים שלי". */
export function isOffPath(path: string): boolean {
  if (!FEATURES.routes && /^\/(routes|creator|creators)(\/|$)/.test(path)) return true;
  if (!FEATURES.plans && /^\/plans(\/|$)/.test(path)) return true;
  if (!FEATURES.bookings && /^\/trips\/[^/]+\/bookings(\/|$)/.test(path)) return true;
  return false;
}

/**
 * Paid routes: prices, checkout, creator income, commissions and payouts.
 * OFF until YallaTrip opens to the public. While off, every route in the store is free,
 * no price is asked or shown, and the payment webhook refuses requests.
 * The payment code and database tables stay in place for when it is turned on.
 * (Set in the hosting provider's settings: NEXT_PUBLIC_ENABLE_PAID_ROUTES=true.)
 */
export const PAID_ROUTES = process.env.NEXT_PUBLIC_ENABLE_PAID_ROUTES === 'true';
