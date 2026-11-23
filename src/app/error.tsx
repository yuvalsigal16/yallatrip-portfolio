'use client';

import { useEffect } from 'react';
import { buttonBase, buttonStyles } from '@/components/ui';

// Shown when a page crashes. The technical details go to the server log / Sentry, not to the user.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col justify-center gap-5 px-6">
      <h1 className="font-display text-4xl font-black">משהו השתבש</h1>
      <p className="text-lg text-ink-2">זה לא אמור לקרות. אפשר לנסות שוב, ואם זה חוזר, לרענן את הדף.</p>
      {error.digest && <p className="text-xs text-muted" dir="ltr">קוד תקלה: {error.digest}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={reset} className={`${buttonBase} ${buttonStyles.primary}`}>לנסות שוב</button>
        <a href="/trips" className={`${buttonBase} ${buttonStyles.secondary} no-underline`}>לטיולים שלי</a>
      </div>
    </main>
  );
}
