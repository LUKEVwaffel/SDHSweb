// Deterministic score-sheet reader. Takes a 2-D grid (one sheet of a
// workbook, or a parsed CSV/paste) and finds the shooter rows by reading the
// sheet's own headers — no AI guess involved. Handles the layouts the team
// actually gets:
//   • flat table      Name | Prone | Standing | Kneeling | Total | X
//   • split names     First | Last | ...
//   • season workbook Name | (P S K Total X) × N weeks, with an optional
//                     "Week 3" label row above each group
//   • series columns  Prone 1 | Prone 2 | ... (summed into one position)
//   • long format     Name | Position | Score | X  (one row per position)
//   • header not on row 1, stacked sections that repeat the header,
//     "96-4X" style cells, DNS/DNF markers, team-total / average rows
// Returns { groups: [{ label, week, rows: [...] }], reason } — reason is a
// plain-English explanation when nothing was found, for the UI.

export const POSITION_FIELDS = ['prone', 'standing', 'kneeling'];
export const SCORE_FIELDS = [...POSITION_FIELDS, 'total', 'bulls'];

const ALIASES = {
  name: ['name', 'names', 'shooter', 'shooters', 'shootername', 'competitor', 'competitorname', 'athlete', 'athletename',
    'cadet', 'cadetname', 'firer', 'participant', 'fullname', 'student', 'member', 'marksman', 'individual'],
  first: ['first', 'firstname', 'fname', 'givenname'],
  last: ['last', 'lastname', 'lname', 'surname', 'familyname'],
  prone: ['prone', 'pr', 'prn', 'pro', 'p'],
  standing: ['standing', 'stand', 'st', 'std', 'stnd', 's'],
  kneeling: ['kneeling', 'kneel', 'kn', 'kng', 'knl', 'k'],
  total: ['total', 'totals', 'overall', 'overallscore', 'aggregate', 'agg', 'score', 'scores', 'totalscore', 'final',
    'finalscore', 'grandtotal', 'sum', 'matchtotal', 'individualtotal', 'indtotal', 'result'],
  bulls: ['bulls', 'bull', 'bullseye', 'bullseyes', 'x', 'xs', 'xcount', 'xcnt', 'totalx', 'totalxs', 'inner10',
    'inner10s', 'innertens', 'centers', 'centres', 'tenx'],
  position: ['position', 'stage', 'discipline', 'event', 'string', 'pos'],
};
const ALIAS_TO_FIELD = new Map();
Object.entries(ALIASES).forEach(([field, list]) => list.forEach((a) => ALIAS_TO_FIELD.set(a, field)));

const POSITION_VALUE = { prone: 'prone', p: 'prone', pr: 'prone', standing: 'standing', stand: 'standing', s: 'standing', st: 'standing', kneeling: 'kneeling', kneel: 'kneeling', k: 'kneeling', kn: 'kneeling' };

const SUMMARY_NAME = /^(team|teams|total|totals|grand total|average|avg|mean|median|top\s*\d+|top four|sum|notes?|comments?|legend|squad|relay)\b/i;
const NON_SCORE = /^(dns|dnf|dq|dsq|abs|absent|na|n\/a|-+|—|–|x+)$/i;

const keyOf = (s) => String(s ?? '').toLowerCase().replace(/['’`]/g, '').replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9]+/g, '');

// One header cell → { field, week, series } or null.
export function parseHeaderCell(raw) {
  let s = String(raw ?? '').trim();
  if (!s) return null;
  let week = null;
  const wk = s.match(/\b(?:week|wk)\s*#?\s*(\d{1,2})\b/i);
  if (wk) { week = Number(wk[1]); s = s.replace(wk[0], ' '); }
  const key = keyOf(s);
  if (!key) return null;
  if (ALIAS_TO_FIELD.has(key)) return { field: ALIAS_TO_FIELD.get(key), week, series: false, weak: key.length === 1 };
  // "Prone 1", "Prone2", "Prone Series 2", "S1" → series column of that field.
  const m = key.match(/^([a-z]+?)(?:series|ser|string)?(\d{1,2})$/);
  if (m && ALIAS_TO_FIELD.has(m[1])) {
    const field = ALIAS_TO_FIELD.get(m[1]);
    if (POSITION_FIELDS.includes(field) || field === 'bulls') return { field, week, series: true, weak: m[1].length === 1 };
  }
  return null;
}

// Number from a cell, plus an embedded X count for "96-4X" / "96 (4x)".
export function parseScoreCell(v) {
  if (v === null || v === undefined || v === '') return { value: null };
  if (typeof v === 'number') return Number.isFinite(v) ? { value: v } : { value: null };
  const s = String(v).trim().replace(/[*†‡]+$/, '').replace(/^\+/, '');
  if (!s || NON_SCORE.test(s)) return { value: null, marker: s || null };
  if (/^-?\d+(\.\d+)?$/.test(s)) return { value: Number(s) };
  if (/^-?\d+,\d$/.test(s)) return { value: Number(s.replace(',', '.')) }; // "87,6" decimal comma
  const withX = s.match(/^(\d+(?:\.\d+)?)\s*(?:[-–/]\s*(\d+)\s*x|\(\s*(\d+)\s*x?\s*\))$/i);
  if (withX) return { value: Number(withX[1]), x: Number(withX[2] ?? withX[3]) };
  return { value: null, junk: s };
}

function headerScore(row) {
  let score = 0;
  let strongScoreFields = 0;
  let hasName = false;
  const seen = new Set();
  for (const cell of row) {
    const h = parseHeaderCell(cell);
    if (!h) continue;
    if (h.field === 'name' || h.field === 'first' || h.field === 'last') { hasName = true; score += 2; continue; }
    if (h.field === 'position') { score += 1; continue; }
    if (!seen.has(h.field)) { seen.add(h.field); score += h.weak ? 1 : 2; if (!h.weak) strongScoreFields++; }
  }
  return { score, scoreFields: seen.size, strongScoreFields, hasName };
}

function isHeaderLike(row) {
  const { score, scoreFields } = headerScore(row);
  return scoreFields >= 1 && score >= 4;
}

function findHeaderRow(grid) {
  let best = null;
  const limit = Math.min(grid.length, 30);
  for (let r = 0; r < limit; r++) {
    const hs = headerScore(grid[r] || []);
    if (hs.scoreFields === 0) continue;
    // Needs a real (non single-letter) score header or a name header —
    // a data row with "S"/"P" class codes must not win.
    if (!hs.strongScoreFields && !hs.hasName) continue;
    if (!best || hs.score > best.score) best = { row: r, ...hs };
  }
  return best;
}

const cellText = (v) => (v == null ? '' : String(v).trim());
const looksNumeric = (v) => typeof v === 'number' || /^[-+]?\d+([.,]\d+)?$/.test(cellText(v));

// Name column when the header doesn't say "Name": the left-most column, before
// the first score column, whose data cells are mostly words.
function inferNameCol(grid, headerRow, firstScoreCol) {
  for (let c = 0; c < firstScoreCol; c++) {
    let text = 0; let filled = 0;
    for (let r = headerRow + 1; r < Math.min(grid.length, headerRow + 40); r++) {
      const v = cellText(grid[r]?.[c]);
      if (!v) continue;
      filled++;
      if (!looksNumeric(v) && /[a-z]/i.test(v)) text++;
    }
    if (filled && text / filled >= 0.6) return c;
  }
  return null;
}

function buildColumns(header) {
  const nameCols = { name: null, first: null, last: null };
  const scoreCols = [];
  let positionCol = null;
  header.forEach((cell, col) => {
    const h = parseHeaderCell(cell);
    if (!h) return;
    if (h.field === 'name' || h.field === 'first' || h.field === 'last') {
      if (nameCols[h.field] == null) nameCols[h.field] = col;
      return;
    }
    if (h.field === 'position') { if (positionCol == null) positionCol = col; return; }
    scoreCols.push({ col, field: h.field, week: h.week, series: h.series, raw: cellText(cell) });
  });
  return { nameCols, scoreCols, positionCol };
}

// Merge series columns (Prone 1 + Prone 2 …) into one summed slot, then cut
// the column run into groups: a field repeating, or the week marker
// changing, starts the next group (season workbook = one group per week).
function groupScoreCols(scoreCols) {
  const merged = [];
  for (const c of scoreCols) {
    const prev = merged[merged.length - 1];
    if (prev && prev.field === c.field && c.series && prev.series && prev.week === c.week) {
      prev.cols.push(c.col);
      continue;
    }
    merged.push({ field: c.field, week: c.week, series: c.series, cols: [c.col] });
  }
  const groups = [];
  let cur = null;
  for (const m of merged) {
    const weekChanged = cur && m.week != null && cur.week != null && m.week !== cur.week;
    if (!cur || cur.fields[m.field] || weekChanged) {
      cur = { week: m.week, fields: {}, firstCol: m.cols[0], lastCol: m.cols[m.cols.length - 1] };
      groups.push(cur);
    }
    cur.fields[m.field] = m.cols;
    if (cur.week == null && m.week != null) cur.week = m.week;
    cur.lastCol = m.cols[m.cols.length - 1];
  }
  return groups;
}

// "Week 3" / "WK 3 — vs Bay" labels sitting in the rows above the header.
// A "Week N" cell wins; for the first group that includes a sheet title in
// column A ("Match results — Week 3" above a flat table). Otherwise the
// first text sitting over the group's own columns becomes its label.
const WEEK_RE = /\b(?:week|wk)\s*#?\s*(\d{1,2})\b/i;
function labelGroups(grid, headerRow, groups) {
  const rows = [];
  for (let r = Math.max(0, headerRow - 3); r < headerRow; r++) rows.push(grid[r] || []);
  groups.forEach((g, gi) => {
    const stop = gi + 1 < groups.length ? groups[gi + 1].firstCol : Infinity;
    const scan = (from, pick) => {
      for (const row of rows) {
        const end = Math.min(row.length, Math.max(stop, from + 1));
        for (let c = from; c < end; c++) {
          const t = cellText(row[c]);
          if (t && pick(t)) return t;
        }
      }
      return null;
    };
    const weekLabel = scan(gi === 0 ? 0 : g.firstCol, (t) => WEEK_RE.test(t));
    const label = weekLabel || scan(g.firstCol, () => true);
    if (!label) return;
    g.label = label;
    const wk = label.match(WEEK_RE);
    if (wk && g.week == null) g.week = Number(wk[1]);
  });
}

function rowName(row, nameCols, inferredCol) {
  if (nameCols.name != null) return cellText(row[nameCols.name]);
  if (nameCols.first != null || nameCols.last != null) {
    return [cellText(row[nameCols.first]), cellText(row[nameCols.last])].filter(Boolean).join(' ');
  }
  return inferredCol != null ? cellText(row[inferredCol]) : '';
}

function skipName(name) {
  if (!name) return true;
  if (name.startsWith('#')) return true;
  if (!/[a-z]/i.test(name)) return true; // "1", "—", "123.4"
  if (SUMMARY_NAME.test(name)) return true;
  return false;
}

const round1 = (n) => Math.round(n * 10) / 10;

function readGroup(row, g) {
  const out = {};
  const flags = [];
  let embeddedX = 0;
  let sawX = false;
  let hasAny = false;
  for (const field of SCORE_FIELDS) {
    const cols = g.fields[field];
    if (!cols) { out[field] = null; continue; }
    let sum = null;
    for (const col of cols) {
      const p = parseScoreCell(row[col]);
      if (p.junk) flags.push(`${field}: "${p.junk}" isn't a number`);
      if (p.marker) flags.push(`${field}: ${p.marker}`);
      if (p.x != null) { embeddedX += p.x; sawX = true; }
      if (p.value != null) sum = (sum ?? 0) + p.value;
    }
    out[field] = sum == null ? null : round1(sum);
    if (sum != null) hasAny = true;
  }
  if (out.bulls == null && sawX) out.bulls = embeddedX;
  return { values: out, hasAny, flags };
}

function extractLongFormat(grid, headerRow, cols, inferredNameCol) {
  const scoreCol = cols.scoreCols.find((c) => c.field === 'total')?.col
    ?? cols.scoreCols.find((c) => POSITION_FIELDS.includes(c.field))?.col;
  const xCol = cols.scoreCols.find((c) => c.field === 'bulls')?.col;
  if (scoreCol == null) return null;
  const byName = new Map();
  let recognized = 0;
  for (let r = headerRow + 1; r < grid.length; r++) {
    const row = grid[r] || [];
    if (isHeaderLike(row)) continue;
    const name = rowName(row, cols.nameCols, inferredNameCol);
    if (skipName(name)) continue;
    const pos = POSITION_VALUE[keyOf(row[cols.positionCol])];
    if (!pos) continue;
    recognized++;
    const p = parseScoreCell(row[scoreCol]);
    const x = xCol != null ? parseScoreCell(row[xCol]) : { value: p.x ?? null };
    const key = name.toLowerCase();
    const entry = byName.get(key) || { raw_name: name, prone: null, standing: null, kneeling: null, total: null, bulls: null, flags: [], source_row: r + 1 };
    if (p.value != null) entry[pos] = round1((entry[pos] ?? 0) + p.value);
    const xv = x.value ?? p.x;
    if (xv != null) entry.bulls = (entry.bulls ?? 0) + xv;
    byName.set(key, entry);
  }
  if (!recognized) return null;
  return [{ label: null, week: null, rows: [...byName.values()] }];
}

export function extractScoreTables(grid) {
  if (!Array.isArray(grid) || !grid.length) return { groups: [], reason: 'The sheet is empty.' };
  const header = findHeaderRow(grid);
  if (!header) {
    return { groups: [], reason: 'No header row found — expected a row with a name column and Prone / Standing / Kneeling / Total (or X) columns.' };
  }
  const cols = buildColumns(grid[header.row]);
  const firstScoreCol = cols.scoreCols.length ? cols.scoreCols[0].col : 0;
  const hasNameHeader = Object.values(cols.nameCols).some((c) => c != null);
  const inferredNameCol = hasNameHeader ? null : inferNameCol(grid, header.row, Math.max(firstScoreCol, cols.positionCol ?? 0));
  if (!hasNameHeader && inferredNameCol == null) {
    return { groups: [], reason: 'Found score columns but no shooter name column.' };
  }

  const hasPositionCols = cols.scoreCols.some((c) => POSITION_FIELDS.includes(c.field));
  if (cols.positionCol != null && !hasPositionCols) {
    const long = extractLongFormat(grid, header.row, cols, inferredNameCol);
    if (long) return { groups: long.filter((g) => g.rows.length), reason: null, headerRow: header.row };
  }

  const groups = groupScoreCols(cols.scoreCols);
  if (!groups.length) return { groups: [], reason: 'Found a name column but no score columns.' };
  labelGroups(grid, header.row, groups);

  const out = groups.map((g, i) => ({ label: g.label || null, week: g.week ?? null, index: i + 1, rows: [] }));
  for (let r = header.row + 1; r < grid.length; r++) {
    const row = grid[r] || [];
    if (isHeaderLike(row)) continue; // stacked sections repeat the header
    const name = rowName(row, cols.nameCols, inferredNameCol);
    if (skipName(name)) continue;
    groups.forEach((g, gi) => {
      const { values, hasAny, flags } = readGroup(row, g);
      if (!hasAny) return;
      out[gi].rows.push({ raw_name: name, ...values, flags, source_row: r + 1 });
    });
  }
  const nonEmpty = out.filter((g) => g.rows.length);
  return {
    groups: nonEmpty,
    reason: nonEmpty.length ? null : 'Found the header row, but no shooter rows with numbers under it.',
    headerRow: header.row,
  };
}
