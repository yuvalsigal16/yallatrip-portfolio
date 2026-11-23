import { signInWithGoogle } from './actions';
import { SubmitButton } from '@/components/SubmitButton';

// Sign in / sign up with Google. Opens Google's own account chooser.
// For the official "Sign in with Google" look, replace the label with Google's
// branded button asset (developers.google.com/identity/branding-guidelines).
// `terms`: the person has just accepted the terms of use and privacy policy (sign-up page).
export function GoogleButton({ next, label, terms = false, disabled = false }: {
  next: string; label: string; terms?: boolean; disabled?: boolean;
}) {
  return (
    <form action={signInWithGoogle}>
      <input type="hidden" name="next" value={next} />
      {terms && <input type="hidden" name="terms" value="1" />}
      <SubmitButton variant="secondary" pendingText="מעבירים ל-Google..." disabled={disabled}>
        {label}
      </SubmitButton>
    </form>
  );
}
