import type { Metadata } from 'next';
import { Alert } from '@/components/ui';
import { getSessionUser } from '@/lib/auth/session';
import { ResetPasswordForm } from './ResetPasswordForm';

export const metadata: Metadata = { title: 'סיסמה חדשה · YallaTrip' };

// Reached from the email link (via /auth/callback, which signs the user in).
export default async function ResetPasswordPage() {
  const { user } = await getSessionUser();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-4xl font-bold">בחירת סיסמה חדשה</h1>
      {user ? (
        <ResetPasswordForm />
      ) : (
        <>
          <Alert>הקישור לא תקין או שפג תוקפו.</Alert>
          <a href="/forgot-password" className="font-bold">לבקש קישור חדש</a>
        </>
      )}
    </div>
  );
}
