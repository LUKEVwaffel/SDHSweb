// Run: node --test src/components/boards/results/csv.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCsv } from './csv.js';

const row = {
  quarter_label: '2026-27 Q1', company: 'alpha', cadet_name: 'Avery Adams', let_level: '1', grade: '9',
  rank_before: 'PVT', score_facing: 3, score_creed: 3, score_uniform: 2, score_jrotc: 3, score_class: 3, total: 14,
  decision: 'promote', promote_to: 'PV2', final_decision: 'promote', final_promote_to: 'PV2',
  comment: 'Sharp, "squared away", ready', sig_co_name: 'Cpt X',
};

test('header + one row', () => {
  const lines = toCsv([row]).split('\r\n');
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^Quarter,Company,Cadet,LET/);
  assert.match(lines[1], /Avery Adams/);
});

test('quotes commas and escapes quotes', () => {
  assert.match(toCsv([row]), /"Sharp, ""squared away"", ready"/);
});

test('neutralizes spreadsheet formulas', () => {
  const csv = toCsv([{ ...row, comment: '=HYPERLINK("x")' }]);
  assert.match(csv, /'=HYPERLINK/);
});

test('absent rows leave scores blank', () => {
  const line = toCsv([{ ...row, decision: 'absent', final_decision: 'absent' }]).split('\r\n')[1];
  assert.match(line, /PVT,,,,,,,Absent/);
});
