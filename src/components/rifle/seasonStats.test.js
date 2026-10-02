// Run: node --test src/components/rifle/seasonStats.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeason, buildNarrative } from './seasonStats.js';
import { schoolYearOf } from './portal/rifleStats.js';
import { staticSeason } from '../rifleData.js';

const shooters = [
  { id: 'a', name: 'Makaio Roos', rifle_no: 15, active: true },
  { id: 'b', name: 'Luke Vetsch', rifle_no: 13, active: true },
  { id: 'c', name: 'Tori Duke', rifle_no: 2, active: true },
  { id: 'old', name: 'Graduated Kid', rifle_no: 1, active: false },
];
const matches = [
  { id: 'm1', week: 1, dates: '1/26–2/1, 2026', opponent: 'Eastmark' },
  { id: 'm2', week: 2, dates: '2/2–2/8, 2026', opponent: 'Glenn' },
  { id: 'n1', week: 1, dates: '9-28-2026 - 10-2-2026', opponent: 'Palmetto Ridge' },
  { id: 'n2', week: 2, dates: '10/5–10/11, 2026', opponent: 'Upcoming' },
];
const scores = [
  { shooter_id: 'a', match_id: 'm1', prone: 90, standing: 70, kneeling: 80, total: 240, bulls: 2 },
  { shooter_id: 'old', match_id: 'm2', prone: 80, standing: 60, kneeling: 70, total: null, bulls: 0 },
  { shooter_id: 'a', match_id: 'n1', prone: 90.7, standing: 70, kneeling: 90, total: 250.7, bulls: 4 },
  { shooter_id: 'b', match_id: 'n1', prone: 84.3, standing: 58, kneeling: 60.3, total: 202.6, bulls: 1 },
];

test('in-progress season with one match: no crash, upcoming match skipped, roster includes unscored actives', () => {
  const s = buildSeason({ matches, shooters, scores, season: '2026-2027', schoolYearOf, isCurrent: true });
  assert.equal(s.meta.matches, 1);
  assert.equal(s.meta.complete, false);
  assert.equal(s.latest.opp, 'Palmetto Ridge');
  assert.equal(s.latest.rows[0].name, 'Makaio Roos');
  assert.equal(s.latest.teamAgg, 453.3);
  assert.equal(s.team.mostImproved, null);
  assert.equal(s.team.mostConsistent, null);
  assert.deepEqual(s.shooters.map((x) => x.name).sort(), ['Luke Vetsch', 'Makaio Roos', 'Tori Duke']);
  const tori = s.shooters.find((x) => x.name === 'Tori Duke');
  assert.equal(tori.dns, true);
  assert.match(buildNarrative(tori, s.team, s.meta)[0], /hasn't posted a card yet/);
  s.shooters.forEach((x) => assert.ok(buildNarrative(x, s.team, s.meta).length));
});

test('past season: only shooters with scores, total computed from P+S+K when blank', () => {
  const s = buildSeason({ matches, shooters, scores, season: '2025-2026', schoolYearOf, isCurrent: false });
  assert.equal(s.meta.matches, 2);
  const old = s.shooters.find((x) => x.name === 'Graduated Kid');
  assert.equal(old.best, 210);
  assert.ok(!s.shooters.some((x) => x.name === 'Tori Duke'));
});

test('missing positions do not produce NaN', () => {
  const s = buildSeason({ matches, shooters, scores: [{ shooter_id: 'a', match_id: 'n1', prone: null, standing: null, kneeling: null, total: 230, bulls: null }], season: '2026-2027', schoolYearOf, isCurrent: true });
  const m = s.shooters.find((x) => x.name === 'Makaio Roos');
  assert.equal(m.avg, 230);
  assert.equal(m.prone, null);
  assert.ok(!JSON.stringify(s.team).includes('NaN'));
});

test('static 2025-26 fallback still analyzes', () => {
  const s = staticSeason();
  assert.equal(s.meta.matches, 10);
  assert.ok(s.team.topShooter);
  assert.ok(s.team.mostImproved);
  assert.ok(s.latest.rows.length > 0);
});
