import { createClient } from '@/lib/supabase/browser';
import { shrinkImage } from '@/lib/images';
import { setTripCover } from '@/app/trips/cover-actions';

/** Shrinks a photo from the phone, stores it in the trip's cover folder and makes it the trip's cover. Returns its address. */
export async function uploadTripCover(tripId: string, file: File): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!file.type.startsWith('image/') || file.size > 25 * 1024 * 1024) return { ok: false, error: 'צריך לבחור תמונה (עד 25MB)' };
  try {
    const blob = await shrinkImage(file, 1600);
    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${tripId}/cover/${Date.now()}.${ext}`;
    const supabase = createClient();
    const up = await supabase.storage.from('trip-photos').upload(path, blob, { contentType: blob.type, upsert: false });
    if (up.error) throw up.error;
    const url = supabase.storage.from('trip-photos').getPublicUrl(path).data.publicUrl;
    const r = await setTripCover({ tripId, url });
    if (!r.ok) return { ok: false, error: r.error };
    return { ok: true, url };
  } catch (e) {
    console.error('[cover]', e);
    return { ok: false, error: 'התמונה לא עלתה. נסי שוב.' };
  }
}
