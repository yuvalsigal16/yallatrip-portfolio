import type { Metadata } from 'next';
import { Logo } from '@/components/ui';
import { SavedTrips } from './SavedTrips';

export const metadata: Metadata = { title: 'אין חיבור · YallaTrip', robots: { index: false, follow: false } };

/** Shown by the app when there is no internet and the page asked for was not kept on the phone. */
export default function OfflinePage() {
  return (
    <div className="app-skin mx-auto flex min-h-screen max-w-[560px] flex-col gap-6 px-5 py-6">
      <Logo />
      <div className="rounded-2xl border border-line bg-white p-6">
        <h1 className="text-2xl font-black">אין חיבור לאינטרנט</h1>
        <p className="mt-2 text-ink-2">העמוד הזה לא שמור בטלפון. את התוכנית של טיולים שפתחת לאחרונה אפשר לפתוח גם עכשיו:</p>
        <SavedTrips />
      </div>
    </div>
  );
}
