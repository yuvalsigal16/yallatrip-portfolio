import type { ReactNode } from 'react';
import { Logo } from '@/components/ui';

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-[760px] px-5 py-8 sm:px-8">
      <Logo />
      <h1 className="mt-8 font-display text-4xl font-black">{title}</h1>
      <p className="mt-2 text-sm text-muted">עודכן לאחרונה: {updated}</p>
      <p className="mt-4 rounded-xl bg-[#FFF4E5] p-3 text-sm font-semibold text-[#8A4B00]">
        טיוטה לפני בדיקה משפטית. יש להשלים את החלקים המסומנים [ ] ולאשר מול עורך/ת דין לפני השקה.
      </p>
      <div className="prose-rtl mt-6 flex flex-col gap-4 leading-relaxed [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-extrabold">{children}</div>
    </main>
  );
}
