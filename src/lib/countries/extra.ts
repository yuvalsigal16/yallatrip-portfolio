// More of "what to know" per country: flights from Israel, health and vaccines, phone and internet.
// Fixed data written once (no Google, no cost), gathered for 2026. Flights from Ben Gurion change often
// (airlines stop and return), so every card says to check, and gives the usual flight time.

export type CountryExtra = {
  /** Flights from Ben Gurion: direct or with a stop, and roughly how long. */
  flight: string;
  /** Vaccines and health, in plain words. */
  health: string;
  /** Phone and internet: eSIM, a local SIM, or roaming from Israel. */
  esim: string;
};

// ---------- shared wording ----------
const CLINIC = 'מומלץ לקבוע תור במרפאת מטיילים 4–6 שבועות לפני הטיסה.';
const HEALTH_EU = 'אין חיסונים מיוחדים מעבר לחיסוני השגרה. מי המים בברז בדרך כלל ראויים לשתייה. ביטוח בריאות לחו״ל חובה (אין כאן כיסוי של קופת החולים).';
const HEALTH_US = 'אין חיסונים מיוחדים. רפואה יקרה מאוד: ביטוח נסיעות עם כיסוי רפואי גבוה הוא חובה.';
const HEALTH_LATAM = `חיסונים מומלצים: צהבת A, טיפוס הבטן, ולטיול ארוך גם כלבת. שותים רק מים בבקבוק. יש דנגי: דוחה יתושים. ${CLINIC}`;
const HEALTH_SEA = `חיסונים מומלצים: צהבת A, טיפוס הבטן, ולטיול ארוך או כפרי גם כלבת ודלקת מוח יפנית. שותים רק מים בבקבוק. יש דנגי: דוחה יתושים. ${CLINIC}`;
const HEALTH_AFRICA = `חיסונים מומלצים: צהבת A, טיפוס הבטן, ולרוב גם קדחת צהובה (לפעמים דורשים תעודה בכניסה). באזורים רבים יש מלריה: לשאול על כדורים מונעים. ${CLINIC}`;

const ESIM_EU = 'רוב חבילות הגלישה של החברות הישראליות כוללות את אירופה. אפשר גם eSIM לאירופה כולה (אפליקציות כמו Airalo או Holafly): מתקינים לפני הטיסה ומדליקים בנחיתה.';
const ESIM_GENERIC = 'eSIM שמתקינים לפני הטיסה (אפליקציות כמו Airalo או Holafly) הוא הכי פשוט. סים מקומי בשדה התעופה זול יותר לשהייה ארוכה (צריך דרכון). חבילות חו״ל של החברות הישראליות נוחות אבל יקרות יותר.';
const ESIM_LATAM = 'לטיול ארוך משתלם סים מקומי (צריך דרכון; קונים בחנות של החברה, לא ברחוב). לשבוע-שבועיים eSIM לכל דרום אמריקה נוח יותר. בטרקים ובפארקים אין קליטה: מורידים מפות לשימוש בלי אינטרנט.';

const EU_DIRECT = (h: string) => `יש בדרך כלל טיסות ישירות מנתב״ג, כ-${h} שעות.`;
const VIA = (h: string, via: string) => `אין טיסה ישירה קבועה. טסים עם עצירה (${via}), כ-${h} שעות בסך הכול.`;
const VIA_LATAM = (h: string) => VIA(h, 'לרוב באירופה או בארה״ב, ומשם');

export const EXTRA: Record<string, CountryExtra> = {
  // ---------- South & Central America ----------
  AR: { flight: VIA_LATAM('20–24'), health: `${HEALTH_LATAM} לאזור איגואסו מומלץ גם חיסון לקדחת צהובה.`, esim: ESIM_LATAM },
  CL: { flight: VIA_LATAM('20–24'), health: 'חיסונים מומלצים: צהבת A וטיפוס הבטן. ברוב צ׳ילה המים בברז ראויים לשתייה. בצפון (אטקמה) יש גובה רב: לעלות לאט.', esim: ESIM_LATAM },
  BR: { flight: VIA_LATAM('17–22'), health: `${HEALTH_LATAM} קדחת צהובה מומלצת לאמזונס, לאיגואסו ולאזורים כפריים רבים.`, esim: ESIM_LATAM },
  PE: { flight: VIA_LATAM('18–22'), health: `${HEALTH_LATAM} לאמזונס: קדחת צהובה, ושאלה על כדורים נגד מלריה. בקוסקו ובאגם טיטיקקה מחלת גבהים: יום-יומיים הסתגלות.`, esim: ESIM_LATAM },
  BO: { flight: VIA_LATAM('20–26'), health: `${HEALTH_LATAM} לאזור האמזונס (רורנבקה) נדרשת לעיתים תעודת חיסון לקדחת צהובה. לה פאס ואויוני גבוהות מאוד: מחלת גבהים.`, esim: ESIM_LATAM },
  CO: { flight: VIA_LATAM('15–20'), health: `${HEALTH_LATAM} קדחת צהובה מומלצת לאזורי ג׳ונגל ולפארק טיירונה.`, esim: ESIM_LATAM },
  EC: { flight: VIA_LATAM('17–22'), health: `${HEALTH_LATAM} לאמזונס: קדחת צהובה ושאלה על מלריה. קיטו גבוהה.`, esim: ESIM_LATAM },
  MX: { flight: VIA('15–18', 'לרוב בארה״ב או באירופה'), health: HEALTH_LATAM, esim: 'eSIM לפני הטיסה, או סים מקומי (Telcel) בכל חנות נוחות. חבילות לארה״ב-קנדה-מקסיקו של חברות ישראליות כוללות לפעמים את מקסיקו.' },
  CR: { flight: VIA('17–20', 'לרוב בארה״ב או באירופה'), health: `${HEALTH_LATAM} מי שמגיע ממדינה עם קדחת צהובה (למשל קולומביה) צריך תעודת חיסון.`, esim: ESIM_LATAM },

  // ---------- North America ----------
  US: { flight: 'יש טיסות ישירות מנתב״ג לניו יורק ולכמה ערים נוספות (כ-12 שעות לניו יורק, כ-15 לחוף המערבי).', health: HEALTH_US, esim: 'eSIM לארה״ב לפני הטיסה, או סים מקומי מראש (T-Mobile, AT&T). רוב החברות הישראליות מציעות חבילה לארה״ב.' },
  CA: { flight: 'בחלק מהתקופות יש טיסה ישירה לטורונטו (כ-12 שעות); אחרת עם עצירה בארה״ב או באירופה. בדקו לפני.', health: HEALTH_US, esim: 'eSIM לקנדה (או לארה״ב-קנדה יחד) לפני הטיסה. סים מקומי בקנדה יקר יחסית.' },

  // ---------- Europe ----------
  GR: { flight: EU_DIRECT('2'), health: HEALTH_EU, esim: ESIM_EU },
  CY: { flight: EU_DIRECT('1'), health: HEALTH_EU, esim: ESIM_EU },
  IT: { flight: EU_DIRECT('3–4'), health: HEALTH_EU, esim: ESIM_EU },
  FR: { flight: EU_DIRECT('4.5–5'), health: HEALTH_EU, esim: ESIM_EU },
  ES: { flight: EU_DIRECT('5'), health: HEALTH_EU, esim: ESIM_EU },
  PT: { flight: EU_DIRECT('5.5–6'), health: HEALTH_EU, esim: ESIM_EU },
  DE: { flight: EU_DIRECT('4–4.5'), health: HEALTH_EU, esim: ESIM_EU },
  NL: { flight: EU_DIRECT('5'), health: HEALTH_EU, esim: ESIM_EU },
  BE: { flight: EU_DIRECT('4.5–5'), health: HEALTH_EU, esim: ESIM_EU },
  AT: { flight: EU_DIRECT('3.5–4'), health: HEALTH_EU, esim: ESIM_EU },
  CH: { flight: EU_DIRECT('4–4.5'), health: `${HEALTH_EU} שווייץ לא באיחוד האירופי: בדקו שחבילת הגלישה כוללת אותה.`, esim: `${ESIM_EU} שימו לב: שווייץ לא תמיד כלולה בחבילת "אירופה".` },
  CZ: { flight: EU_DIRECT('3.5–4'), health: HEALTH_EU, esim: ESIM_EU },
  HU: { flight: EU_DIRECT('3–3.5'), health: HEALTH_EU, esim: ESIM_EU },
  PL: { flight: EU_DIRECT('3.5–4'), health: HEALTH_EU, esim: ESIM_EU },
  RO: { flight: EU_DIRECT('2.5–3'), health: HEALTH_EU, esim: ESIM_EU },
  BG: { flight: EU_DIRECT('2.5'), health: HEALTH_EU, esim: ESIM_EU },
  HR: { flight: EU_DIRECT('3'), health: HEALTH_EU, esim: ESIM_EU },
  SI: { flight: 'לפעמים יש טיסות ישירות ללובליאנה; לרוב טסים לווינה, לונציה או לזאגרב וממשיכים ביבשה (כ-3 שעות טיסה).', health: HEALTH_EU, esim: ESIM_EU },
  ME: { flight: 'בעונת הקיץ יש לרוב טיסות ישירות (טיבאט/פודגוריצה, כ-3 שעות); בשאר השנה עם עצירה.', health: HEALTH_EU, esim: 'מונטנגרו לא באיחוד האירופי: חבילת "אירופה" לא תמיד כוללת אותה. eSIM מקומי או סים בשדה התעופה זולים.' },
  AL: { flight: 'בעונה יש לרוב טיסות ישירות לטירנה (כ-3 שעות); בשאר השנה עם עצירה.', health: HEALTH_EU, esim: 'אלבניה לא באיחוד האירופי: חבילת "אירופה" לא תמיד כוללת אותה. סים מקומי (Vodafone, One) זול מאוד.' },
  GB: { flight: EU_DIRECT('5.5'), health: HEALTH_EU, esim: `${ESIM_EU} בדקו שבריטניה כלולה (היא כבר לא באיחוד).` },
  IE: { flight: VIA('6–8', 'לרוב בלונדון או באירופה'), health: HEALTH_EU, esim: ESIM_EU },
  IS: { flight: VIA('8–10', 'לרוב באירופה'), health: HEALTH_EU, esim: `${ESIM_EU} מחוץ לכבישים הראשיים הקליטה חלשה.` },
  NO: { flight: 'בחלק מהעונות יש טיסה ישירה לאוסלו; אחרת עם עצירה באירופה (כ-5 שעות טיסה).', health: HEALTH_EU, esim: `${ESIM_EU} נורווגיה בדרך כלל כלולה (EEA).` },
  SE: { flight: 'בחלק מהעונות יש טיסה ישירה לשטוקהולם; אחרת עם עצירה באירופה (כ-5 שעות טיסה).', health: HEALTH_EU, esim: ESIM_EU },
  DK: { flight: 'בחלק מהעונות יש טיסה ישירה לקופנהגן; אחרת עם עצירה באירופה (כ-5 שעות טיסה).', health: HEALTH_EU, esim: ESIM_EU },

  // ---------- Middle East & nearby ----------
  TR: { flight: 'הטיסות הישירות של חברות טורקיות לישראל הופסקו בשנים האחרונות. בדקו מה המצב עכשיו; אחרת עם עצירה (כ-2 שעות טיסה).', health: HEALTH_EU, esim: 'eSIM לטורקיה לפני הטיסה. סים מקומי צריך רישום של הטלפון אם נשארים זמן רב.' },
  GE: { flight: EU_DIRECT('2.5–3'), health: 'אין חיסונים מיוחדים מעבר לחיסוני השגרה. מחוץ לטביליסי עדיף מים בבקבוק.', esim: 'סים מקומי (Magti, Silknet) זול ומהיר, קונים בשדה התעופה או בעיר. אפשר גם eSIM.' },
  AE: { flight: 'יש טיסות ישירות לאבו דאבי (כ-3 שעות). הטיסות הישירות לדובאי מושעות כרגע: בדקו לפני.', health: 'אין חיסונים מיוחדים. חם מאוד בקיץ: שותים הרבה. ביטוח בריאות חובה.', esim: 'eSIM לאמירויות לפני הטיסה, או סים תיירים חינמי/זול בשדה (du, Etisalat). שיחות וואטסאפ קוליות חסומות לרוב.' },
  EG: { flight: 'לסיני מגיעים לרוב ביבשה דרך מעבר טאבה. טיסות ישירות לקהיר יש רק לעיתים. בדקו לפני ובדקו אזהרות מסע.', health: 'חיסונים מומלצים: צהבת A וטיפוס הבטן. שותים רק מים בבקבוק.', esim: 'סים מקומי (Vodafone, Orange) זול. ליד הגבול הטלפון עלול להתחבר לרשת ישראלית ולהפך: שימו לב לנדידה.' },
  JO: { flight: 'מגיעים לרוב ביבשה (מעבר נהר הירדן/בית שאן או מעבר ערבה ליד אילת). יש גם טיסות קצרות לעמאן.', health: 'אין חיסונים מיוחדים מעבר לחיסוני השגרה. במדבר (פטרה, ואדי רם) שותים הרבה.', esim: 'סים מקומי (Zain, Orange) זול. ליד הגבול הטלפון עלול להתחבר לרשת ישראלית ולהפך.' },
  MA: { flight: 'היו טיסות ישירות למרקש ולקזבלנקה (כ-5 שעות), והן הופסקו בתקופות שונות. בדקו לפני; אחרת עם עצירה באירופה.', health: 'חיסונים מומלצים: צהבת A וטיפוס הבטן. שותים רק מים בבקבוק.', esim: 'סים מקומי (Maroc Telecom, Orange, inwi) זול ומהיר, קונים בשדה התעופה.' },

  // ---------- Africa ----------
  ZA: { flight: 'בחלק מהתקופות יש טיסה ישירה ליוהנסבורג (כ-10 שעות); אחרת עם עצירה (אדיס אבבה, דובאי או אירופה).', health: `אין חובת חיסונים מיוחדת. לפארק קרוגר ולצפון-מזרח: לשאול על כדורים נגד מלריה. ${CLINIC}`, esim: 'סים מקומי (Vodacom, MTN) בשדה התעופה, צריך דרכון וכתובת. אפשר גם eSIM.' },
  TZ: { flight: VIA('9–12', 'לרוב באדיס אבבה, בדובאי או בנירובי'), health: HEALTH_AFRICA, esim: 'סים מקומי (Vodacom, Airtel) בשדה התעופה, צריך דרכון. בספארי הקליטה משתנה.' },
  KE: { flight: VIA('7–10', 'לרוב באדיס אבבה או בדובאי'), health: HEALTH_AFRICA, esim: 'סים מקומי (Safaricom) בשדה התעופה, צריך דרכון. M-Pesa לתשלום בטלפון.' },

  // ---------- Asia ----------
  TH: { flight: 'יש טיסות ישירות לבנגקוק (כ-11 שעות).', health: HEALTH_SEA, esim: 'סים תיירים (AIS, TrueMove, dtac) בשדה התעופה, עם הרבה גלישה ב-10 עד 30 יום. אפשר גם eSIM לפני הטיסה.' },
  VN: { flight: 'יש טיסה ישירה להאנוי (כ-11 שעות); לשאר הערים עם עצירה.', health: HEALTH_SEA, esim: 'סים מקומי (Viettel) זול מאוד בשדה התעופה, צריך דרכון. אפשר גם eSIM.' },
  KH: { flight: VIA('14–18', 'לרוב בבנגקוק או בדובאי'), health: `${HEALTH_SEA} באזורי ג׳ונגל ובגבולות: לשאול על מלריה.`, esim: 'סים מקומי (Smart, Cellcard) זול, קונים בשדה או בגבול.' },
  LA: { flight: VIA('15–20', 'לרוב בבנגקוק'), health: `${HEALTH_SEA} באזורים כפריים: לשאול על מלריה.`, esim: 'סים מקומי (Unitel, Lao Telecom) זול. בצפון ובכפרים הקליטה חלשה.' },
  IN: { flight: 'יש טיסה ישירה לדלהי (כ-6–7 שעות). למומבאי ולשאר הערים עם עצירה, לרוב באבו דאבי.', health: `${HEALTH_SEA} שותים רק מים בבקבוק ונזהרים במזון רחוב. בחלק מהאזורים: לשאול על מלריה. בהימלאיה: מחלת גבהים.`, esim: 'סים מקומי דורש תמונה, דרכון וויזה, ולוקח יום-יומיים להפעלה. eSIM לפני הטיסה פשוט יותר.' },
  NP: { flight: VIA('9–12', 'לרוב בדלהי, בדובאי או באיסטנבול'), health: `${HEALTH_SEA} בטרקים (אוורסט, אנאפורנה): מחלת גבהים, עולים לאט. ביטוח שמכסה חילוץ במסוק בגובה רב.`, esim: 'סים מקומי (Ncell, NTC) בשדה התעופה, צריך דרכון ותמונה. בטרקים יש קליטה בחלק מהדרך, ובכפרים Wi-Fi בתשלום.' },
  LK: { flight: VIA('9–12', 'לרוב בדובאי, באבו דאבי או בהודו'), health: HEALTH_SEA, esim: 'סים תיירים (Dialog, Mobitel) בשדה התעופה, זול ומהיר.' },
  PH: { flight: VIA('14–18', 'לרוב בבנגקוק, בדובאי או בהונג קונג'), health: HEALTH_SEA, esim: 'סים מקומי (Globe, Smart) צריך רישום עם דרכון. eSIM לפני הטיסה פשוט יותר.' },
  JP: { flight: 'בחלק מהתקופות יש טיסה ישירה לטוקיו (כ-12–13 שעות); אחרת עם עצירה.', health: 'אין חיסונים מיוחדים. מים בברז ראויים לשתייה. חלק מהתרופות הנפוצות (למשל עם פסאודואפדרין) אסורות בכניסה: בדקו לפני.', esim: 'eSIM ליפן לפני הטיסה הוא הכי נוח. אפשר גם להשכיר ראוטר נייד (Pocket Wi-Fi) בשדה התעופה.' },

  // ---------- Oceania ----------
  AU: { flight: VIA('20–26', 'לרוב בדובאי, בסינגפור או בבנגקוק'), health: 'אין חיסונים מיוחדים. שמש חזקה מאוד: קרם הגנה וכובע. ביטוח נסיעות עם כיסוי רפואי.', esim: 'סים מקומי (Telstra לכיסוי הכי רחב מחוץ לערים, Optus, Vodafone) בשדה התעופה. אפשר גם eSIM.' },
  NZ: { flight: VIA('22–28', 'לרוב בדובאי, בסינגפור או באוסטרליה'), health: 'אין חיסונים מיוחדים. שמש חזקה מאוד: קרם הגנה. ביטוח נסיעות עם כיסוי רפואי.', esim: 'סים מקומי (One NZ, Spark) בשדה התעופה. בדרכים ובפארקים הקליטה משתנה.' },
};
