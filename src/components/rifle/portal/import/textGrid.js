// Text → grid helpers for the rifle score import. Everything that isn't a
// binary workbook (CSV, TSV, a paste straight out of Excel/Sheets, a .txt
// export, text pulled out of a PDF) goes through here before the shared
// header-detection in scoreGrid.js. Pure functions — no DOM, no network —
// so they're covered by import/scoreImport.test.js under `node --test`.

// Excel's "Unicode Text" export is UTF-16LE with a BOM; Windows CSV exports
// are often windows-1252. Decode by BOM first, then try strict UTF-8, then
// fall back to 1252 so "O’Brien" doesn't turn into mojibake or a throw.
export function decodeText(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (u8[0] === 0xff && u8[1] === 0xfe) return new TextDecoder('utf-16le').decode(u8.subarray(2));
  if (u8[0] === 0xfe && u8[1] === 0xff) return new TextDecoder('utf-16be').decode(u8.subarray(2));
  if (u8[0] === 0xef && u8[1] === 0xbb && u8[2] === 0xbf) return new TextDecoder('utf-8').decode(u8.subarray(3));
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(u8);
  } catch {
    return new TextDecoder('windows-1252').decode(u8);
  }
}

const DELIMITERS = ['\t', ',', ';', '|'];

// Pick the delimiter that splits the most lines into the same (>1) number of
// fields — a consistent column count beats a raw character count, which a
// name like "Smith, John" in a tab-separated paste would otherwise skew.
export function sniffDelimiter(text) {
  const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim()).slice(0, 40);
  if (!lines.length) return ',';
  let best = { delim: ',', score: -1 };
  for (const delim of DELIMITERS) {
    const counts = lines.map((l) => parseDelimited(l, delim)[0]?.length ?? 0);
    const freq = new Map();
    counts.forEach((c) => { if (c > 1) freq.set(c, (freq.get(c) || 0) + 1); });
    const top = Math.max(0, ...freq.values());
    // Tie-break toward tab: a paste from a spreadsheet is always tab-separated.
    const score = top + (delim === '\t' && top > 0 ? 0.5 : 0);
    if (score > best.score) best = { delim, score };
  }
  return best.delim;
}

// RFC 4180-ish: quoted fields, doubled quotes, embedded delimiters/newlines.
export function parseDelimited(text, delim) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"' && field.trim() === '') { field = ''; inQuotes = true; continue; }
    if (ch === delim) { row.push(field); field = ''; continue; }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
      continue;
    }
    field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.map((r) => r.map((c) => c.trim()));
}

// Ragged text copied out of a PDF or a fixed-width printout: columns are
// separated by runs of 2+ spaces (single spaces live inside names).
export function parseWhitespaceColumns(text) {
  return text
    .split(/\r\n|\n|\r/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split(/\s{2,}|\t/).map((c) => c.trim()));
}

export function textToGrids(text) {
  const clean = String(text || '').replace(/^﻿/, '');
  if (!clean.trim()) return [];
  const delim = sniffDelimiter(clean);
  const grids = [parseDelimited(clean, delim)];
  // Always offer the whitespace reading too; scoreGrid picks whichever one
  // actually yields a header row, so a wrong guess here costs nothing.
  grids.push(parseWhitespaceColumns(clean));
  return grids;
}

// Inverse, for the audit record + the AI fallback: grid → CSV text.
export function gridToCsv(grid) {
  return grid
    .map((row) => row.map((v) => {
      const s = v == null ? '' : String(v);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(','))
    .filter((line) => line.replace(/,/g, '').trim())
    .join('\n');
}
