import { analyzeShooter, analyzeTeam, matchCard } from './rifle/seasonStats.js';

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

// Static copy of the 2025-26 season. The live page reads rifle_matches /
// rifle_scores instead (seasonStats.js); this is only the offline fallback
// and the source of that season's league label.
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
export const RAW = [
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

// Same shape buildSeason() returns, from the static cards above.
export function staticSeason() {
  const weeks = WEEKS.map((w) => ({ ...w }));
  const shooters = RAW.map((r) => analyzeShooter(r, weeks));
  return {
    meta: { season: '2025-2026', league: SEASON_META.league, squad: SEASON_META.squad, matches: weeks.length, window: SEASON_META.window, complete: true },
    weeks,
    shooters,
    team: analyzeTeam(shooters, weeks.length),
    latest: matchCard({ ...weeks[weeks.length - 1], idx: weeks.length }, shooters),
  };
}
