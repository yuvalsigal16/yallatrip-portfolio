'use client';

import { useState } from 'react';
import { Divider } from '@/components/ui';
import { GoogleButton } from '../GoogleButton';
import { SignupForm } from './SignupForm';
import { TermsCheckbox } from '../TermsCheckbox';

/**
 * Sign-up: the terms of use and privacy policy are accepted first.
 * Until then, neither "Sign up with Google" nor the email form can be sent.
 */
export function SignupChoices({ next }: { next: string }) {
  const [accepted, setAccepted] = useState(false);
  return (
    <>
      <TermsCheckbox checked={accepted} onChange={setAccepted} />
      <GoogleButton next={next} label="הרשמה עם Google" terms={accepted} disabled={!accepted} />
      <Divider>או עם אימייל</Divider>
      <SignupForm next={next} accepted={accepted} />
    </>
  );
}
