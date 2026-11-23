// Turns pasted text (a list of place names, or Google Maps links) into search terms, one per place.

export const IMPORT_MAX = 25;

/** The place's name out of a long Google Maps link (".../maps/place/Narikala+Fortress/@41..."), or null. */
export function nameFromMapsLink(line: string): string | null {
  const m = /google\.[a-z.]+\/maps\/place\/([^/@?]+)/i.exec(line);
  if (!m) return null;
  try {
    const name = decodeURIComponent(m[1]!.replace(/\+/g, ' ')).trim();
    return name || null;
  } catch { return null; }
}

export type ImportLine = { text: string } | { skipped: string; why: string };

/** One search term per line: bullets and numbering dropped, links read, duplicates and empties removed. */
export function parseImportText(raw: string): ImportLine[] {
  const out: ImportLine[] = [];
  const seen = new Set<string>();
  for (const rawLine of raw.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line) continue;
    if (/https?:\/\//i.test(line)) {
      const name = nameFromMapsLink(line);
      if (!name) { out.push({ skipped: line.slice(0, 60), why: 'קישור מקוצר: פתחו אותו והעתיקו את שם המקום' }); continue; }
      line = name;
    }
    line = line.replace(/^\s*(?:[-*•·]|\d{1,2}[.)])\s*/, '').replace(/\s+/g, ' ').trim().slice(0, 120);
    if (line.length < 2) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ text: line });
  }
  return out;
}
