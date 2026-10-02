import { CATEGORIES, MAX_TOTAL } from '../../../lib/boardRules.js';

// CSV export of board_results rows — exactly the rows currently filtered on
// screen. Columns are what S-1 / instructors need without opening a sheet.

const DECISION_TEXT = { promote: 'Promote', no_promote: 'Do not promote', absent: 'Absent' };

const COLUMNS = [
  ['Quarter', (r) => r.quarter_label],
  ['Company', (r) => r.company],
  ['Cadet', (r) => r.cadet_name],
  ['LET', (r) => r.let_level],
  ['Grade', (r) => r.grade],
  ['Rank before', (r) => r.rank_before],
  ...CATEGORIES.map((c) => [c.label, (r) => (r.decision === 'absent' ? '' : r[c.key])]),
  [`Total (/${MAX_TOTAL})`, (r) => (r.decision === 'absent' ? '' : r.total)],
  ['Board decision', (r) => DECISION_TEXT[r.decision] ?? ''],
  ['Board promote to', (r) => r.promote_to],
  ['SAI overturned', (r) => (r.sai_decision ? 'Yes' : '')],
  ['SAI note', (r) => r.sai_note],
  ['Final decision', (r) => DECISION_TEXT[r.final_decision] ?? ''],
  ['Final rank', (r) => r.final_promote_to ?? (r.final_decision === 'absent' ? '' : r.rank_before)],
  ['Comment', (r) => r.comment],
  ['1SG signed', (r) => r.sig_1sg_name],
  ['1SG signed at', (r) => r.sig_1sg_at],
  ['XO signed', (r) => r.sig_xo_name],
  ['XO signed at', (r) => r.sig_xo_at],
  ['CMMDR signed', (r) => r.sig_co_name],
  ['CMMDR signed at', (r) => r.sig_co_at],
  ['SAI signed', (r) => r.sai_signed_name],
  ['SAI signed at', (r) => r.sai_signed_at],
  ['Seal', (r) => r.seal],
];

function cell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  // Neutralize spreadsheet formula injection (=, +, -, @ at the start).
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows) {
  const head = COLUMNS.map(([h]) => cell(h)).join(',');
  const body = rows.map((r) => COLUMNS.map(([, get]) => cell(get(r))).join(','));
  return [head, ...body].join('\r\n');
}

export function downloadCsv(rows, filename) {
  const blob = new Blob(['﻿', toCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
