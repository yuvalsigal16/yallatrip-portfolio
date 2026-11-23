import type { Metadata } from 'next';
import { Alert, Divider } from '@/components/ui';
import { callbackErrorMessage } from '@/lib/auth/errors';
import { safeNextPath } from '@/lib/auth/rules';
import { GoogleButton } from '../GoogleButton';
import { LoginForm } from './LoginForm';
import { ClearOfflineData } from '@/components/pwa/Pwa';

export const metadata: Metadata = { title: 'התחברות · YallaTrip' };

type Search = Promise<{ next?: string; error?: string; deleted?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const next = safeNextPath(sp.next);
  const linkError = callbackErrorMessage(sp.error ?? null);

  return (
    <div className="flex flex-col gap-6">
      <ClearOfflineData />
      <div>
        <h1 className="font-display text-4xl font-bold">שמחים לראות אותך</h1>
        <p className="mt-2 text-ink-2">התחברו כדי להמשיך לתכנן.</p>
      </div>
      {linkError && <Alert>{linkError}</Alert>}
      <GoogleButton next={next} label="התחברות עם Google" />
      <Divider>או עם אימייל</Divider>
      <LoginForm next={next} />
      <p className="text-center text-ink-2">
        עוד אין לך חשבון?{' '}
        <a href={`/signup${sp.next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-bold">
          להרשמה
        </a>
      </p>
    </div>
  );
}
