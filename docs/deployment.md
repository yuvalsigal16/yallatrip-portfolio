# העלאה לאוויר

זמן משוער: כשעתיים, בפעם הראשונה.

## 1. GitHub
1. יוצרים repository פרטי ומעלים אליו את הפרויקט.
2. מריצים `npm install` מקומית ומעלים גם את `package-lock.json`. בקובץ `.github/workflows/ci.yml` אפשר אז להחליף את `npm install` ב-`npm ci`.
3. ב-Actions מוודאים שה-CI ירוק.

## 2. Supabase (סביבת ייצור)
1. פרויקט חדש (מומלץ נפרד מסביבת הפיתוח), באזור קרוב (Frankfurt / eu-central).
2. בסיס הנתונים: ב-SQL Editor מריצים לפי הסדר את כל הקבצים ב-`supabase/migrations/`, ואחריהם את `supabase/seed.sql`. או עם Supabase CLI: `supabase link` ואחריו `supabase db push`.
3. ‏**Authentication → URL Configuration:** ‏Site URL = `https://הדומיין`, ו-Redirect URLs = `https://הדומיין/auth/callback`.
4. ‏**Providers → Google:** לפי `docs/phase-4.md`, עם ה-callback של הפרויקט החדש.
5. ‏**Emails → SMTP:** מחברים ספק מיילים (למשל Resend). בלי זה Supabase שולח רק כמה מיילים בשעה.
6. **המנהל הראשון:** נרשמים באתר, ואז מריצים את שאילתת ה-admin מ-`docs/phase-12-15.md`.
7. ‏**Database → Backups:** לוודא שגיבויים יומיים פעילים (בתוכנית בתשלום יש גם שחזור לנקודת זמן).

## 3. Google Cloud
1. מפתח שרת: Places API (New) ו-Routes API בלבד.
2. מפתח דפדפן: Maps JavaScript API בלבד, מוגבל ל-`https://הדומיין/*`.
3. Map ID אמיתי (Map management), במקום `DEMO_MAP_ID`.
4. ‏**Billing → Budgets & alerts:** התראה, למשל, ב-50$ וב-200$. אפשר גם להגביל מכסה יומית לכל API ב-Quotas.

## 4. Vercel
1. ‏Import Project מ-GitHub.
2. ‏Environment Variables: כל המשתנים מ-`.env.example`, עם הערכים של סביבת הייצור. `NEXT_PUBLIC_SITE_URL` = `https://הדומיין`.
3. ‏Deploy. אחר כך מחברים דומיין ב-Settings → Domains.
4. בדיקת בריאות: `https://הדומיין/api/health` מחזיר `database: true`, `categories: 12`.

## 5. תשלומים (כשמוכנים)
1. מחליטים על ספק: Stripe (אם החברה רשומה במדינה שבה Stripe פועל) או ספק ישראלי. ספק ישראלי = מימוש נוסף של `PaymentProvider` ב-`src/lib/payments/`.
2. Webhook: ‏`https://הדומיין/api/payments/webhook`, עם האירוע `checkout.session.completed`.
3. עסקה בכרטיס בדיקה, ואחר כך עסקה אמיתית קטנה, והחזר.

## 6. ניטור (מומלץ)
- **Sentry** לשגיאות: ‏`npx @sentry/wizard@latest -i nextjs`.
- **Vercel Analytics** לשימוש ולביצועים.
- פעם בשבוע: דוח העלויות ב-Google Cloud, וב-Supabase: Reports.
