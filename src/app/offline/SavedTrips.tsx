'use client';

import { useEffect, useState } from 'react';

type Saved = { url: string; title: string; at: number };

/** The trip plans the service worker kept on this phone (it writes a small index next to them). */
export function SavedTrips() {
  const [list, setList] = useState<Saved[] | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const cache = await caches.open('gotrip-pages-v1');
        const r = await cache.match('/__offline-index');
        const index = (r ? await r.json() : {}) as Record<string, { title: string; at: number }>;
        setList(Object.entries(index).map(([url, v]) => ({ url, ...v })).sort((a, b) => b.at - a.at));
      } catch {
        setList([]);
      }
    })();
  }, []);

  if (list === null) return null;
  if (!list.length) return <p className="mt-4 font-semibold">עוד לא נשמרה תוכנית בטלפון. בפעם הבאה שיש אינטרנט, פתחו את הטיול והיא תישמר לבד.</p>;
  return (
    <ul className="mt-4 flex flex-col gap-2">
      {list.map((s) => (
        <li key={s.url}>
          <a href={s.url} className="flex min-h-12 items-center justify-between rounded-xl border border-line px-4 font-bold text-ink no-underline hover:bg-sand">
            {s.title}
            <span className="text-xs font-semibold text-muted">{new Date(s.at).toLocaleDateString('he-IL')}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
