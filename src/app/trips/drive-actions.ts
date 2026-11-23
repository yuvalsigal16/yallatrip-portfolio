'use server';

import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/validation';
import { GENERIC_ERROR } from '@/lib/auth/errors';

// Where a traveller's Drive album lives: only folder ids and the name. The photos never reach us.

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };
const bad = { ok: false as const, error: 'בקשה לא תקינה' };
const isFolderId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{5,200}$/.test(v);
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

export async function saveDriveAlbum(input: { tripId: string; folderId: string; folderName: string }): Promise<Result> {
  const { tripId, folderId } = input ?? {};
  const name = typeof input?.folderName === 'string' ? input.folderName.trim().slice(0, 120) : '';
  if (!isUuid(tripId) || !isFolderId(folderId) || !name) return bad;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: 'צריך להתחבר' };
  const { error } = await supabase.from('trip_drive_albums')
    .upsert({ trip_id: tripId, user_id: auth.user.id, folder_id: folderId, folder_name: name, day_folders: {} }, { onConflict: 'trip_id,user_id' });
  return error ? { ok: false, error: GENERIC_ERROR } : { ok: true, data: null };
}

/** Remember the folder of one day, so the next photos of that day go into it. */
export async function saveDriveDayFolder(input: { tripId: string; date: string; folderId: string }): Promise<Result> {
  const { tripId, date, folderId } = input ?? {};
  if (!isUuid(tripId) || !isDate(date) || !isFolderId(folderId)) return bad;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: 'צריך להתחבר' };
  const { data: row } = await supabase.from('trip_drive_albums').select('day_folders').eq('trip_id', tripId).eq('user_id', auth.user.id).maybeSingle();
  if (!row) return bad;
  const folders = { ...((row as { day_folders: Record<string, string> | null }).day_folders ?? {}), [date]: folderId };
  if (Object.keys(folders).length > 800) return bad;
  const { error } = await supabase.from('trip_drive_albums').update({ day_folders: folders }).eq('trip_id', tripId).eq('user_id', auth.user.id);
  return error ? { ok: false, error: GENERIC_ERROR } : { ok: true, data: null };
}

/** Disconnect: we forget the folder. Nothing is removed from the traveller's Drive. */
export async function forgetDriveAlbum(input: { tripId: string }): Promise<Result> {
  const { tripId } = input ?? {};
  if (!isUuid(tripId)) return bad;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: 'צריך להתחבר' };
  const { error } = await supabase.from('trip_drive_albums').delete().eq('trip_id', tripId).eq('user_id', auth.user.id);
  return error ? { ok: false, error: GENERIC_ERROR } : { ok: true, data: null };
}
