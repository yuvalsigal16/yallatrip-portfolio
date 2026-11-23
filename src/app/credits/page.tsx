import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';

export const metadata: Metadata = { title: 'קרדיטים ורישיונות · YallaTrip' };

// What YallaTrip is built with, and the licence each part comes under.
export default function Credits() {
  return (
    <LegalPage title="קרדיטים ורישיונות" updated="[תאריך]">
      <p>YallaTrip נבנה בעזרת השירותים והקוד הפתוח האלה. תודה לכל מי שעומד מאחוריהם.</p>
      <h2>מפות ומידע על מקומות</h2>
      <p>המפה, החיפוש, פרטי המקומות, התמונות שלהם ומסלולי הנסיעה מגיעים מ-Google Maps Platform, בכפוף ל<a href="https://cloud.google.com/maps-platform/terms" target="_blank" rel="noopener noreferrer">תנאי השימוש של Google Maps</a>. שמות הצלמים של תמונות מ-Google מופיעים ליד התמונה.</p>
      <h2>תמונות</h2>
      <p>תמונות הרקע של היעדים מגיעות מ-<a href="https://unsplash.com" target="_blank" rel="noopener noreferrer">Unsplash</a> לפי <a href="https://unsplash.com/license" target="_blank" rel="noopener noreferrer">רישיון Unsplash</a>. תמונות שמשתמשים מעלים שייכות להם.</p>
      <h2>גופן וסמלים</h2>
      <ul className="list-disc pr-5">
        <li>הגופן Heebo, מאת Oded Ezer, ברישיון SIL Open Font License 1.1.</li>
        <li>הסמלים באתר הם אימוג׳י של המכשיר שלך, והלוגו והסמלים האחרים צוירו במיוחד ל-YallaTrip.</li>
      </ul>
      <h2>קוד פתוח</h2>
      <ul className="list-disc pr-5">
        <li>Next.js ו-React, ברישיון MIT.</li>
        <li>ספריות Supabase, ברישיון MIT.</li>
        <li>Tailwind CSS, ברישיון MIT.</li>
        <li>@googlemaps/markerclusterer, ברישיון Apache 2.0.</li>
      </ul>
    </LegalPage>
  );
}
