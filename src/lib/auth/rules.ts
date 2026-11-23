// Pure sign-in rules: which pages are protected, where to send people,
// and validation of every sign-in form. No framework imports, so it is unit-tested.

// ---------- routes ----------
/** Pages that need a signed-in user. */
export const PROTECTED_PREFIXES = ['/trips', '/onboarding', '/profile', '/creator', '/admin'] as const;
/** Pages a signed-in user has no reason to see. */
export const AUTH_ONLY_PAGES = ['/login', '/signup', '/forgot-password'] as const;

const matches = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

export function isProtectedPath(path: string): boolean {
  return PROTECTED_PREFIXES.some((p) => matches(path, p));
}

export function isAuthOnlyPage(path: string): boolean {
  return AUTH_ONLY_PAGES.some((p) => matches(path, p));
}

// After signing in or signing up, people land on the main screen (the home page).
export const DEFAULT_AFTER_LOGIN = '/';

/**
 * A "next" address from the URL is only followed if it stays on this site.
 * Blocks open redirects such as //evil.com, /\evil.com or https://evil.com.
 */
export function safeNextPath(value: unknown, fallback: string = DEFAULT_AFTER_LOGIN): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 500) return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  if (/[\u0000-\u001f\\]/.test(value) || value.includes('://')) return fallback;
  if (isAuthOnlyPage(value.split('?')[0] ?? '')) return fallback;
  return value;
}

// ---------- form state shared by server actions and forms ----------
export type FormState = {
  error?: string;
  success?: string;
  /** A question the user must confirm before the action goes ahead. */
  warning?: string;
  fieldErrors?: Partial<Record<string, string>>;
  values?: Record<string, string>;
};

type FieldResult<T> = { ok: true; value: T } | { ok: false; fieldErrors: Record<string, string> };

const s = (v: unknown) => (typeof v === 'string' ? v : '');

// ---------- single fields ----------
export function emailError(raw: string): string | null {
  const email = raw.trim();
  if (!email) return 'צריך למלא אימייל';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return 'האימייל לא נראה תקין';
  return null;
}

export const PASSWORD_MIN = 8;

export function passwordError(pw: string): string | null {
  if (!pw) return 'צריך למלא סיסמה';
  if (pw.length < PASSWORD_MIN) return `סיסמה צריכה לפחות ${PASSWORD_MIN} תווים`;
  // bcrypt (used by Supabase) ignores bytes past 72
  if (new TextEncoder().encode(pw).length > 72) return 'הסיסמה ארוכה מדי';
  if (!/[A-Za-z֐-׿]/.test(pw) || !/\d/.test(pw)) return 'סיסמה צריכה לכלול גם אותיות וגם ספרות';
  return null;
}

export function nameError(raw: string): string | null {
  const name = raw.trim();
  if (!name) return 'איך לקרוא לך?';
  if (name.length > 80) return 'השם ארוך מדי';
  return null;
}

// ---------- forms ----------
export function parseLogin(input: Record<string, unknown>): FieldResult<{ email: string; password: string }> {
  const email = s(input.email).trim().toLowerCase();
  const password = s(input.password);
  const fieldErrors: Record<string, string> = {};
  const e = emailError(email);
  if (e) fieldErrors.email = e;
  if (!password) fieldErrors.password = 'צריך למלא סיסמה';
  return Object.keys(fieldErrors).length ? { ok: false, fieldErrors } : { ok: true, value: { email, password } };
}

export function parseSignup(
  input: Record<string, unknown>,
): FieldResult<{ name: string; email: string; password: string }> {
  const name = s(input.name).trim();
  const email = s(input.email).trim().toLowerCase();
  const password = s(input.password);
  const confirm = s(input.confirm);
  const fieldErrors: Record<string, string> = {};
  const n = nameError(name);
  if (n) fieldErrors.name = n;
  const e = emailError(email);
  if (e) fieldErrors.email = e;
  const p = passwordError(password);
  if (p) fieldErrors.password = p;
  else if (password !== confirm) fieldErrors.confirm = 'הסיסמאות לא זהות';
  return Object.keys(fieldErrors).length ? { ok: false, fieldErrors } : { ok: true, value: { name, email, password } };
}

export function parseNewPassword(input: Record<string, unknown>): FieldResult<{ password: string }> {
  const password = s(input.password);
  const p = passwordError(password);
  if (p) return { ok: false, fieldErrors: { password: p } };
  if (password !== s(input.confirm)) return { ok: false, fieldErrors: { confirm: 'הסיסמאות לא זהות' } };
  return { ok: true, value: { password } };
}

// ---------- onboarding ----------
export const TRAVEL_STYLES = [
  { key: 'food', label: 'אוכל' },
  { key: 'attractions', label: 'אטרקציות' },
  { key: 'shopping', label: 'שופינג' },
  { key: 'nature', label: 'טבע' },
  { key: 'nightlife', label: 'חיי לילה' },
  { key: 'culture', label: 'תרבות ומוזיאונים' },
  { key: 'relax', label: 'רגוע' },
  { key: 'family', label: 'עם ילדים' },
] as const;

export const BUDGETS = [
  { key: 'low', label: 'חסכוני' },
  { key: 'medium', label: 'בינוני' },
  { key: 'high', label: 'מפנק' },
] as const;

export const TRANSPORTS = [
  { key: 'walk', label: 'הליכה' },
  { key: 'transit', label: 'תחבורה ציבורית' },
  { key: 'car', label: 'רכב' },
  { key: 'taxi', label: 'מוניות' },
] as const;

type Key<T extends readonly { key: string }[]> = T[number]['key'];
export type OnboardingAnswers = {
  travelStyles: Key<typeof TRAVEL_STYLES>[];
  budget: Key<typeof BUDGETS> | null;
  transport: Key<typeof TRANSPORTS>[];
};

const pick = <T extends readonly { key: string }[]>(list: T, values: unknown[]): Key<T>[] => {
  const allowed = new Set(list.map((x) => x.key));
  return [...new Set(values.filter((v): v is Key<T> => typeof v === 'string' && allowed.has(v)))];
};

/** Unknown values are dropped silently: onboarding is optional, never blocking. */
export function parseOnboarding(styles: unknown[], budget: unknown, transport: unknown[]): OnboardingAnswers {
  const b = pick(BUDGETS, [budget])[0] ?? null;
  return { travelStyles: pick(TRAVEL_STYLES, styles), budget: b, transport: pick(TRANSPORTS, transport) };
}

/** A yes/no answer from a form: true, false, or null when it was not answered. */
export function parseYesNo(v: unknown): boolean | null {
  return v === 'yes' ? true : v === 'no' ? false : null;
}

/** Typed by the user to confirm deleting their account. */
export const DELETE_CONFIRM_WORD = 'מחיקה';
