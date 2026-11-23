// Supabase Auth error codes -> messages in Hebrew.
// Login errors are deliberately vague ("email or password") so the form
// does not reveal which emails have accounts.

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'האימייל או הסיסמה לא נכונים',
  email_not_confirmed: 'צריך לאשר את האימייל. בדקו את תיבת הדואר (גם בספאם)',
  user_already_exists: 'כבר יש חשבון עם האימייל הזה. אפשר להתחבר או לאפס סיסמה',
  email_exists: 'כבר יש חשבון עם האימייל הזה. אפשר להתחבר או לאפס סיסמה',
  weak_password: 'הסיסמה חלשה מדי. נסו סיסמה ארוכה יותר, עם אותיות וספרות',
  same_password: 'הסיסמה החדשה זהה לישנה',
  email_address_invalid: 'האימייל לא נראה תקין',
  over_email_send_rate_limit: 'נשלחו יותר מדי מיילים. נסו שוב בעוד כמה דקות',
  over_request_rate_limit: 'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות',
  signup_disabled: 'ההרשמה סגורה כרגע',
  provider_disabled: 'ההתחברות הזו לא פעילה כרגע',
  session_expired: 'פג תוקף ההתחברות. התחברו שוב',
  flow_state_expired: 'פג תוקף הקישור. בקשו קישור חדש',
  otp_expired: 'פג תוקף הקישור. בקשו קישור חדש',
};

export const GENERIC_ERROR = 'משהו השתבש. נסו שוב';

export function authErrorMessage(err: { code?: string | null; status?: number | null } | null | undefined): string {
  if (!err) return GENERIC_ERROR;
  if (err.code && MESSAGES[err.code]) return MESSAGES[err.code]!;
  if (err.status === 429) return MESSAGES.over_request_rate_limit!;
  return GENERIC_ERROR;
}

/** Errors that arrive in the URL after a failed email link or Google sign-in. */
export function callbackErrorMessage(code: string | null): string | null {
  if (!code) return null;
  if (code === 'callback') return 'הקישור לא תקין או שפג תוקפו. נסו שוב';
  if (code === 'google') return 'ההתחברות עם Google לא הושלמה. נסו שוב';
  return GENERIC_ERROR;
}
