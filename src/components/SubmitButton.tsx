'use client';

import { useFormStatus } from 'react-dom';
import type { ReactNode } from 'react';
import { buttonBase, buttonStyles } from '@/components/ui';

type Props = {
  children: ReactNode;
  pendingText?: string;
  variant?: keyof typeof buttonStyles;
  full?: boolean;
  name?: string;
  value?: string;
  disabled?: boolean;
};

/** A submit button that disables itself and says "..." while the form is sending. */
export function SubmitButton({ children, pendingText = 'רגע...', variant = 'primary', full = true, name, value, disabled = false }: Props) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending || disabled}
      aria-busy={pending}
      className={`${buttonBase} ${buttonStyles[variant]} ${full ? 'w-full' : ''}`}
    >
      {pending ? pendingText : children}
    </button>
  );
}
