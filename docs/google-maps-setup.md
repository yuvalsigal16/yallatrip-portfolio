# חיבור Google Maps: הגדרה חד-פעמית

המפה, החיפוש והמסלולים באפליקציה כבר כתובים מול Google Maps Platform האמיתי. אין בקוד מפה מדומה. חסרים רק המפתחות שלך.

## מה מחובר לאיזה שירות של Google

| מה באפליקציה | שירות של Google | קובץ |
| --- | --- | --- |
| המפה: זום, גרירה, סמנים, קיבוץ סמנים כשיש הרבה | Maps JavaScript API | `src/components/map/TripMap.tsx`, `src/lib/maps/loader.ts` |
| חיפוש מקום (למשל "Eiffel Tower"), פרטי מקום, "מה יש בסביבה" | Places API (New) | `src/lib/google/places.ts`, `src/app/api/places/*` |
| זמני הליכה ונסיעה בין תחנות, סידור היום | Routes API | `src/lib/google/routes.ts`, `src/app/api/routes/*` |

## שלב 1: פרויקט ב-Google Cloud

1. נכנסים ל-https://console.cloud.google.com עם חשבון Google.
2. בראש הדף לוחצים על בורר הפרויקטים, אחר כך **New Project**. שם: `GoTrip`. לוחצים **Create** ובוחרים את הפרויקט החדש.

## שלב 2: חשבון חיוב (חובה ל-Google Maps)

1. בתפריט ☰ בוחרים **Billing** ומקשרים חשבון חיוב עם כרטיס אשראי. Google נותנת שימוש חינמי חודשי, ובבדיקות אישיות בדרך כלל לא מגיעים לתשלום.
2. מומלץ להגדיר התראה: **Billing ← Budgets & alerts ← Create budget**, למשל 10$ לחודש.

## שלב 3: הפעלת שלושה שירותים

בתפריט ☰ בוחרים **APIs & Services ← Library**. מחפשים כל אחד מהשירותים, נכנסים אליו ולוחצים **Enable**:

1. **Maps JavaScript API**
2. **Places API (New)**. חשוב: לא "Places API" הישן. האפליקציה משתמשת בגרסה החדשה.
3. **Routes API**

## שלב 4: שני מפתחות API

ב-**APIs & Services ← Credentials** לוחצים **Create credentials ← API key** פעמיים. אחרי שכל מפתח נוצר, לוחצים עליו (**Edit API key**), משנים את השם ומגבילים אותו כך:

**מפתח 1: `GoTrip browser`** (לדפדפן, נראה לכל מי שפותח את האתר)
- **Application restrictions:** Websites. מוסיפים:
  - `http://localhost:3000/*`
  - אחרי ההעלאה לאוויר גם `https://הדומיין-שלך/*`
- **API restrictions:** Restrict key. מסמנים רק את **Maps JavaScript API**.

**מפתח 2: `GoTrip server`** (לשרת בלבד, אף פעם לא לדפדפן)
- **Application restrictions:** None. בשרתים כמו Vercel אין כתובת IP קבועה.
- **API restrictions:** Restrict key. מסמנים **Places API (New)** ו-**Routes API**.

לוחצים **Save**. לפעמים לוקח כמה דקות עד שההגבלות נכנסות לתוקף.

## שלב 5: Map ID

הסמנים המעוצבים צריכים Map ID. בתפריט ☰ בוחרים **Google Maps Platform ← Map management ← Create Map ID**:
- שם: `GoTrip`
- Map type: **JavaScript**
- **Vector**

לוחצים **Save** ומעתיקים את ה-Map ID. לבדיקה ראשונה אפשר גם להשתמש ב-`DEMO_MAP_ID`.

## שלב 6: איפה מכניסים את המפתחות

בתיקיית הפרויקט, ליד `package.json`, מעתיקים את `.env.example` לקובץ חדש בשם `.env.local` וממלאים:

```
NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY=המפתח של GoTrip browser
GOOGLE_MAPS_SERVER_KEY=המפתח של GoTrip server
NEXT_PUBLIC_GOOGLE_MAP_ID=ה-Map ID
```

הקובץ `.env.local` לא נכנס ל-Git, כי `.gitignore` מחריג אותו. לא כותבים מפתחות ב-`.env.example` ולא בשום קובץ אחר.

הפרויקט בנוי ב-Next.js, ולכן שם המשתנה של הדפדפן מתחיל ב-`NEXT_PUBLIC_` ולא ב-`VITE_`. מפתח השרת בלי הקידומת הזו, ולכן Next.js לא שולח אותו לדפדפן.

## שלב 7: בדיקה לפני הרצה

```
npm run check:google
```

הבדיקה שולחת ל-Google חיפוש אמיתי של "Eiffel Tower" ובקשת מסלול הליכה בפריז, ומראה ✓ או ✗ לכל שירות, עם הסיבה של Google. תוצאה תקינה נראית כך:

```
✓ Places API (New) (מגדל אייפל · … · 48.858…,2.294… · ChIJ…)
✓ Routes API (… m, …s)
✓ Maps JavaScript API script (…)
```

מה עושים עם ✗:
- **"API has not been used in project … or it is disabled"**: השירות לא הופעל. חוזרים לשלב 3.
- **"API key not valid"**: המפתח הועתק לא נכון.
- **"This API key is not authorized to use this service"**: בהגבלות המפתח לא סומן השירות. חוזרים לשלב 4.
- **"Billing"**: לא קושר חשבון חיוב. חוזרים לשלב 2.

אחר כך מריצים `npm run dev`. אחרי כל שינוי ב-`.env.local` צריך לעצור ולהפעיל מחדש.

## איך זה עובד באפליקציה

- **חיפוש:** בשדה החיפוש שבמפה מקלידים "Eiffel Tower". התוצאות מגיעות מ-Google Places.
- **שמירה:** בוחרים תוצאה, נפתח כרטיס עם השם, הכתובת, השעות והדירוג מ-Google, ולוחצים "שמירה לטיול". הסמן מופיע מיד.
- **מה נשמר:** נשמרים ה-Google Place ID, קו הרוחב, קו האורך והשם. הכתובת והפרטים המתעדכנים (שעות, דירוג) נטענים מ-Google בכל פתיחת כרטיס. כך מתאים לתנאי השימוש של Google, שמתירים לשמור Place ID ולא מתירים לשמור עותק קבוע של הכתובת והפרטים.
- **לחיצה על סמן** או על כל מקום מסומן במפה של Google פותחת את כרטיס המקום.
- **הרבה סמנים:** סמנים קרובים מתקבצים לעיגול עם מספר (MarkerClusterer), כך שגם מאות מקומות לא מאטים את המפה.
- **הודעות שגיאה במקום מסך ריק:**
  - "המפה עוד לא מוגדרת": חסר מפתח.
  - "Google דחה את מפתח המפה": המפתח לא מורשה לשירות או לכתובת האתר.
  - "המפה לא נטענה": אין חיבור.

## בהעלאה לאוויר (Vercel)

1. ב-Vercel נכנסים ל-**Settings ← Environment Variables** ומוסיפים את שלושת המשתנים עם אותם שמות.
2. עושים **Redeploy**.
3. ב-Google Cloud מוסיפים את הדומיין החדש להגבלות של מפתח הדפדפן (שלב 4).
