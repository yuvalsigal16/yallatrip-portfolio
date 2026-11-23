import type { Metadata } from 'next';
import { Logo, Alert, buttonBase, buttonStyles } from '@/components/ui';
import { requireOnboardedUser } from '@/lib/auth/session';
import { joinByLink } from '@/app/trips/members-actions';
import { SubmitButton } from '@/components/SubmitButton';

export const metadata: Metadata = { title: 'הזמנה לטיול · YallaTrip', robots: { index: false, follow: false } };

/** Where an invite link leads: says whose trip it is and lets the signed-in person join it. */
export default async function JoinPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params;
  const sp = await searchParams;
  const { supabase } = await requireOnboardedUser(`/join/${token}`);
  const valid = /^[0-9a-f]{36}$/.test(token);
  const { data } = valid ? await supabase.rpc('peek_trip_invite_link', { p_token: token }) : { data: null };
  const info = (Array.isArray(data) ? data[0] : null) as { trip_id: string; title: string; owner_name: string | null } | null;

  return (
    <div className="app-skin mx-auto flex min-h-screen max-w-[520px] flex-col gap-6 px-5 py-6">
      <Logo />
      <div className="rounded-2xl border border-line bg-white p-6">
        {info ? (
          <>
            <h1 className="text-2xl font-black">הזמנה לטיול</h1>
            <p className="mt-2 text-lg">{info.owner_name ?? 'מישהו'} מזמין/ה אותך לתכנן יחד את הטיול <b>{info.title}</b>.</p>
            <p className="mt-1 text-ink-2">אחרי ההצטרפות תוכלו שניכם לערוך את הטיול, והשינויים יופיעו אצל כולם.</p>
            {sp.error === 'full' && <div className="mt-3"><Alert>בטיול הזה כבר יש 10 אנשים, ואי אפשר להצטרף.</Alert></div>}
            <form action={joinByLink} className="mt-4 flex flex-col gap-2">
              <input type="hidden" name="token" value={token} />
              <SubmitButton pendingText="מצטרפים…">הצטרפות לטיול</SubmitButton>
              <a href="/trips" className={`${buttonBase} ${buttonStyles.secondary} no-underline`}>לא עכשיו</a>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-black">הקישור כבר לא בתוקף</h1>
            <p className="mt-2 text-ink-2">אולי עברו 14 יום, או שנוצר קישור חדש במקומו. בקשו ממי שהזמין אתכם קישור חדש.</p>
            <a href="/trips" className={`${buttonBase} ${buttonStyles.primary} mt-4 no-underline`}>לטיולים שלי</a>
          </>
        )}
      </div>
    </div>
  );
}
