// Company promotion boards — the rules from the paper board sheet, in one
// place. Mirrored server-side by board_validate_sheet() in
// supabase/company_boards.sql; if a rule changes here it MUST change there too
// (the database is what actually enforces it, this module drives the UI).

/** The five scored categories, in paper-sheet order. Each is scored 0–3. */
export const CATEGORIES = [
  { key: 'score_facing',  label: 'Facing Movements', sub: 'Left, Right, About' },
  { key: 'score_creed',   label: 'Cadet Creed',      sub: 'Recited from memory' },
  { key: 'score_uniform', label: 'Wear of Uniform',  sub: 'Khakis + polo, worn to standard' },
  { key: 'score_jrotc',   label: 'JROTC Knowledge',  sub: 'Program, chain of command, history' },
  { key: 'score_class',   label: 'Class Knowledge',  sub: 'Current LET curriculum' },
];

export const MAX_PER_CATEGORY = 3;
export const MAX_TOTAL = CATEGORIES.length * MAX_PER_CATEGORY;

/**
 * Every rank a cadet can hold, low → high. `ladder` is the comparable
 * position; enlisted promotions only ever move along the PVT→MSG track.
 */
export const RANKS = [
  { code: 'PVT', name: 'Private',                  ladder: 0,  kind: 'enlisted' },
  { code: 'PV2', name: 'Private Second Class',     ladder: 1,  kind: 'enlisted' },
  { code: 'PFC', name: 'Private First Class',      ladder: 2,  kind: 'enlisted' },
  { code: 'CPL', name: 'Corporal',                 ladder: 3,  kind: 'enlisted' },
  { code: 'SGT', name: 'Sergeant',                 ladder: 4,  kind: 'enlisted' },
  { code: 'SSG', name: 'Staff Sergeant',           ladder: 5,  kind: 'enlisted' },
  { code: 'SFC', name: 'Sergeant First Class',     ladder: 6,  kind: 'enlisted' },
  { code: 'MSG', name: 'Master Sergeant',          ladder: 7,  kind: 'enlisted' },
  { code: '1SG', name: 'First Sergeant',           ladder: 7,  kind: 'enlisted' },
  { code: 'SGM', name: 'Sergeant Major',           ladder: 8,  kind: 'enlisted' },
  { code: 'CSM', name: 'Command Sergeant Major',   ladder: 8,  kind: 'enlisted' },
  { code: '2LT', name: 'Second Lieutenant',        ladder: 9,  kind: 'officer' },
  { code: '1LT', name: 'First Lieutenant',         ladder: 10, kind: 'officer' },
  { code: 'CPT', name: 'Captain',                  ladder: 11, kind: 'officer' },
  { code: 'MAJ', name: 'Major',                    ladder: 12, kind: 'officer' },
  { code: 'LTC', name: 'Lieutenant Colonel',       ladder: 13, kind: 'officer' },
  { code: 'COL', name: 'Colonel',                  ladder: 14, kind: 'officer' },
];

/** The "Promote to:" row printed on the paper sheet. */
export const PROMOTABLE = ['PV2', 'PFC', 'CPL', 'SGT', 'SSG', 'SFC', 'MSG'];

/** MAX RANKS box on the paper sheet. */
export const MAX_RANK_BY_LET = { 1: 'CPL', 2: 'SSG', 3: 'SFC', 4: 'MSG' };

/**
 * Minimum total to promote. Leadership-only information — the UI must never
 * print these numbers where a cadet could read them (BC directive).
 */
export const MIN_SCORE_BY_LET = { 1: 10, 2: 12, 3: 12, 4: 12 };

const RANK_BY_CODE = Object.fromEntries(RANKS.map((r) => [r.code, r]));

/** @param {string | null | undefined} code */
export function rankInfo(code) {
  return code ? RANK_BY_CODE[code] ?? null : null;
}

/** '3', 'LET 3', 3 → 3. Anything unparseable → null. */
export function normalizeLet(letLevel) {
  const n = parseInt(String(letLevel ?? '').replace(/\D/g, ''), 10);
  return n >= 1 && n <= 4 ? n : null;
}

/**
 * Maps the free-text leadership titles already stored in
 * cadet_consent.role ("First Lieutenant", "Cadet Lieutenant colonel") onto a
 * rank code, so leaders don't have to be re-entered by hand.
 */
export function rankFromRoleTitle(title) {
  const t = String(title ?? '').toLowerCase().replace(/^cadet\s+/, '').trim();
  const match = RANKS.find((r) => r.name.toLowerCase() === t);
  return match ? match.code : null;
}

/** @param {Record<string, number | null | undefined>} scores */
export function totalScore(scores) {
  return CATEGORIES.reduce((sum, c) => sum + (Number.isInteger(scores?.[c.key]) ? scores[c.key] : 0), 0);
}

/** @param {Record<string, number | null | undefined>} scores */
export function allScored(scores) {
  return CATEGORIES.every((c) => Number.isInteger(scores?.[c.key]));
}

/**
 * Ranks the board may promote this cadet to: strictly above their current
 * rank, at or below their LET's max, and only from the sheet's printed row.
 * An unknown current rank is treated as PVT.
 */
export function promotionOptions(currentRank, letLevel) {
  const let_ = normalizeLet(letLevel);
  if (!let_) return [];
  const maxLadder = rankInfo(MAX_RANK_BY_LET[let_]).ladder;
  const fromLadder = rankInfo(currentRank)?.ladder ?? 0;
  return PROMOTABLE.filter((code) => {
    const l = rankInfo(code).ladder;
    return l > fromLadder && l <= maxLadder;
  });
}

/**
 * Whether a cadet can be promoted on this sheet, and if not, why. The reason
 * strings are safe to show a cadet: they never reveal the minimum score.
 */
export function promotionEligibility({ scores, currentRank, letLevel }) {
  const let_ = normalizeLet(letLevel);
  if (!let_) return { eligible: false, reason: 'LET level missing — fix it on the roster first' };
  if (!currentRank) return { eligible: false, reason: 'Enter current rank first' };
  if (!allScored(scores)) return { eligible: false, reason: 'Score all five categories' };
  if (promotionOptions(currentRank, let_).length === 0) {
    return { eligible: false, reason: `Already at or above the LET ${let_} maximum` };
  }
  if (totalScore(scores) < MIN_SCORE_BY_LET[let_]) {
    return { eligible: false, reason: 'Does not meet the board standard' };
  }
  return { eligible: true, reason: null };
}

/** Next rank up within the LET cap — the board's default pick. */
export function defaultPromotion(currentRank, letLevel) {
  return promotionOptions(currentRank, letLevel)[0] ?? null;
}

/** e.g. "2026-27 Q2". Quarters follow the school year (Aug start). */
export function quarterLabel(date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth(); // 0 = Jan
  const startYear = m >= 7 ? y : y - 1;
  const q = m >= 7 && m <= 9 ? 1 : (m >= 10 || m === 0) ? 2 : m <= 3 ? 3 : 4;
  return `${startYear}-${String(startYear + 1).slice(2)} Q${q}`;
}

export const COMPANIES = ['alpha', 'bravo', 'charlie', 'delta'];

export const BOARD_ROLES = {
  '1sg': { label: 'First Sergeant',    short: '1SG',   order: 0 },
  xo:    { label: 'Executive Officer', short: 'XO',    order: 1 },
  co:    { label: 'Company Commander', short: 'CMMDR', order: 2 },
};

/** Signing order on the paper sheet: 1SG, then XO, then CMMDR. */
export const SIGN_ORDER = ['1sg', 'xo', 'co'];
