import type { ReactNode } from 'react';
import { Logo } from '@/components/ui';

// Shared frame for login, sign-up and password pages.
// Desktop: form on the right, a quiet illustration on the left. Mobile: the form alone.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-skin flex min-h-screen">
      <main className="flex flex-1 flex-col px-5 py-6 sm:px-10 lg:max-w-[620px] lg:px-16">
        <Logo />
        <div className="flex flex-1 items-center">
          <div className="w-full max-w-[440px] rounded-3xl border border-line bg-white p-6 sm:p-8 lg:my-10">{children}</div>
        </div>
      </main>

      <aside aria-hidden="true" className="relative isolate m-3 hidden flex-1 overflow-hidden rounded-[32px] bg-[#0B3D6E] lg:block">
        {/* A real place, softly shaded, with two cards the way they look inside the app */}
        <img src="https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&q=75&w=1400" alt=""
          className="absolute inset-0 -z-20 h-full w-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#051A33]/85 via-[#051A33]/20 to-[#051A33]/10" />

        <div className="absolute top-[14%] right-[10%] w-72 rounded-2xl bg-white p-3 text-ink shadow-[0_30px_60px_-20px_rgba(0,0,0,.55)]">
          <div className="flex items-center gap-3">
            <img src="https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&q=70&w=200&h=200" alt=""
              className="h-14 w-14 rounded-xl object-cover" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-terracotta">יום 1 · פריז</p>
              <p className="truncate font-extrabold">מגדל אייפל ← הלובר</p>
              <p className="text-xs text-muted">4 מקומות · 25 דק׳ הליכה</p>
            </div>
          </div>
        </div>
        <div className="absolute top-[30%] left-[10%] w-56 rounded-2xl border border-white/30 bg-white/15 p-4 text-white shadow-[0_30px_60px_-20px_rgba(0,0,0,.5)] backdrop-blur-xl">
          <p className="text-xs font-bold text-white/80">הטיול הבא בעוד</p>
          <p className="mt-1 text-3xl font-black">12 ימים</p>
        </div>

        <div className="absolute right-14 bottom-14 left-14">
          <p className="font-display text-5xl font-black leading-tight text-white [text-shadow:0_2px_24px_rgba(0,0,0,.35)]">
            מרשימת מקומות
            <br />
            למסלול טיול שלם.
          </p>
          <p className="mt-4 text-[11px] text-white/60">צילום: Unsplash</p>
        </div>
      </aside>
    </div>
  );
}
