import { publicEnv } from '@/lib/env';

/** Where a user's uploaded profile photos live (public URLs, one folder per user). */
export function avatarFolderUrl(userId: string): string {
  return `${publicEnv().supabaseUrl}/storage/v1/object/public/avatars/${userId}/`;
}

/** Only a photo from the user's own folder may be set as their avatar. */
export function isOwnAvatarUrl(url: unknown, userId: string): url is string {
  if (typeof url !== 'string' || url.length > 500) return false;
  const prefix = avatarFolderUrl(userId);
  return url.startsWith(prefix) && /^[\w.-]+$/.test(url.slice(prefix.length));
}

/** "Noa Barak" -> "NB"; empty -> "?". */
export function initialsOf(name: string | null | undefined): string {
  return (name ?? '').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2) || '?';
}
