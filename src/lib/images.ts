/**
 * Shrinks a photo in the browser before upload: longest side up to `max` px, WebP (or JPEG
 * where the browser cannot write WebP). Drawing onto a fresh canvas also drops camera
 * metadata such as the GPS location.
 */
export async function shrinkImage(file: File, max = 1600): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => fail(new Error('bad image'));
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no canvas');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const encode = (type: string) => new Promise<Blob | null>((ok) => canvas.toBlob(ok, type, 0.85));
    let blob = await encode('image/webp');
    if (!blob || blob.type !== 'image/webp') blob = await encode('image/jpeg');
    if (!blob) throw new Error('encode failed');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * The time of day a photo was taken, from its camera data (EXIF DateTimeOriginal), as "HH:MM:SS".
 * Phones don't keep the capture time in the file's date when a photo is picked from the gallery,
 * so this is what keeps an album day in the order the photos were taken. Null when there is none.
 */
export async function photoTakenTime(file: File): Promise<string | null> {
  try {
    const buf = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
    if (buf.byteLength < 4 || buf.getUint16(0) !== 0xffd8) return null; // JPEG only
    let off = 2;
    while (off + 4 < buf.byteLength) {
      const marker = buf.getUint16(off);
      const len = buf.getUint16(off + 2);
      if (marker === 0xffe1 && buf.getUint32(off + 4) === 0x45786966) return readExifTime(buf, off + 10);
      if ((marker & 0xff00) !== 0xff00) return null;
      off += 2 + len;
    }
  } catch { /* unreadable: no time */ }
  return null;
}

function readExifTime(v: DataView, tiff: number): string | null {
  const little = v.getUint16(tiff) === 0x4949;
  const u16 = (o: number) => v.getUint16(tiff + o, little);
  const u32 = (o: number) => v.getUint32(tiff + o, little);
  const ascii = (o: number, n: number) => {
    let s = '';
    for (let i = 0; i < n && tiff + o + i < v.byteLength; i++) s += String.fromCharCode(v.getUint8(tiff + o + i));
    return s;
  };
  const find = (ifd: number, tag: number): number | null => {
    if (tiff + ifd + 2 > v.byteLength) return null;
    const n = u16(ifd);
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12;
      if (tiff + e + 12 > v.byteLength) return null;
      if (u16(e) === tag) return e;
    }
    return null;
  };
  const ifd0 = u32(4);
  const exifPtr = find(ifd0, 0x8769);
  const fromEntry = (e: number | null) => {
    if (e === null) return null;
    const m = /(\d{2}):(\d{2}):(\d{2})\s*$/.exec(ascii(u32(e + 8), 19));
    return m ? `${m[1]}:${m[2]}:${m[3]}` : null;
  };
  // DateTimeOriginal in the Exif block, else the file's DateTime
  return (exifPtr !== null ? fromEntry(find(u32(exifPtr + 8), 0x9003)) : null) ?? fromEntry(find(ifd0, 0x0132));
}
