'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/** A header link shaped as a pill; the page you are on is highlighted. */
export function NavLink({ href, children, className = '', tour }: { href: string; children: ReactNode; className?: string; tour?: string }) {
  const path = usePathname() ?? '';
  const active = path === href || path.startsWith(`${href}/`);
  return (
    <a href={href} aria-current={active ? 'page' : undefined} data-tour={tour}
      className={`rounded-full px-3.5 py-2 no-underline transition ${active
        ? 'bg-terracotta-tint text-terracotta'
        : 'text-ink hover:bg-sand-2 hover:text-terracotta'} ${className}`}>
      {children}
    </a>
  );
}
