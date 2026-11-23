'use server';

import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/validation';

// 👍 / 👎 on saved places, for people planning a trip together. Row Level Security: only the
// trip's people see the votes, and each person changes only their own.

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };
export type PlaceVotes = { savedPlaceId: string; up: number; down: number; mine: 1 | -1 | 0 };

export async function getVotes(input: { tripId: string }): Promise<Result<PlaceVotes[]>> {
  if (!isUuid(input?.tripId)) return { ok: false, error: 'בקשה לא תקינה' };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: 'צריך להתחבר' };
  const { data, error } = await supabase.from('trip_place_votes').select('saved_place_id, user_id, vote').eq('trip_id', input.tripId);
  if (error) return { ok: false, error: 'לא הצלחנו לטעון את ההצבעות' };
  const map = new Map<string, PlaceVotes>();
  for (const r of (data ?? []) as { saved_place_id: string; user_id: string; vote: number }[]) {
    const v = map.get(r.saved_place_id) ?? { savedPlaceId: r.saved_place_id, up: 0, down: 0, mine: 0 as const };
    if (r.vote > 0) v.up += 1; else v.down += 1;
    if (r.user_id === auth.user.id) v.mine = r.vote > 0 ? 1 : -1;
    map.set(r.saved_place_id, v);
  }
  return { ok: true, data: [...map.values()] };
}

/** vote 1 / -1 sets my vote; 0 takes it back. */
export async function votePlace(input: { tripId: string; savedPlaceId: string; vote: 1 | -1 | 0 }): Promise<Result> {
  const { tripId, savedPlaceId, vote } = input ?? {};
  if (!isUuid(tripId) || !isUuid(savedPlaceId) || ![1, -1, 0].includes(vote)) return { ok: false, error: 'בקשה לא תקינה' };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: 'צריך להתחבר' };
  // The place must belong to this trip (the vote row carries the trip id that the access rule checks).
  const { data: sp } = await supabase.from('saved_places').select('id').eq('id', savedPlaceId).eq('trip_id', tripId).maybeSingle();
  if (!sp) return { ok: false, error: 'המקום לא נמצא בטיול' };
  const q = vote === 0
    ? supabase.from('trip_place_votes').delete().eq('saved_place_id', savedPlaceId).eq('user_id', auth.user.id)
    : supabase.from('trip_place_votes').upsert({ trip_id: tripId, saved_place_id: savedPlaceId, user_id: auth.user.id, vote }, { onConflict: 'saved_place_id,user_id' });
  const { error } = await q;
  if (error) { console.error('[vote]', error.message); return { ok: false, error: 'לא הצלחנו לשמור את ההצבעה' }; }
  return { ok: true, data: null };
}
