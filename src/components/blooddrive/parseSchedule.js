// Parses the blood drive time-slot PDF (Google Docs export: a Time | Slot 1-4
// table, then a "PEOPLE WHO HAVE NOT GIVEN A TIME" list, then "Walk-Ins"
// lines like "8:00– Name… Name…"). Works off positioned text items so a name
// that wraps inside its cell ("Stephen Taylor / Jr.") stays one name.
//
// parseScheduleItems() is pure (items in, schedule out) so it can be run in
// node against the real PDF; loadSchedulePdf() is the browser entry point.

const TIME_RE = /^\d{1,2}:\d{2}$/;
const ROW_TOLERANCE = 4; // wrapped lines sit below their row's time; allow tiny baseline drift above
const LINE_TOLERANCE = 3;

const clean = (s) => s.replace(/[​-‍﻿]/g, '').replace(/\s+/g, ' ').trim();

/** "8:15" -> "08:15", "1:00" -> "13:00" (drive runs ~8 AM to 1 PM, so 1-6 are PM). */
export function to24h(hm) {
  const [h, m] = hm.split(':').map(Number);
  const hour = h >= 1 && h <= 6 ? h + 12 : h;
  return `${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function groupLines(items) {
  const lines = [];
  for (const it of [...items].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const line = lines.find((l) => Math.abs(l.y - it.y) <= LINE_TOLERANCE);
    if (line) line.items.push(it);
    else lines.push({ y: it.y, items: [it] });
  }
  return lines.map((l) => ({
    y: l.y,
    text: clean(l.items.sort((a, b) => a.x - b.x).map((i) => i.str).join(' ')),
  }));
}

function joinCell(parts) {
  return clean(parts.sort((a, b) => a.y - b.y || a.x - b.x).map((p) => p.str).join(' '));
}

/**
 * @param {{str:string,x:number,y:number,w:number}[]} rawItems  y grows downward, pages stacked
 * @returns {{ slots: {time:string,label:string,names:string[]}[], unassigned: string[], walkIns: {time:string,label:string,names:string[]}[] }}
 */
export function parseScheduleItems(rawItems) {
  const items = rawItems.map((i) => ({ ...i, str: clean(i.str) })).filter((i) => i.str);

  const headers = items
    .filter((i) => /^slot\s*\d+$/i.test(i.str))
    .map((i) => ({ x: i.x + i.w / 2, y: i.y }))
    .sort((a, b) => a.x - b.x);
  if (headers.length === 0) throw new Error('No "Slot 1…" header row found in this PDF.');

  const headerY = Math.max(...headers.map((h) => h.y));
  const firstColLeft = Math.min(...items.filter((i) => /^slot\s*\d+$/i.test(i.str)).map((i) => i.x));
  const endMarker = items.find((i) => /people who have not|walk-?ins/i.test(i.str));
  const tableEnd = endMarker ? endMarker.y : Infinity;

  const inTable = (i) => i.y > headerY + LINE_TOLERANCE && i.y < tableEnd - LINE_TOLERANCE;
  const times = items
    .filter((i) => inTable(i) && TIME_RE.test(i.str) && i.x < firstColLeft)
    .sort((a, b) => a.y - b.y);

  const cells = times.map(() => headers.map(() => []));
  for (const it of items) {
    if (!inTable(it) || times.includes(it) || it.x + it.w < firstColLeft - 2) continue;
    let row = -1;
    for (let r = 0; r < times.length; r++) if (times[r].y <= it.y + ROW_TOLERANCE) row = r;
    if (row < 0) continue;
    const center = it.x + it.w / 2;
    let col = 0;
    headers.forEach((h, c) => { if (Math.abs(h.x - center) < Math.abs(headers[col].x - center)) col = c; });
    cells[row][col].push(it);
  }

  const slots = times.map((t, r) => ({
    time: to24h(t.str),
    label: t.str,
    names: cells[r].map(joinCell).filter(Boolean),
  }));

  // Tail sections — read as plain lines.
  const tail = groupLines(items.filter((i) => i.y >= tableEnd - LINE_TOLERANCE));
  const walkIdx = tail.findIndex((l) => /walk-?ins/i.test(l.text));
  const unassignedLines = tail.slice(1, walkIdx < 0 ? undefined : walkIdx);
  const unassigned = unassignedLines
    .map((l) => clean(l.text.replace(/^[\s\-–•*]+/, '')))
    .filter(Boolean);

  const walkIns = [];
  if (walkIdx >= 0) {
    const text = tail.slice(walkIdx + 1).map((l) => l.text).join(' ');
    const re = /(\d{1,2}:\d{2})\s*[–—-]\s*/g;
    const marks = [...text.matchAll(re)];
    marks.forEach((m, k) => {
      const body = text.slice(m.index + m[0].length, k + 1 < marks.length ? marks[k + 1].index : undefined);
      walkIns.push({
        time: to24h(m[1]),
        label: m[1],
        names: body.split(/…|\.\.\./).map(clean).filter(Boolean),
      });
    });
  }

  return { slots, unassigned, walkIns };
}

/** Browser: File/ArrayBuffer -> parsed schedule. pdfjs is loaded lazily (big). */
export async function loadSchedulePdf(data) {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const doc = await pdfjs.getDocument({ data }).promise;
  return parseScheduleItems(await extractItems(doc));
}

/** pdfjs document -> items with top-down y, pages stacked. Shared with the node check. */
export async function extractItems(doc) {
  const out = [];
  let offset = 0;
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const { height } = page.getViewport({ scale: 1 });
    const { items } = await page.getTextContent();
    for (const it of items) {
      if (!it.str) continue;
      out.push({ str: it.str, x: it.transform[4], y: offset + (height - it.transform[5]), w: it.width });
    }
    offset += height;
  }
  return out;
}
