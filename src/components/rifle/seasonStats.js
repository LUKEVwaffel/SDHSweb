// Season analysis for the public /rifle page. Built from live rifle_matches /
// rifle_scores / rifle_shooters rows (all public-read), so the page shows
// whatever season is current — including one that's only a week old — with
// no code change. Pure functions; rifleData.js feeds its static 2025-26
// cards through the same code as an offline fallback.
// Tests: node --test src/components/rifle/seasonStats.test.js

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const round = (x, d = 1) => Number(Number(x).toFixed(d));
const maxBy = (xs, f) => xs.reduce((a, x) => (a == null || f(x) > f(a) ? x : a), null);
const minBy = (xs, f) => xs.reduce((a, x) => (a == null || f(x) < f(a) ? x : a), null);

function stdev(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

// Least-squares slope of y over its own index (points gained per match fired).
function slope(ys) {
  const n = ys.length;
  if (n < 2) return 0;
  const xs = ys.map((_, i) => i);
  const mx = mean(xs);
  const my = mean(ys);
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  return den === 0 ? 0 : num / den;
}

export function classify(score) {
  if (score == null) return { tier: 'DNS', range: '—' };
  if (score >= 245) return { tier: 'Expert', range: '245+' };
  if (score >= 220) return { tier: 'Sharpshooter', range: '220–244' };
  if (score >= 200) return { tier: 'Marksman', range: '200–219' };
  return { tier: 'Not Qualified', range: '0–199' };
}

const POS = [['p', 'prone', 'Prone'], ['s', 'standing', 'Standing'], ['k', 'kneeling', 'Kneeling']];

function positionAverages(cards) {
  return POS.map(([f, key, label]) => {
    const vals = cards.map((c) => c[f]).filter((v) => v != null);
    return { key, label, value: vals.length ? round(mean(vals)) : null };
  });
}

// raw = { name, rifle, cards: [[p, s, k, tot, bulls] | null, ...] } aligned to `weeks`.
export function analyzeShooter(raw, weeks) {
  const ws = weeks.map((wk, i) => {
    const c = raw.cards[i];
    const base = { idx: i + 1, week: wk.week, dates: wk.dates, opp: wk.opp };
    if (!c || c[3] == null) return { ...base, fired: false };
    const [p, s, k, tot, b] = c;
    return { ...base, fired: true, p, s, k, tot, b: b ?? 0 };
  });
  const fired = ws.filter((w) => w.fired);
  const base = { name: raw.name, rifle: raw.rifle, weeks: ws, firedCount: fired.length };
  if (!fired.length) return { ...base, dns: true, classification: classify(null) };

  const totals = fired.map((w) => w.tot);
  const positions = positionAverages(fired);
  const known = positions.filter((p) => p.value != null);
  const bestW = maxBy(fired, (w) => w.tot);
  const worstW = minBy(fired, (w) => w.tot);

  let bestJump = null;
  let worstDrop = null;
  for (let i = 1; i < fired.length; i++) {
    const d = round(fired[i].tot - fired[i - 1].tot);
    const span = { delta: d, from: fired[i - 1].week, to: fired[i].week };
    if (!bestJump || d > bestJump.delta) bestJump = span;
    if (!worstDrop || d < worstDrop.delta) worstDrop = span;
  }
  let splitDelta = null;
  if (fired.length >= 4) {
    const half = Math.ceil(fired.length / 2);
    splitDelta = round(mean(totals.slice(half)) - mean(totals.slice(0, half)));
  }
  const bulls = fired.reduce((s, w) => s + w.b, 0);

  return {
    ...base,
    dns: false,
    avg: round(mean(totals)),
    best: bestW.tot, bestWeek: bestW.week,
    worst: worstW.tot, worstWeek: worstW.week,
    first: totals[0], firstWeek: fired[0].week,
    last: totals[totals.length - 1], lastWeek: fired[fired.length - 1].week,
    delta: round(totals[totals.length - 1] - totals[0]),
    range: round(bestW.tot - worstW.tot),
    stdev: round(stdev(totals), 1),
    trend: round(slope(totals), 1),
    splitDelta,
    prone: positions[0].value, standing: positions[1].value, kneeling: positions[2].value,
    positions,
    posBest: known.length ? maxBy(known, (p) => p.value) : null,
    posWorst: known.length > 1 ? minBy(known, (p) => p.value) : null,
    bulls,
    bullsPerMatch: round(bulls / fired.length, 1),
    bestJump, worstDrop,
    classification: classify(bestW.tot), // off best card (top shot), not average
  };
}

export function analyzeTeam(shooters, matchCount) {
  const active = shooters.filter((s) => !s.dns);
  const cards = active.flatMap((s) => s.weeks.filter((w) => w.fired).map((w) => ({ ...w, name: s.name })));
  const ranked = [...active].sort((a, b) => b.avg - a.avg);
  const teamPositions = positionAverages(cards);
  const known = teamPositions.filter((p) => p.value != null);
  return {
    rosterCount: shooters.length,
    activeCount: active.length,
    dnsCount: shooters.length - active.length,
    matchesFired: cards.length,
    teamAvg: cards.length ? round(mean(cards.map((w) => w.tot))) : null,
    teamPositions,
    teamPosBest: known.length ? maxBy(known, (p) => p.value) : null,
    teamPosWorst: known.length > 1 ? minBy(known, (p) => p.value) : null,
    totalBulls: cards.reduce((s, w) => s + w.b, 0),
    ranked,
    topShooter: ranked[0] || null,
    // Need enough cards for these to mean anything; null hides the tile.
    mostImproved: maxBy(active.filter((s) => s.firedCount >= 3), (s) => s.delta),
    mostConsistent: minBy(active.filter((s) => s.firedCount >= 4), (s) => s.stdev),
    ironman: matchCount > 1 ? active.filter((s) => s.firedCount === matchCount) : [],
    bestCard: maxBy(cards, (w) => w.tot),
    worstCard: minBy(cards, (w) => w.tot),
  };
}

// One match's scorecard — the "Latest Comp" panel.
export function matchCard(week, shooters) {
  const rows = shooters
    .map((s) => ({ s, w: s.weeks.find((x) => x.idx === week.idx) }))
    .filter(({ w }) => w?.fired)
    .map(({ s, w }) => ({ name: s.name, rifle: s.rifle, p: w.p, s: w.s, k: w.k, tot: w.tot, b: w.b, tier: classify(w.tot).tier }))
    .sort((a, b) => b.tot - a.tot);
  const top4 = rows.slice(0, 4);
  return {
    ...week,
    rows,
    teamAgg: round(top4.reduce((a, r) => a + r.tot, 0)),
    countedShooters: top4.length,
    bulls: rows.reduce((a, r) => a + r.b, 0),
    avg: rows.length ? round(mean(rows.map((r) => r.tot))) : null,
  };
}

// ── Live rows → season ───────────────────────────────────────────────────
const num = (v) => (v == null || v === '' ? null : Number(v));

function cardFromScore(sc) {
  const p = num(sc.prone); const s = num(sc.standing); const k = num(sc.kneeling);
  const tot = num(sc.total) ?? (p != null && s != null && k != null ? round(p + s + k) : null);
  if (tot == null) return null;
  return [p, s, k, round(tot), num(sc.bulls) ?? 0];
}

/**
 * @param {{ matches: object[], shooters: object[], scores: object[], season: string,
 *           schoolYearOf: (m: object) => string, isCurrent: boolean, meta?: object }} input
 */
export function buildSeason({ matches, shooters, scores, season, schoolYearOf, isCurrent, meta = {} }) {
  const seasonMatches = matches.filter((m) => schoolYearOf(m) === season)
    .sort((a, b) => a.week - b.week || String(a.created_at).localeCompare(String(b.created_at)));
  const matchIdx = new Map(seasonMatches.map((m, i) => [m.id, i]));
  const scored = new Set(scores.filter((sc) => matchIdx.has(sc.match_id) && cardFromScore(sc)).map((sc) => sc.match_id));
  // Only matches that have been shot count as weeks; upcoming ones are skipped.
  const playedMatches = seasonMatches.filter((m) => scored.has(m.id));
  const weeks = playedMatches.map((m) => ({ week: m.week, dates: m.dates || '', opp: m.opponent || null, loc: m.location || null, id: m.id }));
  const weekIdx = new Map(playedMatches.map((m, i) => [m.id, i]));

  const cardsByShooter = new Map();
  for (const sc of scores) {
    const i = weekIdx.get(sc.match_id);
    if (i == null) continue;
    const card = cardFromScore(sc);
    if (!card) continue;
    if (!cardsByShooter.has(sc.shooter_id)) cardsByShooter.set(sc.shooter_id, Array(weeks.length).fill(null));
    cardsByShooter.get(sc.shooter_id)[i] = card;
  }
  const roster = shooters.filter((s) => cardsByShooter.has(s.id) || (isCurrent && s.active));
  const analyzed = roster
    .map((s) => analyzeShooter({ name: s.name, rifle: s.rifle_no, cards: cardsByShooter.get(s.id) || Array(weeks.length).fill(null) }, weeks));
  const team = analyzeTeam(analyzed, weeks.length);
  const latest = weeks.length ? matchCard({ ...weeks[weeks.length - 1], idx: weeks.length }, analyzed) : null;
  const first = weeks[0]?.dates;
  const last = weeks[weeks.length - 1]?.dates;

  return {
    meta: {
      season,
      league: meta.league || `${season.slice(0, 5).replace('-', '–')}${season.slice(7)} Air Rifle Season`,
      squad: meta.squad || 'Trojan Battalion Rifle',
      matches: weeks.length,
      window: meta.window || (first ? (first === last ? first : `${first} → ${last}`) : 'No matches shot yet'),
      complete: !isCurrent,
    },
    weeks,
    shooters: analyzed,
    team,
    latest,
  };
}

// ── Narrative ────────────────────────────────────────────────────────────
// Every clause is driven by a computed value — no free-text claims.
export function buildNarrative(s, team, meta) {
  const n = meta.matches;
  if (s.dns) {
    return [meta.complete
      ? `${s.name}${s.rifle ? ` (rifle ${s.rifle})` : ''} was on the ${meta.season} roster but did not post a score in any of the ${n} matches.`
      : `${s.name}${s.rifle ? ` (rifle ${s.rifle})` : ''} is on the ${meta.season} roster and hasn't posted a card yet${n ? ` — ${n} match${n === 1 ? '' : 'es'} shot so far` : ''}.`];
  }
  const out = [];
  const tier = s.classification.tier;
  out.push(
    `${s.name} has fired ${s.firedCount} of ${n} match${n === 1 ? '' : 'es'}, peaking at ${s.best} in week ${s.bestWeek} — ${tier === 'Expert' ? 'an' : 'a'} ${tier}-class top shot (${s.classification.range}).` +
      (s.firedCount > 1 ? ` Average ${s.avg}; low card ${s.worst} in week ${s.worstWeek}, a ${s.range}-point spread.` : ''),
  );
  if (s.firedCount > 1) {
    const dir = s.trend > 1.5 ? 'climbing hard' : s.trend > 0.4 ? 'trending up' : s.trend < -1.5 ? 'sliding' : s.trend < -0.4 ? 'drifting down' : 'holding flat';
    let line = `Trajectory: ${dir} at ${s.trend >= 0 ? '+' : ''}${s.trend} pts per match`;
    if (s.splitDelta != null) line += `, with the back half ${s.splitDelta >= 0 ? 'up' : 'down'} ${Math.abs(s.splitDelta)} pts on the front half`;
    out.push(`${line}. Net first-to-last card: ${s.delta >= 0 ? '+' : ''}${s.delta} (${s.first} → ${s.last}).`);
  }
  if (s.posBest && s.posWorst && team.teamPositions.every((p) => p.value != null)) {
    out.push(
      `Position profile: strongest in ${s.posBest.label.toLowerCase()} (${s.posBest.value}), weakest in ${s.posWorst.label.toLowerCase()} (${s.posWorst.value}). ` +
        `Prone ${s.prone ?? '—'} / Standing ${s.standing ?? '—'} / Kneeling ${s.kneeling ?? '—'} — vs. team ${team.teamPositions.map((p) => p.value).join(' / ')}.`,
    );
  }
  if (s.firedCount > 2) {
    const c = s.stdev < 12 ? `very consistent (±${s.stdev} match-to-match)` : s.stdev < 20 ? `fairly steady (±${s.stdev})` : `streaky (±${s.stdev} swing between matches)`;
    let line = `Consistency: ${c}.`;
    if (s.bestJump && s.bestJump.delta >= 10) line += ` Biggest jump +${s.bestJump.delta} from week ${s.bestJump.from} to ${s.bestJump.to}.`;
    if (s.worstDrop && s.worstDrop.delta <= -10) line += ` Biggest drop ${s.worstDrop.delta} from week ${s.worstDrop.from} to ${s.worstDrop.to}.`;
    out.push(line);
  }
  out.push(`Bull's-eyes: ${s.bulls}, ${s.bullsPerMatch} per match${s.name === team.ranked[0]?.name && team.ranked.length > 1 ? ' — team-leading average.' : '.'}`);
  return out;
}
