import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { PageHero } from '@/components/PageHero';
import { requireOnboardedUser } from '@/lib/auth/session';
import { canEditTrip, getTrip } from '@/lib/trips/queries';
import { formatDayHe } from '@/lib/trips/rules';
import { deleteAlbumPhoto } from '../../album-actions';
import { AlbumUpload } from './AlbumUpload';
import { AlbumDownload } from './AlbumDownload';
import { AlbumTitle } from './AlbumTitle';
import { DriveAlbum, type DriveAlbumRow } from './DriveAlbum';

export const metadata: Metadata = { title: 'אלבום הטיול · YallaTrip' };

type Photo = { id: string; user_id: string; url: string; taken_at: string };

/** The trip's album: photos filed by destination, then by day, in the order they were taken. */
export default async function AlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, profile } = await requireOnboardedUser(`/trips/${id}/album`);
  if (!(await canEditTrip(supabase, id))) notFound();
  const trip = await getTrip(supabase, id);
  if (!trip) notFound();
  // With a Google sign-in set up for the site, new photos go to each traveller's own Drive instead of our storage.
  const driveClientId = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID ?? '';
  const [{ data }, { data: meta }, { data: driveRow }] = await Promise.all([
    supabase.from('trip_album').select('id, user_id, url, taken_at').eq('trip_id', trip.id).order('taken_at'),
    supabase.from('trips').select('album_title').eq('id', trip.id).maybeSingle(),
    supabase.from('trip_drive_albums').select('folder_id, folder_name, day_folders').eq('trip_id', trip.id).eq('user_id', user.id).maybeSingle(),
  ]);
  const dr = driveRow as { folder_id: string; folder_name: string; day_folders: Record<string, string> | null } | null;
  const drive: DriveAlbumRow | null = dr ? { folderId: dr.folder_id, folderName: dr.folder_name, dayFolders: dr.day_folders ?? {} } : null;
  const albumTitle = (meta?.album_title as string | null) ?? null;
  // The album bucket is private: each photo is shown through a signed link that works for an hour.
  const rows = (data ?? []) as Photo[];
  const signed = rows.length
    ? (await supabase.storage.from('trip-album').createSignedUrls(rows.map((r) => r.url), 3600)).data ?? []
    : [];
  const links = new Map(signed.filter((x) => x.signedUrl && x.path).map((x) => [x.path!, x.signedUrl]));
  const photos = rows.filter((r) => links.has(r.url)).map((r) => ({ ...r, url: links.get(r.url)! }));

  // The photo's date (in the traveler's day) decides its day and its destination.
  const dateOf = (iso: string) => iso.slice(0, 10);
  const legOf = (date: string) => trip.destinations.find((l) => l.start && date >= l.start && date <= (l.end ?? l.start))?.name
    ?? (trip.destinations.length <= 1 ? trip.destination_name : null);
  const dayOf = (date: string) => trip.days.find((d) => d.date === date);

  const groups: { title: string; days: { key: string; label: string; photos: Photo[] }[] }[] = [];
  for (const ph of photos) {
    const date = dateOf(ph.taken_at);
    const title = legOf(date) ?? (trip.start_date && date < trip.start_date ? 'לפני הטיול' : trip.end_date && date > trip.end_date ? 'אחרי הטיול' : 'בדרך');
    let g = groups.find((x) => x.title === title);
    if (!g) { g = { title, days: [] }; groups.push(g); }
    let d = g.days.find((x) => x.key === date);
    if (!d) {
      const day = dayOf(date);
      d = { key: date, label: `${day ? `יום ${day.day_index} · ` : ''}${formatDayHe(date) ?? date}`, photos: [] };
      g.days.push(d);
    }
    d.photos.push(ph);
  }

  // The trip's days for "which day were they taken?", and the folders for the download.
  const tripDays = trip.days.filter((d) => d.date).map((d) => ({ index: d.day_index, date: d.date!, label: `יום ${d.day_index} · ${formatDayHe(d.date!) ?? d.date}` }));
  const folderOf = (date: string) => {
    const day = dayOf(date);
    if (day) return `יום ${String(day.day_index).padStart(2, '0')} · ${date}`;
    return `${trip.start_date && date < trip.start_date ? 'לפני הטיול' : trip.end_date && date > trip.end_date ? 'אחרי הטיול' : 'עוד'} · ${date}`;
  };
  const lastDate = trip.end_date ?? tripDays.at(-1)?.date ?? null;

  return (
    <>
      <AppHeader name={profile?.display_name ?? null} role={profile?.role} avatar={profile?.avatar_url ?? null} />
      <PageHero width="max-w-[1100px]" back={{ href: `/trips/${trip.id}`, label: '→ חזרה לטיול' }} eyebrow={trip.title}
        title={albumTitle ?? 'אלבום הטיול'}
        subtitle={driveClientId && photos.length === 0 ? 'התמונות נשמרות ב-Google Drive שלך, בתיקייה לכל יום.' : `${photos.length} תמונות, מסודרות לפי יעד ויום.`} />
      <main className="mx-auto flex max-w-[1100px] flex-col gap-10 px-5 py-10 sm:px-8">
        <AlbumTitle tripId={trip.id} title={albumTitle} />
        <AlbumDownload title={albumTitle ?? trip.title} lastDate={lastDate}
          items={photos.map((ph) => ({ url: ph.url, folder: folderOf(dateOf(ph.taken_at)) }))} />
        {driveClientId
          ? <DriveAlbum tripId={trip.id} clientId={driveClientId} days={tripDays} defaultName={albumTitle ?? trip.title} initial={drive} />
          : <AlbumUpload tripId={trip.id} days={tripDays} />}
        {photos.length === 0 && !driveClientId && (
          <div className="rounded-3xl border-2 border-dashed border-line p-10 text-center">
            <p className="text-xl font-extrabold">עוד אין תמונות באלבום</p>
            <p className="mt-2 text-ink-2">בוחרים למעלה את היום שבו צולמו ומעלים. התמונות מסתדרות לבד לפי ימי הטיול ולפי שעת הצילום.</p>
          </div>
        )}
        {groups.map((g) => (
          <section key={g.title} aria-labelledby={`g-${g.title}`} className="flex flex-col gap-5">
            <h2 id={`g-${g.title}`} className="font-display text-3xl font-black">{g.title}</h2>
            {g.days.map((d) => (
              <div key={d.key} className="flex flex-col gap-2">
                <h3 className="font-extrabold text-ink-2">{d.label} <span className="font-semibold text-muted">· {d.photos.length}</span></h3>
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {d.photos.map((ph) => (
                    <li key={ph.id} className="group relative overflow-hidden rounded-2xl bg-sand-2">
                      <a href={ph.url} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={ph.url} alt={`תמונה מ${g.title}, ${d.label}`} loading="lazy" className="aspect-square w-full object-cover transition duration-300 group-hover:scale-105" />
                      </a>
                      <span className="absolute bottom-1.5 right-2 rounded bg-black/45 px-1.5 text-[11px] font-bold text-white">
                        {new Date(ph.taken_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}
                      </span>
                      {ph.user_id === user.id && (
                        <form action={deleteAlbumPhoto} className="absolute top-1.5 left-1.5">
                          <input type="hidden" name="tripId" value={trip.id} />
                          <input type="hidden" name="id" value={ph.id} />
                          <button type="submit" aria-label="מחיקת התמונה" className="h-8 w-8 rounded-full bg-white/90 text-sm font-bold text-danger opacity-80 shadow hover:opacity-100">✕</button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        ))}
      </main>
    </>
  );
}
