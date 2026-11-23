// "What to know" per country, for travellers with an Israeli passport. Fixed data written once (no Google, no cost).
// Entry rules change: every card says so and links to a fresh search. Gathered for 2026.

export type CountryInfo = {
  code: string;
  he: string;
  /** Other names and main cities (Hebrew and English) that point to this country. */
  aliases: string[];
  visa: string;
  /** Plug and voltage, in plain words for an Israeli charger. */
  power: string;
  currency: string; // ISO code
  money: string;
  tipping: string;
  emergency: string;
  tz: string; // main IANA zone
  manyZones?: boolean;
  driveLeft?: boolean;
  tips?: string[];
};

const SCHENGEN = 'בלי ויזה, עד 90 יום בכל 180 יום באזור שנגן כולו. בגבולות יש רישום ביומטרי (EES). אישור ETIAS המקוון עוד לא התחיל, ולא צפוי לפני 2027.';
/** When this information (and the flights in extra.ts) was last checked, for every country. */
export const INFO_UPDATED = 'אוקטובר 2026';

const EU_PLUG = 'שקע אירופי (C/F), 230V: תקע ישראלי דו-פיני נכנס, תלת-פיני לא. כדאי מתאם אחד ליתר ביטחון.';
const UK_PLUG = 'שקע בריטי (G, שלושה פינים מלבניים), 230V: צריך מתאם.';
const US_PLUG = 'שקע אמריקאי (A/B), 110–120V: צריך מתאם. מטען של טלפון או מחשב עובד; מייבש שיער או מחליק ישראלי לא.';
const EURO = 'יורו. כרטיס אשראי מתקבל כמעט בכל מקום.';
const EU_TIP = 'לא חובה. בגדול מעגלים למעלה או משאירים 5–10% על שירות טוב.';

export const COUNTRIES: CountryInfo[] = [
  // ---------- South & Central America ----------
  { code: 'AR', he: 'ארגנטינה', aliases: ['argentina', 'בואנוס איירס', 'buenos aires', 'ברילוצ\'ה', 'bariloche', 'אל קלפטה', 'el calafate', 'אל צ\'לטן', 'el chalten', 'אושואיה', 'ushuaia', 'מנדוסה', 'mendoza', 'סלטה', 'salta', 'איגואסו', 'iguazu', 'פטגוניה'],
    visa: 'בלי ויזה, עד 90 יום.', power: 'שקע I (פינים אלכסוניים, כמו באוסטרליה), 220V: צריך מתאם.',
    currency: 'ARS', money: 'פסו ארגנטינאי. השער משתנה מהר: בדקו לפני הנסיעה מה משתלם יותר, כרטיס אשראי או מזומן בדולרים.',
    tipping: 'כ-10% במסעדות, במזומן.', emergency: '911 (משטרה), 107 (אמבולנס)', tz: 'America/Argentina/Buenos_Aires',
    tips: ['בפטגוניה תחנות הדלק רחוקות זו מזו: ממלאים מיכל בכל הזדמנות.', 'מעבר לצ\'ילה ברכב שכור דורש אישור מיוחד מחברת ההשכרה.'] },
  { code: 'CL', he: 'צ\'ילה', aliases: ['chile', 'סנטיאגו', 'santiago', 'פוארטו נטאלס', 'puerto natales', 'טורס דל פיינה', 'torres del paine', 'סן פדרו דה אטקמה', 'atacama', 'קויאיקה', 'coyhaique', 'פוטלפו', 'futaleufu', 'פוקון', 'pucon', 'פוארטו מונט'],
    visa: 'בלי ויזה, עד 90 יום.', power: 'שקע C/L, 220V: תקע ישראלי דו-פיני נכנס.',
    currency: 'CLP', money: 'פסו צ\'יליאני. אשראי מתקבל ברוב המקומות, בכפרים קטנים רק מזומן.',
    tipping: 'כ-10% במסעדות (לרוב מציעים להוסיף בחשבון).', emergency: '133 (משטרה), 131 (אמבולנס)', tz: 'America/Santiago',
    tips: ['במכס מחמירים מאוד על פירות, ירקות, בשר וגבינות: לא מכניסים.'] },
  { code: 'BR', he: 'ברזיל', aliases: ['brazil', 'brasil', 'ריו דה ז\'נרו', 'rio de janeiro', 'סאו פאולו', 'sao paulo', 'פוז דו איגואסו', 'foz do iguacu', 'סלבדור', 'salvador', 'פלוריאנופוליס', 'florianopolis', 'מנאוס', 'manaus'],
    visa: 'בלי ויזה, עד 90 יום.', power: 'שקע N/C, 127V או 220V (משתנה לפי עיר): תקע ישראלי דו-פיני נכנס.',
    currency: 'BRL', money: 'ריאל ברזילאי. אשראי ו-Pix בכל מקום.',
    tipping: 'לרוב 10% שירות כבר בחשבון.', emergency: '190 (משטרה), 192 (אמבולנס)', tz: 'America/Sao_Paulo', manyZones: true,
    tips: ['לאמזונס ולחלק מהאזורים מומלץ חיסון לקדחת צהובה: בדקו במרפאת מטיילים.'] },
  { code: 'PE', he: 'פרו', aliases: ['peru', 'לימה', 'lima', 'קוסקו', 'cusco', 'cuzco', 'מאצ\'ו פיצ\'ו', 'machu picchu', 'ארקיפה', 'arequipa', 'וואקצ\'ינה', 'huacachina'],
    visa: 'בלי ויזה, לשהייה של עד כמה חודשים (נקבע בגבול).', power: 'שקע A/C, 220V: תקע ישראלי דו-פיני נכנס לרוב.',
    currency: 'PEN', money: 'סול פרואני. בשווקים ובכפרים רק מזומן.',
    tipping: 'כ-10% במסעדות.', emergency: '105 (משטרה), 106 (אמבולנס)', tz: 'America/Lima',
    tips: ['קוסקו גבוהה: יום-יומיים של הסתגלות לגובה לפני טרקים.', 'כרטיסים למאצ\'ו פיצ\'ו נגמרים מראש בעונה.'] },
  { code: 'BO', he: 'בוליביה', aliases: ['bolivia', 'לה פאס', 'la paz', 'אויוני', 'uyuni', 'סוקרה', 'sucre', 'רורנבקה', 'rurrenabaque'],
    visa: 'בלי ויזה (מאז דצמבר 2025).', power: 'שקע A/C, 230V: תקע ישראלי דו-פיני נכנס לרוב.',
    currency: 'BOB', money: 'בוליביאנו. בעיקר מזומן.', tipping: 'לא חובה; 5–10% במסעדות תיירותיות.', emergency: '110 (משטרה)', tz: 'America/La_Paz',
    tips: ['גובה רב מאוד (לה פאס, אויוני): להתחיל לאט ולשתות הרבה.'] },
  { code: 'CO', he: 'קולומביה', aliases: ['colombia', 'בוגוטה', 'bogota', 'מדיין', 'medellin', 'קרטחנה', 'cartagena', 'סנטה מרתה', 'santa marta', 'סלנטו', 'salento'],
    visa: 'בלי ויזה, עד 90 יום. ממלאים טופס Check-MIG מקוון עד 72 שעות לפני הטיסה.', power: US_PLUG,
    currency: 'COP', money: 'פסו קולומביאני.', tipping: 'כ-10% מוצע בחשבון ("propina voluntaria").', emergency: '123', tz: 'America/Bogota' },
  { code: 'EC', he: 'אקוודור', aliases: ['ecuador', 'קיטו', 'quito', 'גלפגוס', 'galapagos', 'בניוס', 'banos'],
    visa: 'בלי ויזה, עד 90 יום.', power: US_PLUG, currency: 'USD', money: 'דולר אמריקאי הוא המטבע הרשמי.',
    tipping: 'לרוב 10% שירות בחשבון.', emergency: '911', tz: 'America/Guayaquil' },
  { code: 'MX', he: 'מקסיקו', aliases: ['mexico', 'מקסיקו סיטי', 'mexico city', 'קנקון', 'cancun', 'טולום', 'tulum', 'פלאיה דל כרמן', 'playa del carmen', 'אואחקה', 'oaxaca'],
    visa: 'בלי ויזה; את מספר הימים קובעים בביקורת הגבולות.', power: US_PLUG, currency: 'MXN', money: 'פסו מקסיקני.',
    tipping: '10–15% במסעדות.', emergency: '911', tz: 'America/Mexico_City', manyZones: true },
  { code: 'CR', he: 'קוסטה ריקה', aliases: ['costa rica', 'סן חוסה', 'san jose', 'לה פורטונה', 'la fortuna', 'מונטוורדה', 'monteverde'],
    visa: 'בלי ויזה לשהייה קצרה.', power: US_PLUG, currency: 'CRC', money: 'קולון; דולרים מתקבלים כמעט בכל מקום.',
    tipping: '10% שירות כבר בחשבון לפי חוק.', emergency: '911', tz: 'America/Costa_Rica' },

  // ---------- North America ----------
  { code: 'US', he: 'ארצות הברית', aliases: ['ארה"ב', 'ארה״ב', 'usa', 'united states', 'ניו יורק', 'new york', 'לוס אנג\'לס', 'los angeles', 'מיאמי', 'miami', 'לאס וגאס', 'las vegas', 'סן פרנסיסקו', 'san francisco', 'אורלנדו', 'orlando', 'הוואי', 'hawaii'],
    visa: 'בלי ויזה (תוכנית הפטור): ממלאים ESTA מקוון ובתשלום לפני הטיסה, עד 90 יום.', power: US_PLUG,
    currency: 'USD', money: 'דולר אמריקאי.', tipping: 'מקובל מאוד: 18–20% במסעדות, וגם לנהגים ולמלצרים בבר.', emergency: '911', tz: 'America/New_York', manyZones: true },
  { code: 'CA', he: 'קנדה', aliases: ['canada', 'טורונטו', 'toronto', 'ונקובר', 'vancouver', 'מונטריאול', 'montreal', 'באנף', 'banff'],
    visa: 'בלי ויזה: ממלאים eTA מקוון לפני הטיסה.', power: US_PLUG, currency: 'CAD', money: 'דולר קנדי.',
    tipping: '15–20% במסעדות.', emergency: '911', tz: 'America/Toronto', manyZones: true },

  // ---------- Europe ----------
  { code: 'GR', he: 'יוון', aliases: ['greece', 'אתונה', 'athens', 'סלוניקי', 'thessaloniki', 'כרתים', 'crete', 'רודוס', 'rhodes', 'סנטוריני', 'santorini', 'מיקונוס', 'mykonos', 'קורפו', 'corfu', 'זקינתוס', 'zakynthos', 'נקסוס', 'naxos'],
    visa: SCHENGEN, power: EU_PLUG, currency: 'EUR', money: EURO, tipping: EU_TIP, emergency: '112', tz: 'Europe/Athens' },
  { code: 'CY', he: 'קפריסין', aliases: ['cyprus', 'לרנקה', 'larnaca', 'פאפוס', 'paphos', 'איה נאפה', 'ayia napa', 'לימסול', 'limassol'],
    visa: 'בלי ויזה, עד 90 יום.', power: UK_PLUG, currency: 'EUR', money: EURO, tipping: EU_TIP, emergency: '112', tz: 'Asia/Nicosia', driveLeft: true },
  { code: 'IT', he: 'איטליה', aliases: ['italy', 'רומא', 'rome', 'מילאנו', 'milan', 'ונציה', 'venice', 'פירנצה', 'florence', 'נאפולי', 'naples', 'סיציליה', 'sicily', 'טוסקנה', 'tuscany', 'אגם גארדה', 'garda', 'דולומיטים'],
    visa: SCHENGEN, power: 'שקע L/F/C, 230V: תקע ישראלי דו-פיני נכנס.', currency: 'EUR', money: EURO,
    tipping: 'לרוב יש "קופרטו" בחשבון; טיפ נוסף לא חובה.', emergency: '112', tz: 'Europe/Rome' },
  { code: 'FR', he: 'צרפת', aliases: ['france', 'פריז', 'paris', 'ניס', 'nice', 'ליון', 'lyon', 'מרסיי', 'marseille', 'פרובאנס', 'provence'],
    visa: SCHENGEN, power: EU_PLUG, currency: 'EUR', money: EURO, tipping: 'השירות כלול במחיר; מעגלים למעלה אם נהניתם.', emergency: '112', tz: 'Europe/Paris' },
  { code: 'ES', he: 'ספרד', aliases: ['spain', 'ברצלונה', 'barcelona', 'מדריד', 'madrid', 'סביליה', 'seville', 'מיורקה', 'mallorca', 'איביזה', 'ibiza', 'טנריף', 'tenerife', 'מלגה', 'malaga'],
    visa: SCHENGEN, power: EU_PLUG, currency: 'EUR', money: EURO, tipping: EU_TIP, emergency: '112', tz: 'Europe/Madrid' },
  { code: 'PT', he: 'פורטוגל', aliases: ['portugal', 'ליסבון', 'lisbon', 'פורטו', 'porto', 'מדירה', 'madeira', 'אלגרבה', 'algarve'],
    visa: SCHENGEN, power: EU_PLUG, currency: 'EUR', money: EURO, tipping: EU_TIP, emergency: '112', tz: 'Europe/Lisbon' },
  { code: 'DE', he: 'גרמניה', aliases: ['germany', 'ברלין', 'berlin', 'מינכן', 'munich', 'פרנקפורט', 'frankfurt', 'היער השחור', 'black forest'],
    visa: SCHENGEN, power: EU_PLUG, currency: 'EUR', money: 'יורו. במקומות רבים עדיין מעדיפים מזומן.', tipping: 'מעגלים למעלה, כ-5–10%.', emergency: '112', tz: 'Europe/Berlin' },
  { code: 'NL', he: 'הולנד', aliases: ['netherlands', 'holland', 'אמסטרדם', 'amsterdam', 'רוטרדם', 'rotterdam'],
    visa: SCHENGEN, power: EU_PLUG, currency: 'EUR', money: 'יורו. יש מקומות שמקבלים רק כרטיס.', tipping: EU_TIP, emergency: '112', tz: 'Europe/Amsterdam' },
  { code: 'BE', he: 'בלגיה', aliases: ['belgium', 'בריסל', 'brussels', 'בריז\'', 'bruges', 'אנטוורפן', 'antwerp'],
    visa: SCHENGEN, power: EU_PLUG, currency: 'EUR', money: EURO, tipping: EU_TIP, emergency: '112', tz: 'Europe/Brussels' },
  { code: 'AT', he: 'אוסטריה', aliases: ['austria', 'וינה', 'vienna', 'זלצבורג', 'salzburg', 'אינסברוק', 'innsbruck', 'צל אם זה', 'zell am see'],
    visa: SCHENGEN, power: EU_PLUG, currency: 'EUR', money: EURO, tipping: 'מעגלים למעלה, כ-5–10%.', emergency: '112', tz: 'Europe/Vienna' },
  { code: 'CH', he: 'שווייץ', aliases: ['switzerland', 'ציריך', 'zurich', 'ז\'נבה', 'geneva', 'לוצרן', 'lucerne', 'אינטרלאקן', 'interlaken', 'צרמט', 'zermatt'],
    visa: SCHENGEN, power: 'שקע J (שווייצרי), 230V: תקע ישראלי דו-פיני דק נכנס; תקע עבה לא.', currency: 'CHF', money: 'פרנק שווייצרי (יורו מתקבל לפעמים, בעודף בפרנקים).',
    tipping: 'השירות כלול; מעגלים למעלה.', emergency: '112', tz: 'Europe/Zurich' },
  { code: 'CZ', he: 'צ\'כיה', aliases: ['czech', 'czechia', 'פראג', 'prague'],
    visa: SCHENGEN, power: EU_PLUG, currency: 'CZK', money: 'קורונה צ\'כית. אל תחליפו כסף בצ\'יינג\' ברחוב עם "0% עמלה".', tipping: '10%.', emergency: '112', tz: 'Europe/Prague' },
  { code: 'HU', he: 'הונגריה', aliases: ['hungary', 'בודפשט', 'budapest'],
    visa: SCHENGEN, power: EU_PLUG, currency: 'HUF', money: 'פורינט הונגרי.', tipping: '10–15% (בדקו אם כבר בחשבון).', emergency: '112', tz: 'Europe/Budapest' },
  { code: 'PL', he: 'פולין', aliases: ['poland', 'ורשה', 'warsaw', 'קרקוב', 'krakow'],
    visa: SCHENGEN, power: EU_PLUG, currency: 'PLN', money: 'זלוטי פולני.', tipping: '10%.', emergency: '112', tz: 'Europe/Warsaw' },
  { code: 'RO', he: 'רומניה', aliases: ['romania', 'בוקרשט', 'bucharest', 'טרנסילבניה', 'transylvania', 'ברשוב', 'brasov'],
    visa: SCHENGEN, power: EU_PLUG, currency: 'RON', money: 'לאו רומני.', tipping: '10%.', emergency: '112', tz: 'Europe/Bucharest' },
  { code: 'BG', he: 'בולגריה', aliases: ['bulgaria', 'סופיה', 'sofia', 'בנסקו', 'bansko', 'וארנה', 'varna'],
    visa: SCHENGEN, power: EU_PLUG, currency: 'EUR', money: 'יורו (מ-2026; לפני כן לב בולגרי).', tipping: '10%.', emergency: '112', tz: 'Europe/Sofia' },
  { code: 'HR', he: 'קרואטיה', aliases: ['croatia', 'זאגרב', 'zagreb', 'ספליט', 'split', 'דוברובניק', 'dubrovnik'],
    visa: SCHENGEN, power: EU_PLUG, currency: 'EUR', money: EURO, tipping: EU_TIP, emergency: '112', tz: 'Europe/Zagreb' },
  { code: 'SI', he: 'סלובניה', aliases: ['slovenia', 'ליובליאנה', 'ljubljana', 'בלד', 'bled'],
    visa: SCHENGEN, power: EU_PLUG, currency: 'EUR', money: EURO, tipping: EU_TIP, emergency: '112', tz: 'Europe/Ljubljana' },
  { code: 'ME', he: 'מונטנגרו', aliases: ['montenegro', 'קוטור', 'kotor', 'בודווה', 'budva'],
    visa: 'בלי ויזה, עד 90 יום.', power: EU_PLUG, currency: 'EUR', money: 'יורו.', tipping: EU_TIP, emergency: '112', tz: 'Europe/Podgorica' },
  { code: 'AL', he: 'אלבניה', aliases: ['albania', 'טירנה', 'tirana', 'סרנדה', 'sarande'],
    visa: 'בלי ויזה, עד 90 יום.', power: EU_PLUG, currency: 'ALL', money: 'לק אלבני; בהרבה מקומות רק מזומן.', tipping: 'כ-10%.', emergency: '112', tz: 'Europe/Tirane' },
  { code: 'GB', he: 'בריטניה', aliases: ['אנגליה', 'england', 'uk', 'united kingdom', 'לונדון', 'london', 'סקוטלנד', 'scotland', 'אדינבורו', 'edinburgh', 'מנצ\'סטר', 'manchester'],
    visa: 'בלי ויזה, עד 6 חודשים, אבל צריך אישור ETA מקוון ובתשלום לפני הטיסה.', power: UK_PLUG,
    currency: 'GBP', money: 'לירה שטרלינג. כמעט הכל בכרטיס.', tipping: 'כ-10–12.5% במסעדות (לפעמים כבר בחשבון).', emergency: '999 או 112', tz: 'Europe/London', driveLeft: true },
  { code: 'IE', he: 'אירלנד', aliases: ['ireland', 'דבלין', 'dublin'],
    visa: 'בלי ויזה, עד 90 יום.', power: UK_PLUG, currency: 'EUR', money: EURO, tipping: '10%.', emergency: '112 או 999', tz: 'Europe/Dublin', driveLeft: true },
  { code: 'IS', he: 'איסלנד', aliases: ['iceland', 'רייקיאוויק', 'reykjavik'],
    visa: SCHENGEN, power: EU_PLUG, currency: 'ISK', money: 'קרונה איסלנדית; הכל בכרטיס.', tipping: 'לא נהוג.', emergency: '112', tz: 'Atlantic/Reykjavik' },
  { code: 'NO', he: 'נורווגיה', aliases: ['norway', 'אוסלו', 'oslo', 'טרומסו', 'tromso', 'ברגן', 'bergen', 'לופוטן', 'lofoten'],
    visa: SCHENGEN, power: EU_PLUG, currency: 'NOK', money: 'קרונה נורווגית; הכל בכרטיס.', tipping: 'לא חובה.', emergency: '112', tz: 'Europe/Oslo' },
  { code: 'SE', he: 'שוודיה', aliases: ['sweden', 'שטוקהולם', 'stockholm'], visa: SCHENGEN, power: EU_PLUG, currency: 'SEK', money: 'קרונה שוודית; כמעט רק כרטיס.', tipping: 'לא חובה.', emergency: '112', tz: 'Europe/Stockholm' },
  { code: 'DK', he: 'דנמרק', aliases: ['denmark', 'קופנהגן', 'copenhagen'], visa: SCHENGEN, power: EU_PLUG, currency: 'DKK', money: 'קרונה דנית; כמעט רק כרטיס.', tipping: 'לא חובה.', emergency: '112', tz: 'Europe/Copenhagen' },
  { code: 'TR', he: 'טורקיה', aliases: ['turkey', 'turkiye', 'איסטנבול', 'istanbul', 'אנטליה', 'antalya', 'קפדוקיה', 'cappadocia', 'בודרום', 'bodrum'],
    visa: 'בלי ויזה, עד 90 יום.', power: EU_PLUG, currency: 'TRY', money: 'לירה טורקית.', tipping: '5–10%.', emergency: '112', tz: 'Europe/Istanbul' },
  { code: 'GE', he: 'גאורגיה', aliases: ['georgia', 'טביליסי', 'tbilisi', 'בטומי', 'batumi', 'קזבגי', 'kazbegi', 'סבנטי', 'svaneti', 'מסטיה', 'mestia'],
    visa: 'בלי ויזה, עד שנה.', power: EU_PLUG, currency: 'GEL', money: 'לארי גאורגי.', tipping: 'לרוב 10% שירות בחשבון.', emergency: '112', tz: 'Asia/Tbilisi' },

  // ---------- Middle East & Africa ----------
  { code: 'AE', he: 'איחוד האמירויות', aliases: ['uae', 'emirates', 'דובאי', 'dubai', 'אבו דאבי', 'abu dhabi'],
    visa: 'בלי ויזה מראש: אישור כניסה בשדה, עד 90 יום.', power: UK_PLUG, currency: 'AED', money: 'דירהם.', tipping: '10%.', emergency: '999 (משטרה), 998 (אמבולנס)', tz: 'Asia/Dubai' },
  { code: 'EG', he: 'מצרים', aliases: ['egypt', 'סיני', 'sinai', 'שארם', 'sharm', 'דהב', 'dahab', 'נואייבה', 'nuweiba', 'קהיר', 'cairo'],
    visa: 'לחופי סיני (שארם, דהב, נואייבה) דרך טאבה: אישור סיני חינמי, עד 15 יום. לשאר מצרים צריך ויזה. לפני נסיעה חובה לבדוק אזהרות מסע.', power: EU_PLUG,
    currency: 'EGP', money: 'לירה מצרית; בסיני מקבלים גם דולרים.', tipping: 'טיפ ("בקשיש") נהוג כמעט בכל שירות.', emergency: '122 (משטרה), 123 (אמבולנס)', tz: 'Africa/Cairo' },
  { code: 'JO', he: 'ירדן', aliases: ['jordan', 'עמאן', 'amman', 'פטרה', 'petra', 'עקבה', 'aqaba', 'ואדי רם', 'wadi rum'],
    visa: 'ויזה במעבר הגבול או מראש, לפי המעבר. Jordan Pass כולל כניסה לפטרה. בדקו לפני לפי המעבר שבו תעברו.', power: 'שקעים מעורבים (C/D/F/G), 230V: כדאי מתאם אוניברסלי.',
    currency: 'JOD', money: 'דינר ירדני.', tipping: '10%.', emergency: '911', tz: 'Asia/Amman' },
  { code: 'MA', he: 'מרוקו', aliases: ['morocco', 'מרקש', 'marrakech', 'פס', 'fes', 'קזבלנקה', 'casablanca', 'שפשאואן', 'chefchaouen'],
    visa: 'נדרשת ויזה אלקטרונית (eVisa) מראש.', power: EU_PLUG, currency: 'MAD', money: 'דירהם מרוקאי; בשווקים רק מזומן ומתמקחים.', tipping: '10%.', emergency: '19 (משטרה), 15 (אמבולנס)', tz: 'Africa/Casablanca' },
  { code: 'ZA', he: 'דרום אפריקה', aliases: ['south africa', 'קייפטאון', 'cape town', 'יוהנסבורג', 'johannesburg', 'קרוגר', 'kruger'],
    visa: 'בלי ויזה, עד 90 יום.', power: 'שקע M/N, 230V: צריך מתאם.', currency: 'ZAR', money: 'ראנד.', tipping: '10–15%.', emergency: '10111 (משטרה), 10177 (אמבולנס), 112 מנייד', tz: 'Africa/Johannesburg', driveLeft: true },
  { code: 'TZ', he: 'טנזניה', aliases: ['tanzania', 'זנזיבר', 'zanzibar', 'סרנגטי', 'serengeti', 'קילימנג\'רו', 'kilimanjaro', 'ארושה', 'arusha'],
    visa: 'ויזה מקוונת מראש (או בהגעה).', power: UK_PLUG, currency: 'TZS', money: 'שילינג טנזני; לספארי משלמים בדולרים.', tipping: 'נהוג לתת טיפ למדריכים ולנהגים בספארי.', emergency: '112', tz: 'Africa/Dar_es_Salaam', driveLeft: true,
    tips: ['בדקו במרפאת מטיילים חיסונים ומניעת מלריה.'] },
  { code: 'KE', he: 'קניה', aliases: ['kenya', 'ניירובי', 'nairobi', 'מסאי מארה', 'masai mara'],
    visa: 'ממלאים אישור eTA מקוון לפני הטיסה.', power: UK_PLUG, currency: 'KES', money: 'שילינג קנייתי; M-Pesa נפוץ.', tipping: 'נהוג לתת טיפ למדריכים בספארי.', emergency: '999 או 112', tz: 'Africa/Nairobi', driveLeft: true,
    tips: ['בדקו במרפאת מטיילים חיסונים ומניעת מלריה.'] },

  // ---------- Asia & Oceania ----------
  { code: 'TH', he: 'תאילנד', aliases: ['thailand', 'בנגקוק', 'bangkok', 'צ\'אנג מאי', 'chiang mai', 'פוקט', 'phuket', 'קו סמוי', 'koh samui', 'קו פנגן', 'koh phangan', 'פאי', 'pai', 'קראבי', 'krabi', 'קו טאו', 'koh tao'],
    visa: 'בלי ויזה עד 30 יום (מאז 15.9.2026; אפשר להאריך ב-30 יום). חובה למלא כרטיס כניסה דיגיטלי TDAC בשלושת הימים שלפני ההגעה.', power: 'שקע A/B/C, 220V: תקע ישראלי דו-פיני נכנס לרוב.',
    currency: 'THB', money: 'באט תאילנדי. משיכה מכספומט עולה עמלה קבועה גבוהה: מושכים סכום גדול בפעם אחת.', tipping: 'לא חובה; מעגלים למעלה או 20–50 באט.', emergency: '191 (משטרה), 1669 (אמבולנס), 1155 (משטרת תיירות)', tz: 'Asia/Bangkok', driveLeft: true,
    tips: ['רישיון נהיגה בינלאומי לקטנוע: בלי רישיון מתאים הביטוח לא מכסה.'] },
  { code: 'VN', he: 'וייטנאם', aliases: ['vietnam', 'האנוי', 'hanoi', 'הו צ\'י מין', 'ho chi minh', 'saigon', 'הוי אן', 'hoi an', 'דה נאנג', 'da nang', 'הא גיאנג', 'ha giang', 'סאפה', 'sapa'],
    visa: 'ויזה אלקטרונית (e-Visa) מקוונת לפני הטיסה, עד 90 יום.', power: 'שקע A/C, 220V: תקע ישראלי דו-פיני נכנס לרוב.', currency: 'VND', money: 'דונג; הרבה אפסים, שימו לב בתשלום.', tipping: 'לא חובה.', emergency: '113 (משטרה), 115 (אמבולנס)', tz: 'Asia/Ho_Chi_Minh' },
  { code: 'KH', he: 'קמבודיה', aliases: ['cambodia', 'פנום פן', 'phnom penh', 'סיאם ריפ', 'siem reap', 'אנגקור', 'angkor'],
    visa: 'ויזה בהגעה או e-Visa מקוון מראש.', power: 'שקע A/C, 230V: תקע ישראלי דו-פיני נכנס לרוב.', currency: 'USD', money: 'דולרים בכל מקום, עודף לפעמים בריאל.', tipping: 'לא חובה.', emergency: '117 (משטרה), 119 (אמבולנס)', tz: 'Asia/Phnom_Penh' },
  { code: 'LA', he: 'לאוס', aliases: ['laos', 'לואנג פרבאנג', 'luang prabang', 'ואנג ויינג', 'vang vieng', 'ויינטיאן', 'vientiane'],
    visa: 'ויזה בהגעה או e-Visa מקוון מראש.', power: 'שקע A/C, 230V: תקע ישראלי דו-פיני נכנס לרוב.', currency: 'LAK', money: 'קיפ; בעיקר מזומן.', tipping: 'לא חובה.', emergency: '1191 (משטרה), 1195 (אמבולנס)', tz: 'Asia/Vientiane' },
  { code: 'IN', he: 'הודו', aliases: ['india', 'דלהי', 'delhi', 'מומבאי', 'mumbai', 'גואה', 'goa', 'מנאלי', 'manali', 'דרמסלה', 'dharamshala', 'ריקישיקש', 'rishikesh', 'קסול', 'kasol', 'לדאק', 'ladakh', 'רג\'סטאן', 'rajasthan'],
    visa: 'ויזה אלקטרונית (e-Visa) מקוונת לפני הטיסה.', power: 'שקע C/D/M, 230V: תקע ישראלי דו-פיני נכנס לרוב.', currency: 'INR', money: 'רופי הודי; UPI נפוץ, מזומן תמיד שימושי.', tipping: 'כ-10%.', emergency: '112', tz: 'Asia/Kolkata', driveLeft: true,
    tips: ['שותים רק מים בבקבוק סגור.', 'בתי חב״ד פעילים במקומות של ישראלים (מנאלי, קסול, גואה ועוד).'] },
  { code: 'NP', he: 'נפאל', aliases: ['nepal', 'קטמנדו', 'kathmandu', 'פוקרה', 'pokhara', 'אנפורנה', 'annapurna', 'אוורסט', 'everest'],
    visa: 'ויזה בהגעה לשדה (בתשלום), או מקוונת מראש.', power: 'שקע C/D/M, 230V: תקע ישראלי דו-פיני נכנס לרוב.', currency: 'NPR', money: 'רופי נפאלי; בטרקים רק מזומן.', tipping: 'נהוג לתת טיפ לסבלים ולמדריכים בסוף טרק.', emergency: '100 (משטרה), 1144 (משטרת תיירות)', tz: 'Asia/Kathmandu', driveLeft: true,
    tips: ['לטרקים צריך אישורי כניסה לשמורות: מסדרים בקטמנדו או בפוקרה.', 'בית חב״ד בקטמנדו מפורסם בסדר פסח הגדול.'] },
  { code: 'LK', he: 'סרי לנקה', aliases: ['sri lanka', 'קולומבו', 'colombo', 'קנדי', 'kandy', 'אלה', 'ella', 'מיריסה', 'mirissa'],
    visa: 'צריך אישור ETA מקוון לפני הטיסה. לישראלים הוא בחינם, ל-30 יום.', power: 'שקע D/G, 230V: צריך מתאם.', currency: 'LKR', money: 'רופי סרי לנקי.', tipping: 'לרוב 10% שירות בחשבון.', emergency: '119 (משטרה), 1990 (אמבולנס)', tz: 'Asia/Colombo', driveLeft: true },
  { code: 'PH', he: 'פיליפינים', aliases: ['philippines', 'מנילה', 'manila', 'פלוואן', 'palawan', 'אל נידו', 'el nido', 'סיארגאו', 'siargao', 'בוהול', 'bohol', 'סבו', 'cebu'],
    visa: 'בלי ויזה לשהייה קצרה. ממלאים eTravel מקוון עד 72 שעות לפני הטיסה.', power: 'שקע A/B/C, 220V: תקע ישראלי דו-פיני נכנס לרוב.', currency: 'PHP', money: 'פסו פיליפיני; באיים קטנים רק מזומן.', tipping: 'כ-10% אם אין שירות בחשבון.', emergency: '911', tz: 'Asia/Manila' },
  { code: 'JP', he: 'יפן', aliases: ['japan', 'טוקיו', 'tokyo', 'קיוטו', 'kyoto', 'אוסקה', 'osaka', 'הירושימה', 'hiroshima', 'נארה', 'nara', 'הוקאידו', 'hokkaido'],
    visa: 'בלי ויזה, עד 90 יום. כדאי למלא Visit Japan Web לפני הטיסה, זה מקצר את המעבר בשדה.', power: 'שקע A (שני פינים שטוחים), 100V: צריך מתאם.',
    currency: 'JPY', money: 'ין יפני; עדיין צריך מזומן בהרבה מקומות קטנים.', tipping: 'לא נותנים טיפ, זה אפילו לא מנומס.', emergency: '110 (משטרה), 119 (אמבולנס)', tz: 'Asia/Tokyo', driveLeft: true,
    tips: ['כרטיס Suica או PASMO בטלפון לכל התחבורה הציבורית.'] },
  { code: 'AU', he: 'אוסטרליה', aliases: ['australia', 'סידני', 'sydney', 'מלבורן', 'melbourne', 'בריסביין', 'brisbane', 'פרת\'', 'perth', 'קיירנס', 'cairns'],
    visa: 'נדרשת ויזת תייר מקוונת מראש.', power: 'שקע I, 230V: צריך מתאם.', currency: 'AUD', money: 'דולר אוסטרלי; הכל בכרטיס.', tipping: 'לא נהוג.', emergency: '000', tz: 'Australia/Sydney', manyZones: true, driveLeft: true },
  { code: 'NZ', he: 'ניו זילנד', aliases: ['new zealand', 'אוקלנד', 'auckland', 'קווינסטאון', 'queenstown', 'כרייסטצ\'רץ\'', 'christchurch', 'וולינגטון', 'wellington'],
    visa: 'בלי ויזה: ממלאים NZeTA מקוון לפני הטיסה.', power: 'שקע I, 230V: צריך מתאם.', currency: 'NZD', money: 'דולר ניו זילנדי; הכל בכרטיס.', tipping: 'לא נהוג.', emergency: '111', tz: 'Pacific/Auckland', driveLeft: true },
];

const norm = (s: string) => s.toLowerCase().replace(/[׳']/g, '\'').replace(/[״"]/g, '"').replace(/[,()\-–/]/g, ' ').replace(/\s+/g, ' ').trim();

/** The countries a trip goes to, from its destination names (countries or cities), in order, without repeats. */
export function countriesFor(names: string[]): CountryInfo[] {
  const out: CountryInfo[] = [];
  for (const raw of names) {
    const n = norm(raw);
    if (!n) continue;
    const hit = COUNTRIES.find((c) => [c.he, ...c.aliases].some((a) => {
      const x = norm(a);
      // Whole words only ("usa" must not match "busan").
      return x.length >= 3 && (n === x || ` ${n} `.includes(` ${x} `));
    }));
    if (hit && !out.includes(hit)) out.push(hit);
  }
  return out;
}

/** Hours ahead of (+) or behind (−) Israel right now in a time zone ("+5", "−6", "0"). */
export function hoursFromIsrael(tz: string, at = new Date()): number | null {
  const offset = (zone: string) => {
    try {
      const part = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' })
        .formatToParts(at).find((p) => p.type === 'timeZoneName')?.value ?? '';
      const m = /GMT([+-]\d{1,2})(?::(\d{2}))?/.exec(part);
      if (!m) return part === 'GMT' ? 0 : null;
      const h = Number(m[1]);
      return h + Math.sign(h || 1) * (Number(m[2] ?? 0) / 60);
    } catch {
      return null;
    }
  };
  const here = offset('Asia/Jerusalem');
  const there = offset(tz);
  return here === null || there === null ? null : there - here;
}
