// Review-stage logic for imported score rows: roster matching, editable
// drafts (string-backed so "98." can be typed on the way to "98.5"),
// validation, and the final numeric rows that get written. Pure — tested by
// import/scoreImport.test.js.

import { POSITION_FIELDS, SCORE_FIELDS } from './scoreGrid.js';

export const POSITION_MAX = 109;   // decimal scoring: 10 shots × 10.9
export const POSITION_TYPICAL = 100;
export const TOTAL_MAX = POSITION_MAX * 3;
export const BULLS_MAX = 120;
const TOTAL_TOLERANCE = 0.15;

// ── Roster matching ──────────────────────────────────────────────────────
// "O’Brien, Aiden J." → "aiden obrien": accents, punctuation and middle
// initials dropped, "Last, First" flipped.
export function normalizeName(raw) {
  let s = String(raw ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const comma = s.match(/^([^,]+),\s*(.+)$/);
  if (comma) s = `${comma[2]} ${comma[1]}`;
  s = s.replace(/['’`.]/g, '').replace(/[^a-z\s-]/g, ' ').replace(/-/g, ' ');
  const tokens = s.split(/\s+/).filter(Boolean);
  // Drop middle initials ("aiden j obrien"), but keep a leading initial in
  // a two-token "j smith" so the initial+last-name match below can use it.
  return (tokens.length > 2 ? tokens.filter((t, i) => t.length > 1 || i === 0) : tokens).join(' ');
}

function levenshtein(a, b) {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = a[i - 1] === b[j - 1] ? diag : 1 + Math.min(diag, prev[j], prev[j - 1]);
      diag = tmp;
    }
  }
  return prev[b.length];
}

const sortedTokens = (s) => s.split(' ').sort().join(' ');

// Returns { name, how } or null. Only commits to a match when it's
// unambiguous — two roster names equally close means a human picks.
export function matchRoster(rawName, rosterNames) {
  const target = normalizeName(rawName);
  if (!target) return null;
  const roster = rosterNames.map((name) => ({ name, norm: normalizeName(name) }));

  const exact = roster.filter((r) => r.norm === target);
  if (exact.length === 1) return { name: exact[0].name, how: 'exact' };

  const tSorted = sortedTokens(target);
  const swapped = roster.filter((r) => sortedTokens(r.norm) === tSorted);
  if (swapped.length === 1) return { name: swapped[0].name, how: 'exact' };

  // "J Smith" / "Smith J" → unique first-initial + last-name hit.
  const tTokens = target.split(' ');
  if (tTokens.length === 2) {
    const initialHits = roster.filter((r) => {
      const rt = r.norm.split(' ');
      if (rt.length < 2) return false;
      const [rf, rl] = [rt[0], rt[rt.length - 1]];
      return tTokens.some((tok, i) => tok === rl && tTokens[1 - i][0] === rf[0] && tTokens[1 - i].length <= 2);
    });
    if (initialHits.length === 1) return { name: initialHits[0].name, how: 'fuzzy' };
  }

  // Typos: edit distance on the normalized string.
  const threshold = target.length > 10 ? 2 : target.length > 4 ? 1 : 0;
  let best = null;
  let tie = false;
  for (const r of roster) {
    const d = Math.min(levenshtein(target, r.norm), levenshtein(tSorted, sortedTokens(r.norm)));
    if (!best || d < best.d) { best = { name: r.name, d }; tie = false; } else if (d === best.d) tie = true;
  }
  if (best && best.d <= threshold && !tie) return { name: best.name, how: 'fuzzy' };

  // Last name only ("Garcia") when exactly one roster shooter has it.
  if (tTokens.length === 1) {
    const last = roster.filter((r) => r.norm.split(' ').slice(-1)[0] === target);
    if (last.length === 1) return { name: last[0].name, how: 'fuzzy' };
  }
  return null;
}

// ── Drafts ───────────────────────────────────────────────────────────────
const str = (v) => (v == null || v === '' ? '' : String(v));
let draftSeq = 0;

// Parsed (or AI) row → editable draft. Unmatched names default to excluded
// when there IS a roster — a match-results sheet usually lists other
// schools' shooters too, and silently creating them as team members was
// the old behaviour's worst failure mode.
export function toDraft(row, rosterNames) {
  const presetName = row.matched_shooter_name && rosterNames.includes(row.matched_shooter_name) ? row.matched_shooter_name : null;
  const m = presetName ? { name: presetName, how: 'exact' } : matchRoster(row.raw_name, rosterNames);
  return {
    key: `d${++draftSeq}`,
    raw_name: str(row.raw_name).trim(),
    name: m?.name || '',
    how: m?.how || null,
    include: !!m || rosterNames.length === 0,
    prone: str(row.prone), standing: str(row.standing), kneeling: str(row.kneeling),
    total: str(row.total), bulls: str(row.bulls),
    flags: row.flags || [],
  };
}

// A whole batch at once. When most rows match the roster exactly it's our
// own sheet, so fuzzy hits are probably typos and stay ticked; when exact
// hits are rare (a meet results sheet full of other schools) a fuzzy hit is
// as likely to be a different kid with a similar name, so it starts unticked.
export const OWN_SHEET_EXACT_RATIO = 0.6;
export function toDrafts(rows, rosterNames) {
  const drafts = rows.map((r) => toDraft(r, rosterNames));
  const exact = drafts.filter((d) => d.how === 'exact').length;
  if (!drafts.length || exact / drafts.length >= OWN_SHEET_EXACT_RATIO) return drafts;
  return drafts.map((d) => (d.how === 'fuzzy' ? { ...d, include: false } : d));
}

function num(s) {
  const t = String(s ?? '').trim().replace(',', '.');
  if (!t) return { empty: true };
  if (!/^-?\d+(\.\d*)?$|^-?\.\d+$/.test(t)) return { bad: true };
  return { value: Number(t) };
}

const r1 = (n) => Math.round(n * 10) / 10;

export function targetName(d) {
  return (d.name || d.raw_name || '').trim();
}

// ── Validation ───────────────────────────────────────────────────────────
// Returns { rows: Map(key → [{level, text}]), batch: [...], errorCount, includedCount }.
export function validateDrafts(drafts, rosterNames) {
  const rosterLower = new Set(rosterNames.map((n) => n.toLowerCase()));
  const rows = new Map();
  const batch = [];
  let errorCount = 0;
  const seen = new Map();
  const included = drafts.filter((d) => d.include);

  for (const d of included) {
    const issues = [];
    const add = (level, text) => { issues.push({ level, text }); if (level === 'error') errorCount++; };
    const name = targetName(d);
    if (!name) add('error', 'Needs a shooter name');
    else {
      const lower = name.toLowerCase();
      if (seen.has(lower)) add('error', `Same shooter as row "${seen.get(lower)}"`);
      else seen.set(lower, d.raw_name || name);
      if (!rosterLower.has(lower)) add('info', 'Not on roster — will be added as a new shooter');
    }

    const vals = {};
    for (const f of SCORE_FIELDS) {
      const p = num(d[f]);
      if (p.bad) add('error', `${f} "${d[f]}" isn't a number`);
      vals[f] = p.value ?? null;
    }
    POSITION_FIELDS.forEach((f) => {
      const v = vals[f];
      if (v == null) return;
      if (v < 0 || v > POSITION_MAX) add('error', `${f} ${v} is outside 0–${POSITION_MAX}`);
      else if (v > POSITION_TYPICAL) add('warn', `${f} ${v} is above 100 — decimal scoring?`);
    });
    if (vals.total != null && (vals.total < 0 || vals.total > TOTAL_MAX)) add('error', `total ${vals.total} is outside 0–${TOTAL_MAX}`);
    if (vals.bulls != null && (!Number.isInteger(vals.bulls) || vals.bulls < 0 || vals.bulls > BULLS_MAX)) add('error', `X count ${vals.bulls} must be a whole number 0–${BULLS_MAX}`);

    const allPos = POSITION_FIELDS.every((f) => vals[f] != null);
    if (allPos && vals.total != null && Math.abs(r1(vals.prone + vals.standing + vals.kneeling) - vals.total) > TOTAL_TOLERANCE) {
      add('warn', `total ${vals.total} ≠ P+S+K (${r1(vals.prone + vals.standing + vals.kneeling)})`);
    }
    if (SCORE_FIELDS.every((f) => vals[f] == null)) add('error', 'No scores on this row');
    else if (!allPos && vals.total == null) add('warn', 'Missing positions — stats use P+S+K');
    (d.flags || []).forEach((t) => add('warn', t));
    rows.set(d.key, issues);
  }

  if (!included.length) batch.push({ level: 'error', text: 'No rows selected to publish.' });
  const unmatchedExcluded = drafts.filter((d) => !d.include && !d.name).length;
  if (unmatchedExcluded) batch.push({ level: 'info', text: `${unmatchedExcluded} row${unmatchedExcluded === 1 ? '' : 's'} not on the roster ${unmatchedExcluded === 1 ? 'is' : 'are'} unticked — tick to import as new shooters.` });
  const fuzzyExcluded = drafts.filter((d) => !d.include && d.name && d.how === 'fuzzy').length;
  if (fuzzyExcluded) batch.push({ level: 'warn', text: `${fuzzyExcluded} close-but-not-exact name match${fuzzyExcluded === 1 ? ' is' : 'es are'} unticked — check the name and tick if it's really our shooter.` });
  return { rows, batch, errorCount: errorCount + batch.filter((b) => b.level === 'error').length, includedCount: included.length };
}

// ── Final rows ───────────────────────────────────────────────────────────
// Included drafts → numeric rows. Total is filled from P+S+K when the sheet
// left it blank, so the stored total always agrees with what stats compute.
export function finalizeDrafts(drafts) {
  return drafts.filter((d) => d.include).map((d) => {
    const out = { name: targetName(d), raw_name: d.raw_name };
    for (const f of SCORE_FIELDS) {
      const p = num(d[f]);
      out[f] = p.value == null ? null : f === 'bulls' ? Math.round(p.value) : r1(p.value);
    }
    if (out.total == null && POSITION_FIELDS.every((f) => out[f] != null)) out.total = r1(out.prone + out.standing + out.kneeling);
    return out;
  });
}

// Draft rows in the shape rifle_comp_uploads.draft.rows has always used, so
// Comp Upload history keeps rendering old and new uploads the same way.
export function draftsToUploadRows(drafts) {
  return finalizeDrafts(drafts).map((r) => ({
    raw_name: r.raw_name || r.name, matched_shooter_name: r.name,
    prone: r.prone, standing: r.standing, kneeling: r.kneeling, total: r.total, bulls: r.bulls,
  }));
}

// Compare against what's already stored for the match: 'new' | 'same' | 'update'.
export function diffAgainstExisting(finalRow, existing) {
  if (!existing) return 'new';
  const changed = SCORE_FIELDS.some((f) => finalRow[f] != null && Number(existing[f]) !== finalRow[f]);
  return changed ? 'update' : 'same';
}
