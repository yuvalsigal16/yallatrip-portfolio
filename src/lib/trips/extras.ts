// Pure rules for the trip checklist and the trip budget. No database here, so they are easy to test.

// ---------- checklist ----------
export type ChecklistItem = { id: string; text: string; done: boolean; position: number };

/** Ready-made items to add with one tap, grouped the way people think about a trip. */
export const CHECKLIST_SUGGESTIONS: { group: string; items: string[] }[] = [
  { group: 'מסמכים', items: ['דרכון בתוקף (6 חודשים לפחות)', 'ביטוח נסיעות', 'כרטיסי טיסה', 'אישורי הזמנה למלונות', 'רישיון נהיגה בינלאומי', 'ויזה (אם צריך)', 'צילום של הדרכון בטלפון'] },
  { group: 'כסף ותקשורת', items: ['כרטיס אשראי שעובד בחו"ל', 'מעט מזומן במטבע המקומי', 'חבילת גלישה / eSIM', 'להודיע לבנק על הנסיעה'] },
  { group: 'ציוד', items: ['מטען וכבלים', 'מתאם לשקע', 'סוללה ניידת', 'תרופות קבועות', 'משקפי שמש וקרם הגנה', 'נעליים נוחות להליכה', 'מטרייה / מעיל גשם'] },
  { group: 'לפני שיוצאים מהבית', items: ['צ\'ק-אין לטיסה', 'הסעה לשדה התעופה', 'לכבות חשמל ומזגן', 'לרוקן את המקרר'] },  // by kind of trip
  { group: 'חורף ושלג', items: ['מעיל חם', 'בגדים תרמיים', 'כפפות, כובע וצעיף', 'נעליים עמידות למים', 'גרביים חמים', 'שפתון וקרם לחות'] },
  { group: 'ים וחוף', items: ['בגד ים', 'מגבת חוף', 'כפכפים', 'כובע', 'קרם הגנה עמיד למים', 'שקית אטומה לטלפון', 'משקפת / שנורקל'] },
  { group: 'טיול עם ילדים', items: ['חטיפים ובקבוקי מים', 'בגדים להחלפה', 'משחקים וספרים לדרך', 'טאבלט ואוזניות', 'עגלה / מנשא', 'מגבונים', 'תרופות לילדים ומד חום', 'כיסא בטיחות (אם שוכרים רכב)'] },
  { group: 'טרק וטבע', items: ['נעלי הליכה שכבר נעלתי', 'תיק יום', 'בקבוק מים / שלוקר', 'פנס ראש', 'ערכת עזרה ראשונה', 'מפה שמורה בטלפון', 'מעיל רוח', 'דוחה יתושים'] },
  { group: 'עיר ומוזיאונים', items: ['כרטיסים שהוזמנו מראש', 'כרטיס תחבורה ציבורית', 'תיק קטן שנסגר', 'בגד מכובד לאתרים דתיים'] },
];

export function parseChecklistText(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.replace(/\s+/g, ' ').trim();
  return t.length >= 1 && t.length <= 200 ? t : null;
}

// ---------- budget ----------
export const EXPENSE_CATEGORIES = [
  { key: 'lodging', label: 'לינה', icon: '🛏️' },
  { key: 'food', label: 'אוכל', icon: '🍽️' },
  { key: 'transport', label: 'תחבורה', icon: '🚕' },
  { key: 'flights', label: 'טיסות', icon: '✈️' },
  { key: 'attractions', label: 'אטרקציות', icon: '🎟️' },
  { key: 'shopping', label: 'קניות', icon: '🛍️' },
  { key: 'other', label: 'אחר', icon: '•' },
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]['key'];
export const isExpenseCategory = (v: unknown): v is ExpenseCategory => EXPENSE_CATEGORIES.some((c) => c.key === v);
export const categoryOf = (k: string) => EXPENSE_CATEGORIES.find((c) => c.key === k) ?? EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1]!;

/** Common currencies first; any other 3-letter code can be typed in. */
export const CURRENCIES: { code: string; label: string; symbol: string }[] = [
  { code: 'ILS', label: 'שקל', symbol: '₪' },
  { code: 'USD', label: 'דולר אמריקאי', symbol: '$' },
  { code: 'EUR', label: 'יורו', symbol: '€' },
  { code: 'GBP', label: 'לירה שטרלינג', symbol: '£' },
  { code: 'GEL', label: 'לארי גאורגי', symbol: '₾' },
  { code: 'TRY', label: 'לירה טורקית', symbol: '₺' },
  { code: 'THB', label: 'באט תאילנדי', symbol: '฿' },
  { code: 'JPY', label: 'ין יפני', symbol: '¥' },
  { code: 'CHF', label: 'פרנק שוויצרי', symbol: 'CHF' },
  { code: 'CZK', label: 'קורונה צ\'כית', symbol: 'Kč' },
  { code: 'HUF', label: 'פורינט הונגרי', symbol: 'Ft' },
  { code: 'PLN', label: 'זלוטי פולני', symbol: 'zł' },
  { code: 'RON', label: 'לאו רומני', symbol: 'lei' },
  { code: 'BGN', label: 'לב בולגרי', symbol: 'лв' },
  { code: 'AED', label: 'דירהם', symbol: 'AED' },
  { code: 'EGP', label: 'לירה מצרית', symbol: 'E£' },
  { code: 'JOD', label: 'דינר ירדני', symbol: 'JD' },
  { code: 'INR', label: 'רופי הודי', symbol: '₹' },
  { code: 'VND', label: 'דונג וייטנאמי', symbol: '₫' },
  { code: 'CNY', label: 'יואן סיני', symbol: '¥' },
  { code: 'KRW', label: 'וון קוריאני', symbol: '₩' },
  { code: 'AUD', label: 'דולר אוסטרלי', symbol: 'A$' },
  { code: 'CAD', label: 'דולר קנדי', symbol: 'C$' },
  { code: 'MXN', label: 'פסו מקסיקני', symbol: 'MX$' },
  { code: 'ARS', label: 'פסו ארגנטינאי', symbol: 'AR$' },
  { code: 'BRL', label: 'ריאל ברזילאי', symbol: 'R$' },
  { code: 'CLP', label: 'פסו צ\'יליאני', symbol: 'CL$' },
  { code: 'PEN', label: 'סול פרואני', symbol: 'S/' },
  { code: 'COP', label: 'פסו קולומביאני', symbol: 'CO$' },
  { code: 'BOB', label: 'בוליביאנו', symbol: 'Bs' },
  { code: 'CRC', label: 'קולון קוסטה ריקני', symbol: '₡' },
  { code: 'NPR', label: 'רופי נפאלי', symbol: 'रू' },
  { code: 'LKR', label: 'רופי סרי לנקי', symbol: 'Rs' },
  { code: 'PHP', label: 'פסו פיליפיני', symbol: '₱' },
  { code: 'KHR', label: 'ריאל קמבודי', symbol: '៛' },
  { code: 'LAK', label: 'קיפ לאי', symbol: '₭' },
  { code: 'NZD', label: 'דולר ניו זילנדי', symbol: 'NZ$' },
  { code: 'ZAR', label: 'ראנד', symbol: 'R' },
  { code: 'MAD', label: 'דירהם מרוקאי', symbol: 'MAD' },
  { code: 'TZS', label: 'שילינג טנזני', symbol: 'TSh' },
  { code: 'KES', label: 'שילינג קנייתי', symbol: 'KSh' },
  { code: 'ISK', label: 'קרונה איסלנדית', symbol: 'kr' },
  { code: 'NOK', label: 'קרונה נורווגית', symbol: 'kr' },
  { code: 'SEK', label: 'קרונה שוודית', symbol: 'kr' },
  { code: 'DKK', label: 'קרונה דנית', symbol: 'kr' },
  { code: 'ALL', label: 'לק אלבני', symbol: 'L' },
];
export const isCurrency = (v: unknown): v is string => typeof v === 'string' && /^[A-Z]{3}$/.test(v);
export const currencySymbol = (code: string) => CURRENCIES.find((c) => c.code === code)?.symbol ?? code;

/** "1,234.5" / "1234,50" / "₾ 12" -> number; null when it is not a positive amount. */
export function parseAmount(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) && raw > 0 ? Math.round(raw * 100) / 100 : null;
  if (typeof raw !== 'string') return null;
  let s = raw.replace(/[^\d.,]/g, '');
  if (!s) return null;
  // One comma and no dot, with 1-2 digits after it, is a decimal comma ("12,5").
  if (!s.includes('.') && /^\d+,\d{1,2}$/.test(s)) s = s.replace(',', '.');
  else s = s.replace(/,/g, '');
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return n > 0 ? n : null;
}

/** Exchange rate: how much one unit is worth in the home currency (up to 6 decimals). */
export function parseRate(raw: unknown): number | null {
  const s = typeof raw === 'string' ? raw.replace(',', '.').trim() : typeof raw === 'number' ? String(raw) : '';
  if (!/^\d{1,8}(\.\d{1,6})?$/.test(s)) return null;
  const n = Number(s);
  return n > 0 ? n : null;
}

/** "₪1,234" / "₾12.50" — whole numbers without decimals. */
export function formatMoney(amount: number, currency: string): string {
  const rounded = Math.round(amount * 100) / 100;
  const text = rounded.toLocaleString('he-IL', { minimumFractionDigits: Number.isInteger(rounded) ? 0 : 2, maximumFractionDigits: 2 });
  return `${currencySymbol(currency)}${text}`;
}

export type Expense = {
  id: string; title: string; category: string; amount: number; currency: string; rate: number;
  home_amount: number; paid_by: string | null; shared: boolean; spent_on: string;
};

export function totalsByCategory(expenses: Expense[]): { key: string; label: string; icon: string; total: number }[] {
  const sums = new Map<string, number>();
  for (const e of expenses) sums.set(e.category, (sums.get(e.category) ?? 0) + e.home_amount);
  return EXPENSE_CATEGORIES.filter((c) => sums.has(c.key))
    .map((c) => ({ key: c.key, label: c.label, icon: c.icon, total: Math.round((sums.get(c.key) ?? 0) * 100) / 100 }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Who owes whom in a shared trip. Shared expenses are split equally between everyone in the trip;
 * personal ones are only the payer's. Returns the fewest transfers that settle everyone (greedy).
 */
export function settleUp(expenses: Expense[], people: string[]): { from: string; to: string; amount: number }[] {
  if (people.length < 2) return [];
  const bal = new Map(people.map((p) => [p, 0]));
  for (const e of expenses) {
    if (!e.shared || !e.paid_by || !bal.has(e.paid_by)) continue;
    const share = e.home_amount / people.length;
    bal.set(e.paid_by, (bal.get(e.paid_by) ?? 0) + e.home_amount);
    for (const p of people) bal.set(p, (bal.get(p) ?? 0) - share);
  }
  const debtors = [...bal].filter(([, v]) => v < -0.005).map(([p, v]) => ({ p, v: -v })).sort((a, b) => b.v - a.v);
  const creditors = [...bal].filter(([, v]) => v > 0.005).map(([p, v]) => ({ p, v })).sort((a, b) => b.v - a.v);
  const out: { from: string; to: string; amount: number }[] = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i]!, c = creditors[j]!;
    const amt = Math.min(d.v, c.v);
    if (amt >= 0.01) out.push({ from: d.p, to: c.p, amount: Math.round(amt * 100) / 100 });
    d.v -= amt; c.v -= amt;
    if (d.v < 0.005) i++;
    if (c.v < 0.005) j++;
  }
  return out;
}
