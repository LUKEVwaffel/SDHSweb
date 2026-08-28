// ─────────────────────────────────────────────────────────────────────────────
// Rifle team — 2026 National Air Rifle New Shooter League (JV / New Shooter).
// Ten postal matches, decimal scoring, three positions (prone / standing /
// kneeling), ~100 per position, ~300 aggregate.
//
// Source: 2026_National_Air_Rifle_New_Shooter_JV_Decimal_v1.0.xlsx — "Scores"
// sheet (per-cadet weekly cards) + "Data List" sheet (weekly opponents).
// Weekly card = [prone, standing, kneeling, aggregate, bullsEyes]; null = the
// cadet did not fire that match.
// ─────────────────────────────────────────────────────────────────────────────

export const SEASON_META = {
  league: '2026 National Air Rifle New Shooter League',
  squad: 'JV / New Shooter',
  discipline: '3-Position Air Rifle · Decimal',
  matches: 10,
  window: 'Jan 26 – Apr 5, 2026',
  unit: 'Trojan Battalion · TN-051',
};

// Weekly postal opponents (Data List sheet). Weeks 4 and 8 had no opponent
// logged — week 8 was run as an extra match.
export const WEEKS = [
  { week: 1,  dates: '1/26–2/1',  opp: 'Eastmark NJROTC',        loc: 'Mesa, AZ' },
  { week: 2,  dates: '2/2–2/8',   opp: 'Robert B Glenn AJROTC',  loc: 'Winston-Salem, NC' },
  { week: 3,  dates: '2/9–2/15',  opp: 'Washburn Rural AFJROTC', loc: 'Topeka, KS' },
  { week: 4,  dates: '2/16–2/22', opp: null,                     loc: null },
  { week: 5,  dates: '2/23–3/1',  opp: 'Bay AFJROTC',            loc: 'Bay St Louis, MS' },
  { week: 6,  dates: '3/2–3/8',   opp: 'Cross Creek NJROTC',     loc: 'Augusta, GA' },
  { week: 7,  dates: '3/9–3/15',  opp: 'Seaford NJROTC',         loc: 'Seaford, DE' },
  { week: 8,  dates: '3/16–3/22', opp: 'Extra Match',            loc: null },
  { week: 9,  dates: '3/23–3/29', opp: 'James Clemens AJROTC',   loc: 'Madison, AL' },
  { week: 10, dates: '3/30–4/5',  opp: 'Caney Creek NJROTC',     loc: 'Conroe, TX' },
];

// [prone, standing, kneeling, aggregate, bullsEyes] per week, index 0 = week 1.
const RAW = [
  {
    name: 'Makaio Roos', rifle: 15,
    cards: [
      [87.6, 70.1, 76.2, 233.9, 2], [74.2, 78.3, 87.8, 240.3, 4],
      [88.5, 64.9, 84.4, 237.8, 2], [96.8, 75.2, 82.8, 254.8, 4],
      [94.5, 78.6, 83.5, 256.6, 4], [92.8, 70.7, 80.8, 244.3, 1],
      [96.9, 65.2, 81.0, 243.1, 0], [92.8, 70.6, 80.9, 244.3, 1],
      [91.5, 73.5, 85.8, 250.8, 1], [82.0, 59.0, 74.9, 215.9, 1],
    ],
  },
  {
    name: 'Weston Noblit', rifle: 7,
    cards: [
      [85.3, 45.2, 65.4, 195.9, 1], [79.0, 55.8, 74.8, 209.6, 1],
      [91.1, 61.3, 73.9, 226.3, 2], [90.1, 73.1, 76.7, 239.9, 5],
      [95.6, 68.2, 77.1, 240.9, 5], [90.2, 68.0, 67.7, 225.9, 2],
      [93.2, 58.4, 74.9, 226.5, 1], null,
      [96.1, 71.1, 90.0, 257.2, 5], [93.9, 69.3, 82.1, 245.3, 3],
    ],
  },
  {
    name: "Aiden O'Brein", rifle: 4,
    cards: [
      null, null, null, null, null, null,
      [84.0, 76.1, 75.3, 235.4, 2], [82.2, 57.4, 50.0, 189.6, 0],
      [96.4, 70.0, 84.7, 251.1, 5], [89.7, 68.9, 83.6, 242.2, 2],
    ],
  },
  {
    name: 'Sofia Juarez Vargas', rifle: 10,
    cards: [
      [78.0, 58.7, 46.5, 183.2, 1], [67.2, 62.7, 59.2, 189.1, 0],
      [78.3, 60.1, 60.1, 198.5, 0], [76.5, 60.5, 59.2, 196.2, 1],
      [86.2, 62.0, 64.1, 212.3, 0], [90.6, 75.8, 77.3, 243.7, 3],
      [84.9, 81.8, 89.8, 256.5, 3], null,
      [87.9, 81.4, 82.1, 251.4, 4], [96.7, 85.0, 73.6, 255.3, 8],
    ],
  },
  {
    name: 'Tori Duke', rifle: 2,
    cards: [
      null, null, null, null,
      [52.5, 64.6, 71.9, 189.0, 0], [90.7, 63.4, 68.1, 222.2, 2],
      [95.2, 70.1, 62.6, 227.9, 7], null, null, null,
    ],
  },
  {
    name: 'Aiden Clifton', rifle: 5,
    cards: [
      null, null, null, null, null,
      [78.6, 61.5, 75.9, 216.0, 1], null,
      [56.0, 50.5, 68.8, 175.3, 0], [77.6, 63.5, 71.3, 212.4, 0], null,
    ],
  },
  {
    name: 'Luke Vetsch', rifle: 13,
    cards: [
      [74.3, 48.1, 66.3, 188.7, 1], [52.1, 44.8, 45.7, 142.6, 1],
      null, null, null, null, null,
      [83.6, 55.4, 45.8, 184.8, 0], null,
      [81.3, 67.4, 79.4, 228.1, 3],
    ],
  },
  {
    name: 'Kenneth Suttles', rifle: 9,
    cards: [
      null, [73.2, 38.7, 57.6, 169.5, 0], [64.9, 42.6, 42.1, 149.6, 0],
      [68.2, 51.0, 51.8, 171.0, 0], [67.8, 57.1, 55.7, 180.6, 4],
      null, null, [74.4, 54.6, 77.7, 206.7, 2], null, null,
    ],
  },
  {
    name: 'Jayde Walker', rifle: 3,
    cards: [null, null, null, null, null, null, null, null, null, null],
  },
];

// ── Derived analysis ────────────────────────────────────────────────────────

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const round = (x, d = 1) => Number(x.toFixed(d));

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

export function classify(avg) {
  if (avg == null) return { tier: 'DNS', range: '—' };
  if (avg >= 245) return { tier: 'Expert', range: '245+' };
  if (avg >= 220) return { tier: 'Sharpshooter', range: '220–244' };
  if (avg >= 200) return { tier: 'Marksman', range: '200–219' };
  return { tier: 'Not Qualified', range: '0–199' };
}

export function analyzeShooter(raw) {
  const weeks = raw.cards.map((c, i) => {
    if (!c) return { week: i + 1, dates: WEEKS[i].dates, opp: WEEKS[i].opp, fired: false };
    const [p, s, k, tot, b] = c;
    return { week: i + 1, dates: WEEKS[i].dates, opp: WEEKS[i].opp, fired: true, p, s, k, tot, b };
  });
  const fired = weeks.filter((w) => w.fired);
  const base = { name: raw.name, rifle: raw.rifle, weeks, firedCount: fired.length };

  if (fired.length === 0) {
    return { ...base, dns: true, classification: classify(null) };
  }

  const totals = fired.map((w) => w.tot);
  const prone = mean(fired.map((w) => w.p));
  const standing = mean(fired.map((w) => w.s));
  const kneeling = mean(fired.map((w) => w.k));
  const avg = mean(totals);

  const bestW = fired.reduce((a, w) => (w.tot > a.tot ? w : a));
  const worstW = fired.reduce((a, w) => (w.tot < a.tot ? w : a));

  const positions = [
    { key: 'prone', label: 'Prone', value: round(prone) },
    { key: 'standing', label: 'Standing', value: round(standing) },
    { key: 'kneeling', label: 'Kneeling', value: round(kneeling) },
  ];
  const posBest = positions.reduce((a, p) => (p.value > a.value ? p : a));
  const posWorst = positions.reduce((a, p) => (p.value < a.value ? p : a));

  // Largest match-to-match swing across consecutive fired matches.
  let bestJump = null;
  let worstDrop = null;
  for (let i = 1; i < fired.length; i++) {
    const d = round(fired[i].tot - fired[i - 1].tot);
    const span = { delta: d, from: fired[i - 1].week, to: fired[i].week };
    if (bestJump === null || d > bestJump.delta) bestJump = span;
    if (worstDrop === null || d < worstDrop.delta) worstDrop = span;
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
    avg: round(avg),
    best: bestW.tot,
    bestWeek: bestW.week,
    worst: worstW.tot,
    worstWeek: worstW.week,
    first: totals[0],
    firstWeek: fired[0].week,
    last: totals[totals.length - 1],
    lastWeek: fired[fired.length - 1].week,
    delta: round(totals[totals.length - 1] - totals[0]),
    range: round(bestW.tot - worstW.tot),
    stdev: round(stdev(totals), 1),
    trend: round(slope(totals), 1),
    splitDelta,
    prone: round(prone),
    standing: round(standing),
    kneeling: round(kneeling),
    positions,
    posBest,
    posWorst,
    bulls,
    bullsPerMatch: round(bulls / fired.length, 1),
    bestJump,
    worstDrop,
    classification: classify(avg),
  };
}

export function analyzeTeam(shooters) {
  const active = shooters.filter((s) => !s.dns);
  const allCards = active.flatMap((s) => s.weeks.filter((w) => w.fired));

  const ranked = [...active].sort((a, b) => b.avg - a.avg);
  const improvers = active.filter((s) => s.firedCount >= 3);
  const steady = active.filter((s) => s.firedCount >= 4);

  const bestCard = active
    .flatMap((s) => s.weeks.filter((w) => w.fired).map((w) => ({ ...w, name: s.name })))
    .reduce((a, w) => (w.tot > a.tot ? w : a));
  const worstCard = active
    .flatMap((s) => s.weeks.filter((w) => w.fired).map((w) => ({ ...w, name: s.name })))
    .reduce((a, w) => (w.tot < a.tot ? w : a));

  const teamProne = mean(allCards.map((w) => w.p));
  const teamStanding = mean(allCards.map((w) => w.s));
  const teamKneeling = mean(allCards.map((w) => w.k));
  const teamPositions = [
    { key: 'prone', label: 'Prone', value: round(teamProne) },
    { key: 'standing', label: 'Standing', value: round(teamStanding) },
    { key: 'kneeling', label: 'Kneeling', value: round(teamKneeling) },
  ];

  return {
    rosterCount: shooters.length,
    activeCount: active.length,
    dnsCount: shooters.length - active.length,
    matchesFired: allCards.length,
    teamAvg: round(mean(allCards.map((w) => w.tot))),
    teamPositions,
    teamPosBest: teamPositions.reduce((a, p) => (p.value > a.value ? p : a)),
    teamPosWorst: teamPositions.reduce((a, p) => (p.value < a.value ? p : a)),
    totalBulls: allCards.reduce((s, w) => s + w.b, 0),
    ranked,
    topShooter: ranked[0],
    mostImproved: improvers.reduce((a, s) => (s.delta > a.delta ? s : a)),
    mostConsistent: steady.reduce((a, s) => (s.stdev < a.stdev ? s : a)),
    ironman: active.filter((s) => s.firedCount === SEASON_META.matches),
    bestCard,
    worstCard,
  };
}

export const SHOOTERS = RAW.map(analyzeShooter);
export const TEAM = analyzeTeam(SHOOTERS);

// Auto-written scouting notes — every clause is driven by a computed value
// above, no free-text claims.
export function buildNarrative(s, team) {
  if (s.dns) {
    return [
      `${s.name} (rifle ${s.rifle}) is on the 2026 roster but did not post a score in any of the ${SEASON_META.matches} postal matches — no card on file for the season.`,
    ];
  }
  const out = [];
  const pos = s.classification.tier;
  const posArticle = pos === 'Expert' ? 'an' : 'a';

  out.push(
    `${s.name} fired ${s.firedCount} of ${SEASON_META.matches} matches for a ${s.avg} aggregate average — ${posArticle} ${pos}-class season (${s.classification.range}). ` +
      `Peak card ${s.best} in week ${s.bestWeek}; low card ${s.worst} in week ${s.worstWeek}, a ${s.range}-point spread.`,
  );

  const dir =
    s.trend > 1.5 ? 'climbing hard' :
    s.trend > 0.4 ? 'trending up' :
    s.trend < -1.5 ? 'sliding' :
    s.trend < -0.4 ? 'drifting down' : 'holding flat';
  let trendLine = `Trajectory: ${dir} at ${s.trend >= 0 ? '+' : ''}${s.trend} pts per match`;
  if (s.splitDelta != null) {
    trendLine += `, with the back half of the season ${s.splitDelta >= 0 ? 'up' : 'down'} ${Math.abs(s.splitDelta)} pts on the front half`;
  }
  trendLine += `. Net first-to-last card: ${s.delta >= 0 ? '+' : ''}${s.delta} (${s.first} → ${s.last}).`;
  out.push(trendLine);

  out.push(
    `Position profile: strongest in ${s.posBest.label.toLowerCase()} (${s.posBest.value}), weakest in ${s.posWorst.label.toLowerCase()} (${s.posWorst.value}). ` +
      `Prone ${s.prone} / Standing ${s.standing} / Kneeling ${s.kneeling} — vs. team ${team.teamPositions[0].value} / ${team.teamPositions[1].value} / ${team.teamPositions[2].value}.`,
  );

  const consistency =
    s.stdev < 12 ? `very consistent (±${s.stdev} match-to-match)` :
    s.stdev < 20 ? `fairly steady (±${s.stdev})` :
    `streaky (±${s.stdev} swing between matches)`;
  let cLine = `Consistency: ${consistency}.`;
  if (s.bestJump && s.bestJump.delta >= 10) {
    cLine += ` Biggest jump +${s.bestJump.delta} from week ${s.bestJump.from} to ${s.bestJump.to}.`;
  }
  if (s.worstDrop && s.worstDrop.delta <= -10) {
    cLine += ` Biggest drop ${s.worstDrop.delta} from week ${s.worstDrop.from} to ${s.worstDrop.to}.`;
  }
  out.push(cLine);

  out.push(
    `Bull's-eyes: ${s.bulls} on the season, ${s.bullsPerMatch} per match` +
      (s.name === team.ranked[0]?.name ? ' — team-leading average.' : '.'),
  );

  return out;
}
