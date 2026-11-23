import { initialsOf } from '@/lib/avatar';

/** A round profile photo, or the person's initials when there is none. */
export function Avatar({ url, name, size = 40, className = '' }: { url?: string | null; name?: string | null; size?: number; className?: string }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.36) };
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" width={size} height={size} style={style}
      className={`shrink-0 rounded-full object-cover ring-2 ring-white ${className}`} referrerPolicy="no-referrer" />
  ) : (
    <span style={style} aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-sea font-bold text-white ${className}`}>
      {initialsOf(name)}
    </span>
  );
}
