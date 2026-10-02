// Run: node --test src/lib/boardRules.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  promotionOptions, promotionEligibility, totalScore, allScored,
  normalizeLet, rankFromRoleTitle, defaultPromotion, quarterLabel, MAX_TOTAL,
} from './boardRules.js';

const full = (n) => ({ score_facing: n, score_creed: n, score_uniform: n, score_jrotc: n, score_class: n });

test('max total is 15', () => assert.equal(MAX_TOTAL, 15));

test('totals and completeness', () => {
  assert.equal(totalScore(full(3)), 15);
  assert.equal(totalScore({ score_facing: 2 }), 2);
  assert.equal(allScored({ score_facing: 2 }), false);
  assert.equal(allScored(full(0)), true);
});

test('normalizeLet accepts legacy "LET 3" strings', () => {
  assert.equal(normalizeLet('LET 3'), 3);
  assert.equal(normalizeLet('2'), 2);
  assert.equal(normalizeLet(null), null);
  assert.equal(normalizeLet('9'), null);
});

test('LET 1 caps at CPL', () => {
  assert.deepEqual(promotionOptions('PVT', 1), ['PV2', 'PFC', 'CPL']);
  assert.deepEqual(promotionOptions('CPL', 1), []);
});

test('LET 2/3/4 caps', () => {
  assert.deepEqual(promotionOptions('SGT', 2), ['SSG']);
  assert.deepEqual(promotionOptions('SSG', 3), ['SFC']);
  assert.deepEqual(promotionOptions('SFC', 4), ['MSG']);
});

test('officers and 1SG have nothing to promote to', () => {
  assert.deepEqual(promotionOptions('CPT', 3), []);
  assert.deepEqual(promotionOptions('1SG', 4), []);
});

test('minimum score: 10 for LET 1, 12 otherwise', () => {
  const nine = { ...full(2), score_class: 1 }; // 9
  const ten = full(2);                          // 10
  const eleven = { ...full(2), score_class: 3 }; // 11
  assert.equal(promotionEligibility({ scores: nine, currentRank: 'PVT', letLevel: 1 }).eligible, false);
  assert.equal(promotionEligibility({ scores: ten, currentRank: 'PVT', letLevel: 1 }).eligible, true);
  assert.equal(promotionEligibility({ scores: eleven, currentRank: 'PV2', letLevel: 2 }).eligible, false);
  assert.equal(promotionEligibility({ scores: full(3), currentRank: 'PV2', letLevel: 2 }).eligible, true);
});

test('ineligibility reasons never leak the minimum number', () => {
  const r = promotionEligibility({ scores: full(1), currentRank: 'PVT', letLevel: 1 });
  assert.equal(r.eligible, false);
  assert.doesNotMatch(r.reason, /\d/);
});

test('missing rank blocks promotion', () => {
  assert.equal(promotionEligibility({ scores: full(3), currentRank: null, letLevel: 1 }).eligible, false);
});

test('defaultPromotion is the next rank up', () => {
  assert.equal(defaultPromotion('PFC', 1), 'CPL');
  assert.equal(defaultPromotion('CPL', 1), null);
});

test('rankFromRoleTitle maps stored leadership titles', () => {
  assert.equal(rankFromRoleTitle('First Lieutenant'), '1LT');
  assert.equal(rankFromRoleTitle('Cadet Lieutenant colonel'), 'LTC');
  assert.equal(rankFromRoleTitle('Command Sergeant Major'), 'CSM');
  assert.equal(rankFromRoleTitle('Nonsense'), null);
});

test('quarterLabel follows the school year', () => {
  assert.equal(quarterLabel(new Date(2026, 9, 2)), '2026-27 Q1');
  assert.equal(quarterLabel(new Date(2026, 10, 15)), '2026-27 Q2');
  assert.equal(quarterLabel(new Date(2027, 0, 10)), '2026-27 Q2');
  assert.equal(quarterLabel(new Date(2027, 2, 1)), '2026-27 Q3');
  assert.equal(quarterLabel(new Date(2027, 4, 1)), '2026-27 Q4');
});
