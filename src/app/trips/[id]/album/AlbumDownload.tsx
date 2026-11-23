'use client';

import { useEffect, useState } from 'react';

type Item = { url: string; folder: string };

// ---------- a tiny ZIP writer (photos are already compressed, so files are stored as they are) ----------
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(b: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function zip(files: { name: string; data: Uint8Array }[]): Blob {
  const enc = new TextEncoder();
  const parts: BlobPart[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // names in UTF-8 (Hebrew folder names)
    local.setUint16(8, 0, true); // stored
    local.setUint32(14, crc, true);
    local.setUint32(18, f.data.length, true);
    local.setUint32(22, f.data.length, true);
    local.setUint16(26, name.length, true);
    parts.push(local.buffer, name as BlobPart, f.data as BlobPart);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, f.data.length, true);
    c.setUint32(24, f.data.length, true);
    c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    central.push(new Uint8Array(c.buffer), name);
    offset += 30 + name.length + f.data.length;
  }
  const size = central.reduce((s, x) => s + x.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, size, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...(central as BlobPart[]), end.buffer], { type: 'application/zip' });
}

/**
 * From the trip's last day on: download every photo as one folder, with a folder per day
 * ("יום 01 · 2026-10-03"), in the order they were taken. On a phone it lands in Files / Downloads.
 */
export function AlbumDownload({ items, lastDate, title }: { items: Item[]; lastDate: string | null; title: string }) {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const n = new Date();
    const today = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
    setShow(!!lastDate && today >= lastDate);
  }, [lastDate]);

  if (!show || items.length === 0) return null;

  const download = async () => {
    setErr(null);
    const files: { name: string; data: Uint8Array }[] = [];
    const count = new Map<string, number>();
    for (const [i, it] of items.entries()) {
      setBusy(`מכינים ${i + 1} מתוך ${items.length}…`);
      try {
        const res = await fetch(it.url);
        if (!res.ok) continue;
        const data = new Uint8Array(await res.arrayBuffer());
        const n = (count.get(it.folder) ?? 0) + 1;
        count.set(it.folder, n);
        const ext = it.url.split('?')[0]!.split('.').pop()?.toLowerCase() === 'webp' ? 'webp' : 'jpg';
        files.push({ name: `${it.folder}/${String(n).padStart(3, '0')}.${ext}`, data });
      } catch { /* skip a photo that won't load */ }
    }
    if (!files.length) { setBusy(null); return setErr('לא הצלחנו להוריד את התמונות. נסי שוב.'); }
    setBusy('שומרים…');
    const url = URL.createObjectURL(zip(files));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[\\/:*?"<>|]/g, '')} - תמונות.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    setBusy(null);
  };

  return (
    <section className="flex flex-col gap-2 rounded-3xl bg-gradient-to-l from-[#0E4A86] to-[#1F8CD2] p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:p-6" aria-labelledby="dl-h">
      <div>
        <h2 id="dl-h" className="text-xl font-extrabold">הטיול נגמר? קחי את כל התמונות</h2>
        <p className="text-sm text-white/85">כל {items.length} התמונות בתיקייה אחת, עם תיקייה לכל יום לפי הסדר. בטלפון היא נשמרת ב&quot;קבצים&quot; או ב&quot;הורדות&quot;.</p>
        {err && <p role="alert" className="mt-1 text-sm font-bold text-[#FFD9C7]">{err}</p>}
      </div>
      <button type="button" onClick={download} disabled={!!busy}
        className="min-h-12 shrink-0 rounded-full bg-white px-6 font-extrabold text-[#0C2D4A] shadow-lg disabled:opacity-70">
        {busy ?? '⬇ הורדת כל התמונות'}
      </button>
    </section>
  );
}
