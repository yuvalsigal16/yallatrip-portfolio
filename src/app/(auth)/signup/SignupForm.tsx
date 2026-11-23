'use client';

import { useActionState, useRef, useState } from 'react';
import { Avatar } from '@/components/Avatar';
import { toSquare } from '@/components/AvatarPicker';
import { Alert, Field } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { PASSWORD_MIN, type FormState } from '@/lib/auth/rules';
import { signUp } from '../actions';

export function SignupForm({ next, accepted }: { next: string; accepted: boolean }) {
  const [state, action] = useActionState(signUp, {} as FormState);
  // Optional profile photo: shrunk in the browser, sent with the form, saved once the account exists.
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const choose = async (file: File | undefined) => {
    setPhotoError(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) return setPhotoError('אפשר להעלות רק תמונה');
    if (file.size > 15 * 1024 * 1024) return setPhotoError('התמונה גדולה מדי (עד 15MB)');
    try {
      const blob = await toSquare(file);
      if (photo) URL.revokeObjectURL(photo.url);
      setPhoto({ blob, url: URL.createObjectURL(blob) });
    } catch {
      setPhotoError('לא הצלחנו לקרוא את התמונה. נסו תמונה אחרת.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const submit = (fd: FormData) => {
    if (photo) fd.set('avatar', photo.blob, photo.blob.type === 'image/webp' ? 'avatar.webp' : 'avatar.png');
    action(fd);
  };

  // After sign-up with email confirmation: replace the form with a clear next step.
  if (state.success) {
    return (
      <div className="flex flex-col gap-4">
        <Alert kind="success">{state.success}</Alert>
        <p className="text-sm text-ink-2">לא הגיע מייל תוך כמה דקות? בדקו בתיקיית הספאם, או נסו להירשם שוב.</p>
      </div>
    );
  }

  return (
    <form action={submit} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      {accepted && <input type="hidden" name="terms" value="1" />}
      {state.error && <Alert>{state.error}</Alert>}
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => fileRef.current?.click()}
          className="relative shrink-0 rounded-full" aria-label={photo ? 'החלפת תמונת הפרופיל' : 'הוספת תמונת פרופיל'}>
          {photo ? <Avatar url={photo.url} size={72} /> : (
            <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 border-dashed border-line bg-sand text-ink-2">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7l1.5-3h5L16 7" /><circle cx="12" cy="13.5" r="3.5" />
              </svg>
            </span>
          )}
        </button>
        <div className="flex flex-col items-start gap-0.5">
          <span className="font-bold">תמונת פרופיל <span className="text-sm font-semibold text-muted">(לא חובה)</span></span>
          <div className="flex gap-3 text-sm font-bold">
            <button type="button" onClick={() => fileRef.current?.click()} className="text-terracotta underline">{photo ? 'החלפה' : 'בחירת תמונה'}</button>
            {photo && <button type="button" onClick={() => { URL.revokeObjectURL(photo.url); setPhoto(null); }} className="text-muted underline">הסרה</button>}
          </div>
          {photoError && <span role="alert" className="text-sm font-semibold text-danger">{photoError}</span>}
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="hidden"
          onChange={(e) => choose(e.target.files?.[0])} />
      </div>
      <Field label="שם" name="name" autoComplete="name" required
        defaultValue={state.values?.name} error={state.fieldErrors?.name} />
      <Field label="אימייל" name="email" type="email" autoComplete="email" inputMode="email" dir="ltr" required
        defaultValue={state.values?.email} error={state.fieldErrors?.email} />
      <Field label="סיסמה" name="password" type="password" autoComplete="new-password" dir="ltr" required
        minLength={PASSWORD_MIN} hint={`לפחות ${PASSWORD_MIN} תווים, עם אותיות וספרות`} error={state.fieldErrors?.password} />
      <Field label="אימות סיסמה" name="confirm" type="password" autoComplete="new-password" dir="ltr" required
        error={state.fieldErrors?.confirm} />
      <SubmitButton pendingText="יוצרים חשבון..." disabled={!accepted}>יצירת חשבון</SubmitButton>
      {!accepted && <p className="text-center text-sm text-muted">כדי להירשם, צריך קודם לאשר את תנאי השימוש ומדיניות הפרטיות למעלה.</p>}
    </form>
  );
}
