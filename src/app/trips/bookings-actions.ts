'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/validation';
import { BOOKING_COLUMNS, DOC_BUCKET, isDocPath, parseBooking, type Booking, type BookingInput } from '@/lib/trips/bookings';

// A trip's bookings and documents. Row Level Security lets only the people planning the trip
// read or change them; the checks here keep the input clean.

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };
const SAVE_ERROR = 'לא הצלחנו לשמור. בדקו את החיבור לאינטרנט ונסו שוב.';
const hhmm = (b: Booking): Booking => ({ ...b, start_time: b.start_time ? b.start_time.slice(0, 5) : null });

export async function addBooking(input: { tripId: string; booking: BookingInput; filePath?: string | null; fileName?: string | null }): Promise<Result<Booking>> {
  if (!isUuid(input?.tripId)) return { ok: false, error: 'בקשה לא תקינה' };
  const parsed = parseBooking(input.booking);
  if (!parsed.ok) return parsed;
  const filePath = input.filePath && isDocPath(input.tripId, input.filePath) ? input.filePath : null;
  const fileName = filePath && typeof input.fileName === 'string' ? input.fileName.trim().slice(0, 120) || null : null;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: 'צריך להתחבר' };
  const { data, error } = await supabase.from('trip_bookings')
    .insert({ trip_id: input.tripId, ...parsed.value, file_path: filePath, file_name: fileName })
    .select(BOOKING_COLUMNS).single();
  if (error || !data) { console.error('[booking add]', error?.message); return { ok: false, error: SAVE_ERROR }; }
  revalidatePath(`/trips/${input.tripId}/bookings`);
  revalidatePath(`/trips/${input.tripId}/plan`);
  return { ok: true, data: hhmm(data as unknown as Booking) };
}

export async function deleteBooking(input: { tripId: string; id: string }): Promise<Result> {
  if (!isUuid(input?.tripId) || !isUuid(input?.id)) return { ok: false, error: 'בקשה לא תקינה' };
  const supabase = await createClient();
  const { data, error } = await supabase.from('trip_bookings').delete().eq('id', input.id).eq('trip_id', input.tripId)
    .select('file_path').maybeSingle();
  if (error) { console.error('[booking delete]', error.message); return { ok: false, error: SAVE_ERROR }; }
  const path = (data as { file_path: string | null } | null)?.file_path;
  if (isDocPath(input.tripId, path)) await supabase.storage.from(DOC_BUCKET).remove([path]);
  revalidatePath(`/trips/${input.tripId}/bookings`);
  revalidatePath(`/trips/${input.tripId}/plan`);
  return { ok: true, data: null };
}
