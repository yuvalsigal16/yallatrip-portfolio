import { Logo, buttonBase, buttonStyles } from '@/components/ui';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-5 px-6">
      <Logo />
      <h1 className="font-display text-5xl font-black">הדף לא נמצא</h1>
      <p className="text-lg text-ink-2">אולי הקישור ישן, או שהטיול לא שלך או נמחק.</p>
      <a href="/trips" className={`${buttonBase} ${buttonStyles.primary} w-fit no-underline`}>לטיולים שלי</a>
    </main>
  );
}
