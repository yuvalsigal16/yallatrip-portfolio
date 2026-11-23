import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Deletes a trip's files (album photos and the photos of its place reviews) before the trip itself,
 * so nothing personal is left in storage. Needs the caller to still be allowed to edit the trip.
 */
export async function removeTripFiles(supabase: SupabaseClient, tripId: string): Promise<void> {
  for (const bucket of ['trip-album', 'trip-photos', 'trip-docs']) {
    try {
      const paths: string[] = [];
      const { data: top } = await supabase.storage.from(bucket).list(tripId, { limit: 1000 });
      for (const f of top ?? []) {
        if (f.id) { paths.push(`${tripId}/${f.name}`); continue; }
        // a sub-folder (review photos sit under the saved place's id)
        const { data: inner } = await supabase.storage.from(bucket).list(`${tripId}/${f.name}`, { limit: 1000 });
        for (const g of inner ?? []) if (g.id) paths.push(`${tripId}/${f.name}/${g.name}`);
      }
      for (let i = 0; i < paths.length; i += 100) await supabase.storage.from(bucket).remove(paths.slice(i, i + 100));
    } catch (e) {
      console.error('[removeTripFiles]', bucket, e);
    }
  }
}
