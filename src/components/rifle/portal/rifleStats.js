// Shared score-derivation helpers for the Range Ops redesign (Dashboard,
// Scores Editor, Shooter Profile, Lineup & Rankings all need the same
// per-shooter / per-match aggregates — computed once here instead of four
// slightly-different reimplementations).

export function seasonOf(match) {
  const m = (match?.dates || '').match(/\b(20\d{2})\b/);
  return m ? m[1] : 'Undated';
}

export function num(v) {
  return v === '' || v == null || Number.isNaN(+v) ? 0 : +v;
}

export function scoreTotal(sc) {
  return num(sc?.prone) + num(sc?.standing) + num(sc?.kneeling);
}

export function avgOf(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

export function round1(n) {
  return Math.round(n * 10) / 10;
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
      return { match: m, agg: totals.slice(0, 4).reduce((a, b) => a + b, 0), avg: avgOf(totals), count: totals.length };
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
