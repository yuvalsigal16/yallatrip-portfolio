// Small building blocks in the YallaTrip design language (see the Phase 2 design system).
import type { InputHTMLAttributes, ReactNode } from 'react';
import { logoSvg } from '@/lib/brand';

const SMALL_LOGO = logoSvg({ small: true });

/** The logo and the name (Heebo 900). `light`: white name, for a dark background. */
export function Logo({ size = 'md', light = false }: { size?: 'md' | 'lg'; light?: boolean }) {
  const box = size === 'lg' ? 'h-11 w-11' : 'h-9 w-9';
  const text = size === 'lg' ? 'text-3xl' : 'text-2xl';
  return (
    <a href="/" className={`flex items-center gap-2.5 no-underline ${light ? 'text-white' : 'text-ink'}`} aria-label="YallaTrip, לדף הבית">
      {/* The simple logo (src/lib/brand.ts): its own blue rounded square. */}
      <span className={`${box} block shrink-0 [&>svg]:h-full [&>svg]:w-full`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: SMALL_LOGO }} />
      <span className={`font-display font-black ${text}`}>YallaTrip</span>
    </a>
  );
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
  error?: string;
  hint?: string;
};

/** Label + input + error message, wired for screen readers. */
export function Field({ label, name, error, hint, className, ...input }: FieldProps) {
  const id = `f-${name}`;
  const describedBy = [error ? `${id}-err` : null, hint ? `${id}-hint` : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ''}`}>
      <label htmlFor={id} className="text-sm font-bold">{label}</label>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`h-12 rounded-xl border bg-white px-3.5 text-base outline-none transition
          focus:border-terracotta focus:ring-4 focus:ring-terracotta/15
          ${error ? 'border-danger' : 'border-line'}`}
        {...input}
      />
      {hint && !error && <p id={`${id}-hint`} className="text-sm text-muted">{hint}</p>}
      {error && <p id={`${id}-err`} className="text-sm font-semibold text-danger">{error}</p>}
    </div>
  );
}

export function Alert({ kind = 'error', children }: { kind?: 'error' | 'success' | 'info'; children: ReactNode }) {
  const style = {
    error: 'bg-danger-tint text-[#8E3313]',
    success: 'bg-sea-tint text-[#08708F] border border-[#BFE6F3]',
    info: 'bg-white/80 text-ink-2 border border-line',
  }[kind];
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={`rounded-xl px-4 py-3 text-[15px] font-semibold leading-relaxed ${style}`}>
      {children}
    </div>
  );
}

/** "or" separator between the Google button and the email form. */
export function Divider({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-sm font-semibold text-muted">
      <span className="h-px flex-1 bg-line" />
      {children}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

export const buttonStyles = {
  primary: 'bg-gradient-to-l from-[#1B73C9] to-[#2E9BDB] text-white border border-transparent shadow-[0_8px_20px_-8px_rgba(27,115,201,.7)] hover:brightness-110 hover:shadow-[0_12px_26px_-8px_rgba(27,115,201,.75)] active:scale-[.98]',
  secondary: 'bg-white text-ink border border-[#D3E3EF] shadow-[0_1px_2px_rgba(12,45,74,.06)] hover:border-terracotta hover:text-terracotta',
  danger: 'bg-white text-[#B42318] hover:bg-[#FEF3F2] border border-[#F4C7C3]',
  ghost: 'bg-transparent text-ink-2 hover:text-ink border border-transparent',
} as const;

export const buttonBase =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-base font-bold transition disabled:cursor-not-allowed disabled:opacity-60';
