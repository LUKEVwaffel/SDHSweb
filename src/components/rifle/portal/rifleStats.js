// Shared score-derivation helpers for the Range Ops redesign (Dashboard,
// Scores Editor, Shooter Profile, Lineup & Rankings all need the same
// per-shooter / per-match aggregates — computed once here instead of four
// slightly-different reimplementations).

// Who may start a new comp-score upload (paste-parse or spreadsheet import)
// — narrower than is_rifle_admin()/is_s6(), by the coach's own request: only
// the two people who actually maintain the season workbook. Mirrored
// server-side in rifle-comp-parse and rifle-xlsx-parse's UPLOAD_ALLOWLIST —
// this one only drives UI visibility, the edge functions are the real gate.
export const RIFLE_UPLOAD_ALLOWLIST = [
  'lukevetsch77@gmail.com',
  // TODO: add Kaz's email here.
];

export function seasonOf(match) {
  const m = (match?.dates || '').match(/\b(20\d{2})\b/);
  return m ? m[1] : 'Undated';
}

// School-year grouping ("2026-2027"), not a single calendar year — the team's
// season runs fall through spring, so a match dated e.g. 2027-02-15 belongs
// to the SAME season as one dated 2026-08-01. A bare year regex (seasonOf,
// above — kept for the places that just want a label) would wrongly split
// a season's second half into the next calendar year's bucket.
//
// Real rifle_matches.dates isn't ISO — it's a week range like
// "1/26–2/1, 2026" (M/D–M/D, YYYY). Only falls back to "assume fall" when
// no month can be found at all, which used to silently miscategorize every
// Jan-Jun match (no explicit month match => defaulted to September) into
// the WRONG season, one year too late.
export function schoolYearOf(match) {
  const raw = match?.dates || '';
  const iso = raw.match(/\b(20\d{2})-(\d{2})-\d{2}\b/);
  let year;
  let month;
  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
  } else {
    const y = raw.match(/\b(20\d{2})\b/);
    if (!y) return 'Undated';
    year = Number(y[1]);
    const md = raw.match(/\b(\d{1,2})\s*\/\s*\d{1,2}\b/); // leading "M/D" of a range like "1/26–2/1, 2026"
    month = md ? Number(md[1]) : 9; // no month found anywhere — last-resort assume fall
  }
  const startYear = month >= 7 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}

// The school-year label a real calendar date falls in "right now" — used to
// pick a sensible default season in the picker.
export function currentSchoolYear(now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const startYear = month >= 7 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}

// "2026-2027" -> "2025-2026" — the season immediately before a given one,
// for the Shooter Profile's this-season-vs-last comparison.
export function previousSchoolYear(season) {
  const m = String(season || '').match(/^(\d{4})-\d{4}$/);
  if (!m) return null;
  const startYear = Number(m[1]) - 1;
  return `${startYear}-${startYear + 1}`;
}

export function num(v) {
  return v === '' || v == null || Number.isNaN(+v) ? 0 : +v;
}

export function round1(n) {
  return Math.round(n * 10) / 10;
}

// Rounded at the source — raw float addition of DB decimals (e.g. 96.5 +
// 84.2 + 91.3) produces binary-float noise like 271.90000000000003, and
// every KPI/aggregate/leaderboard in the redesign is built on this value.
// Fixing it once here beats chasing every render-site call.
export function scoreTotal(sc) {
  return round1(num(sc?.prone) + num(sc?.standing) + num(sc?.kneeling));
}

export function avgOf(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

// One row per shooter: { shooterId, rows, avg, pr, last, last3, trend, prone, standing, kneeling, bulls, n }
// `rows` is every played match this shooter has a score for, oldest first.
export function perShooterStats(shooters, matches, scores) {
  const byMatch = new Map(matches.map((m) => [m.id, m]));
  const out = new Map();
  for (const s of shooters) {
    const mine = scores
      .filter((sc) => sc.shooter_id === s.id && byMatch.has(sc.match_id))
      .map((sc) => ({ score: sc, match: byMatch.get(sc.match_id), total: scoreTotal(sc) }))
      .sort((a, b) => (a.match.week ?? 0) - (b.match.week ?? 0));
    const tots = mine.map((r) => r.total);
    out.set(s.id, {
      shooterId: s.id,
      rows: mine,
      n: mine.length,
      avg: avgOf(tots),
      pr: tots.length ? Math.max(...tots) : 0,
      last: tots.length ? tots[tots.length - 1] : 0,
      last3: avgOf(tots.slice(-3)),
      first3: avgOf(tots.slice(0, 3)),
      trend: avgOf(tots.slice(-3)) - avgOf(tots.slice(0, 3)),
      prone: avgOf(mine.map((r) => num(r.score.prone))),
      standing: avgOf(mine.map((r) => num(r.score.standing))),
      kneeling: avgOf(mine.map((r) => num(r.score.kneeling))),
      bulls: avgOf(mine.map((r) => num(r.score.bulls))),
      prProne: mine.length ? Math.max(...mine.map((r) => num(r.score.prone))) : 0,
      prStanding: mine.length ? Math.max(...mine.map((r) => num(r.score.standing))) : 0,
      prKneeling: mine.length ? Math.max(...mine.map((r) => num(r.score.kneeling))) : 0,
    });
  }
  return out;
}

// Per-match team aggregate: top-4 shooter totals summed, plus the full-field
// average. Only matches that have at least one score row count as "played".
export function teamAggregates(matches, scores) {
  const played = matches.filter((m) => scores.some((sc) => sc.match_id === m.id));
  return played
    .slice()
    .sort((a, b) => (a.week ?? 0) - (b.week ?? 0))
    .map((m) => {
      const totals = scores.filter((sc) => sc.match_id === m.id).map(scoreTotal).sort((a, b) => b - a);
      return { match: m, agg: round1(totals.slice(0, 4).reduce((a, b) => a + b, 0)), avg: avgOf(totals), count: totals.length };
    });
}

// Soonest match with no scores recorded yet — the portal's stand-in for
// "upcoming match" since rifle_matches has no explicit status column, only
// a week number and a free-text dates field that isn't reliably parseable.
export function nextUpcomingMatch(matches, scores) {
  const played = new Set(scores.map((sc) => sc.match_id));
  const unplayed = matches.filter((m) => !played.has(m.id)).sort((a, b) => (a.week ?? 0) - (b.week ?? 0));
  return unplayed[0] || null;
}

// Rough skill tier from personal-record total (out of 300) — not stored,
// recomputed on the fly; thresholds are a starting heuristic, easy to
// retune in this one place later.
export function badgeFor(pr) {
  if (pr >= 270) return 'EXPERT';
  if (pr >= 250) return 'SHARPSHOOTER';
  if (pr >= 230) return 'MARKSMAN';
  return null;
}

export function initials(name) {
  return (name || '')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
}

export function pctClamp(v, lo, hi) {
  return Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));
}
