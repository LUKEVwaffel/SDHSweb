// Browser side of the rifle score import: File → grids the deterministic
// reader (scoreGrid.js) can scan, plus whatever the AI fallback would need
// if that finds nothing. Heavy libraries (SheetJS, pdf.js, heic2any) load
// lazily, only when a file of that type is actually dropped.

import { decodeText, textToGrids, gridToCsv } from './textGrid.js';
import { extractScoreTables } from './scoreGrid.js';

export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const AI_MAX_CHARS = 60000;
const AI_IMAGE_EDGE = 2000;

const TEXT_EXT = ['csv', 'tsv', 'tab', 'txt', 'prn', 'dat'];
const SHEET_EXT = ['xlsx', 'xlsm', 'xlsb', 'xls', 'xltx', 'ods', 'fods', 'numbers', 'html', 'htm'];
const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'heic', 'heif'];

// What the file input offers. Kept broad on purpose — the reader sniffs.
export const ACCEPT = [
  ...[...TEXT_EXT, ...SHEET_EXT, ...IMAGE_EXT, 'pdf'].map((e) => `.${e}`),
  'text/csv', 'text/plain', 'text/tab-separated-values', 'application/pdf', 'image/*',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.spreadsheet',
].join(',');

export const FORMAT_LABEL = 'Excel (.xlsx .xls .xlsm .xlsb), Google Sheets/Numbers exports, OpenDocument (.ods), CSV / TSV / TXT, PDF, or a photo of the sheet';

function extOf(name) {
  const m = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : '';
}

function kindOf(file) {
  const ext = extOf(file.name);
  const type = (file.type || '').toLowerCase();
  if (ext === 'pdf' || type === 'application/pdf') return 'pdf';
  if (IMAGE_EXT.includes(ext) || type.startsWith('image/')) return 'image';
  if (TEXT_EXT.includes(ext) || type.startsWith('text/')) return 'text';
  if (SHEET_EXT.includes(ext) || /spreadsheet|excel|opendocument/.test(type)) return 'sheet';
  return 'unknown';
}

// ── SheetJS ──────────────────────────────────────────────────────────────
async function readWorkbook(buf) {
  const XLSX = await import('xlsx');
  // cellDates off + raw values: scores come back as numbers, not "96.40".
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array', cellDates: false, dense: true });
  return wb.SheetNames.map((name) => ({
    name,
    grid: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: '', blankrows: true }),
  })).filter((s) => s.grid.some((row) => row.some((c) => String(c).trim())));
}

// ── PDF ──────────────────────────────────────────────────────────────────
// Rebuild lines from positioned text runs; a visible horizontal gap becomes
// a 2-space column break so parseWhitespaceColumns can split it back apart.
async function readPdfText(buf) {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const lines = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const { items } = await page.getTextContent();
    const runs = items.filter((it) => it.str && it.str.trim())
      .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h: Math.abs(it.transform[3]) || 10 }));
    runs.sort((a, b) => b.y - a.y || a.x - b.x);
    const pageLines = [];
    for (const r of runs) {
      const line = pageLines.find((l) => Math.abs(l.y - r.y) < Math.max(2, r.h * 0.4));
      if (line) line.runs.push(r); else pageLines.push({ y: r.y, runs: [r] });
    }
    for (const l of pageLines) {
      l.runs.sort((a, b) => a.x - b.x);
      let text = '';
      let end = null;
      for (const r of l.runs) {
        if (end != null) {
          const gap = r.x - end;
          text += gap > r.h * 0.6 ? '  ' : gap > r.h * 0.15 ? ' ' : '';
        }
        text += r.str;
        end = r.x + r.w;
      }
      lines.push(text);
    }
    lines.push('');
  }
  return lines.join('\n');
}

// ── Images (for the AI fallback only) ────────────────────────────────────
async function imageToJpegBase64(file) {
  let src = file;
  const { isHeic, convertHeicToJpeg } = await import('../../../../lib/heicConvert.js');
  if (isHeic(file) || /\.(heic|heif)$/i.test(file.name)) src = await convertHeicToJpeg(file);
  const bitmap = await createImageBitmap(src);
  const scale = Math.min(1, AI_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
  return dataUrl.slice(dataUrl.indexOf(',') + 1);
}

export function bufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  return btoa(binary);
}

function groupsFromGrids(grids, sheetName) {
  let firstReason = null;
  for (const grid of grids) {
    const { groups, reason } = extractScoreTables(grid);
    if (groups.length) return { groups: groups.map((g) => ({ ...g, sheet: sheetName, grid })), reason: null };
    firstReason ??= reason;
  }
  return { groups: [], reason: firstReason };
}

/**
 * Read one File. Resolves to:
 *   { groups: [...], aiInput: null | { raw_text } | { file_base64, media_type }, reason }
 * groups come from the deterministic reader; aiInput is what to send to
 * rifle-comp-parse when groups is empty. Throws only for unreadable files.
 */
export async function readScoreFile(file) {
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} is ${(file.size / 1048576).toFixed(1)}MB — max is ${MAX_FILE_BYTES / 1048576}MB.`);
  if (file.size === 0) throw new Error(`${file.name} is empty.`);
  const kind = kindOf(file);

  if (kind === 'image') {
    return { groups: [], reason: 'Photos are read by AI.', aiInput: { file_base64: await imageToJpegBase64(file), media_type: 'image/jpeg' } };
  }

  const buf = await file.arrayBuffer();

  if (kind === 'pdf') {
    let text = '';
    try { text = await readPdfText(buf); } catch (e) { throw new Error(`Couldn't open ${file.name} as a PDF (${e.message}).`); }
    if (text.replace(/\s/g, '').length < 20) {
      // Scanned PDF — no text layer. Let the AI read the pages directly.
      if (buf.byteLength > 8 * 1024 * 1024) throw new Error(`${file.name} is a scanned PDF too large for AI reading (max 8MB) — export it as a spreadsheet or photo instead.`);
      return { groups: [], reason: 'Scanned PDF (no text layer).', aiInput: { file_base64: bufferToBase64(buf), media_type: 'application/pdf' } };
    }
    const { groups, reason } = groupsFromGrids(textToGrids(text), file.name);
    return { groups, reason, aiInput: groups.length ? null : { raw_text: text } };
  }

  if (kind === 'text') {
    const text = decodeText(buf);
    const { groups, reason } = groupsFromGrids(textToGrids(text), file.name);
    return { groups, reason, aiInput: groups.length ? null : { raw_text: text } };
  }

  // Spreadsheet (or unknown — SheetJS sniffs the real format from the bytes,
  // which also rescues a .csv that's secretly .xlsx or vice versa).
  let sheets;
  try {
    sheets = await readWorkbook(buf);
  } catch (e) {
    if (kind === 'unknown') {
      const text = decodeText(buf);
      const { groups, reason } = groupsFromGrids(textToGrids(text), file.name);
      return { groups, reason, aiInput: groups.length ? null : { raw_text: text } };
    }
    const locked = /password|encrypt/i.test(e.message);
    throw new Error(locked ? `${file.name} is password-protected — remove the password in Excel and re-save.` : `Couldn't read ${file.name} as a spreadsheet (${e.message}).`);
  }
  if (!sheets.length) throw new Error(`${file.name} has no data in any sheet.`);

  // Every sheet is scanned; a sheet literally named "Scores" goes first.
  sheets.sort((a, b) => (/^\s*scores?\s*$/i.test(b.name) ? 1 : 0) - (/^\s*scores?\s*$/i.test(a.name) ? 1 : 0));
  const groups = [];
  const reasons = [];
  for (const s of sheets) {
    const r = groupsFromGrids([s.grid], sheets.length > 1 ? s.name : file.name);
    groups.push(...r.groups);
    if (r.reason) reasons.push(sheets.length > 1 ? `${s.name}: ${r.reason}` : r.reason);
  }
  const csv = sheets.map((s) => (sheets.length > 1 ? `# Sheet: ${s.name}\n` : '') + gridToCsv(s.grid)).join('\n\n');
  return { groups, reason: groups.length ? null : reasons.join(' · '), aiInput: groups.length ? null : { raw_text: csv } };
}

// Pasted text runs through the same deterministic reader first.
export function readPastedText(text) {
  const { groups, reason } = groupsFromGrids(textToGrids(text), 'Pasted text');
  return { groups, reason, aiInput: groups.length ? null : { raw_text: text } };
}
