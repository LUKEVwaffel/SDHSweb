// Run: node --test src/components/rifle/portal/import/scoreImport.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractScoreTables, parseScoreCell, parseHeaderCell } from './scoreGrid.js';
import { textToGrids, sniffDelimiter, parseDelimited, decodeText, gridToCsv } from './textGrid.js';
import { matchRoster, normalizeName, toDraft, toDrafts, validateDrafts, finalizeDrafts, diffAgainstExisting } from './review.js';

const ROSTER = ['Aiden O\'Brien', 'Maria Garcia', 'John Smith', 'Jordan Lee', 'Chris Park'];

function firstGroupFromText(text) {
  for (const grid of textToGrids(text)) {
    const { groups } = extractScoreTables(grid);
    if (groups.length) return groups;
  }
  return [];
}

test('flat CSV with a title row above the header', () => {
  const csv = 'Week 4 results,,,,,\n,,,,,\nShooter,Prone,Standing,Kneeling,Total,X\nAiden O\'Brien,96.4,81.2,90.1,267.7,6\nMaria Garcia,94,78,88,260,4\nTeam Total,,,,527.7,10\n';
  const groups = firstGroupFromText(csv);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].rows.length, 2);
  assert.deepEqual(
    { ...groups[0].rows[0], flags: undefined, source_row: undefined },
    { raw_name: 'Aiden O\'Brien', prone: 96.4, standing: 81.2, kneeling: 90.1, total: 267.7, bulls: 6, flags: undefined, source_row: undefined },
  );
});

test('tab-separated paste from Excel with names containing commas', () => {
  const paste = 'Name\tP\tS\tK\tTotal\nSmith, John\t90\t80\t85\t255\nLee, Jordan\t88\t70\t82\t240\n';
  assert.equal(sniffDelimiter(paste), '\t');
  const groups = firstGroupFromText(paste);
  assert.equal(groups[0].rows[0].raw_name, 'Smith, John');
  assert.equal(groups[0].rows[1].standing, 70);
});

test('season workbook: repeating week groups with labels above', () => {
  const grid = [
    ['', 'Week 1', '', '', '', '', 'Week 2', '', '', '', ''],
    ['Name', 'Prone', 'Standing', 'Kneeling', 'Overall Score', 'Bull\'s-Eye', 'Prone', 'Standing', 'Kneeling', 'Overall Score', 'Bull\'s-Eye'],
    ['John Smith', 90, 80, 85, 255, 3, 91, 82, 86, 259, 4],
    ['Maria Garcia', 92, 75, 84, 251, 2, '', '', '', '', ''],
    ['Top Four', '', '', '', 1000, '', '', '', '', 1001, ''],
  ];
  const { groups } = extractScoreTables(grid);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].week, 1);
  assert.equal(groups[1].week, 2);
  assert.equal(groups[0].rows.length, 2);
  assert.equal(groups[1].rows.length, 1, 'blank week-2 cells skip Maria');
  assert.equal(groups[1].rows[0].total, 259);
});

test('week markers inside header cells', () => {
  const grid = [
    ['Shooter', 'Wk1 Prone', 'Wk1 Standing', 'Wk1 Kneeling', 'Wk2 Prone', 'Wk2 Standing', 'Wk2 Kneeling'],
    ['Jordan Lee', 90, 80, 85, 91, 81, 86],
  ];
  const { groups } = extractScoreTables(grid);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map((g) => g.week), [1, 2]);
});

test('series columns are summed into one position', () => {
  const grid = [
    ['Name', 'Prone 1', 'Prone 2', 'Standing 1', 'Standing 2', 'Kneeling 1', 'Kneeling 2'],
    ['Chris Park', 48, 49, 40, 41, 44, 45],
  ];
  const { groups } = extractScoreTables(grid);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].rows[0].prone, 97);
  assert.equal(groups[0].rows[0].standing, 81);
  assert.equal(groups[0].rows[0].kneeling, 89);
});

test('split first/last columns and "96-4X" cells', () => {
  const grid = [
    ['Last Name', 'First Name', 'Prone', 'Standing', 'Kneeling'],
    ['Smith', 'John', '96-4X', '80 (1x)', '88-2x'],
  ];
  const { groups } = extractScoreTables(grid);
  const r = groups[0].rows[0];
  assert.equal(r.raw_name, 'John Smith');
  assert.equal(r.prone, 96);
  assert.equal(r.bulls, 7);
});

test('long format: one row per position', () => {
  const grid = [
    ['Competitor', 'Position', 'Score', 'X'],
    ['Maria Garcia', 'Prone', 95, 5],
    ['Maria Garcia', 'Standing', 80, 1],
    ['Maria Garcia', 'Kneeling', 88, 2],
    ['John Smith', 'Prone', 90, 3],
  ];
  const { groups } = extractScoreTables(grid);
  assert.equal(groups.length, 1);
  const maria = groups[0].rows.find((r) => r.raw_name === 'Maria Garcia');
  assert.deepEqual([maria.prone, maria.standing, maria.kneeling, maria.bulls], [95, 80, 88, 8]);
});

test('stacked sections repeating the header, DNS markers flagged not dropped', () => {
  const grid = [
    ['Name', 'Prone', 'Standing', 'Kneeling', 'Total'],
    ['John Smith', 90, 80, 85, 255],
    [],
    ['Name', 'Prone', 'Standing', 'Kneeling', 'Total'],
    ['Jordan Lee', 'DNS', 70, 80, ''],
  ];
  const { groups } = extractScoreTables(grid);
  assert.equal(groups[0].rows.length, 2);
  const lee = groups[0].rows[1];
  assert.equal(lee.prone, null);
  assert.ok(lee.flags.some((f) => /DNS/.test(f)));
});

test('whitespace-aligned text (copied from a PDF)', () => {
  const text = 'Name            Prone   Standing   Kneeling   Total\nJohn Smith       90      80         85         255\nMaria Garcia     92      75         84         251\n';
  const groups = firstGroupFromText(text);
  assert.equal(groups[0].rows.length, 2);
  assert.equal(groups[0].rows[1].raw_name, 'Maria Garcia');
});

test('a sheet with no recognisable header explains why', () => {
  const { groups, reason } = extractScoreTables([['foo', 'bar'], ['1', '2']]);
  assert.equal(groups.length, 0);
  assert.match(reason, /header/i);
});

test('header without a "Name" label infers the name column', () => {
  const grid = [['', 'Prone', 'Standing', 'Kneeling'], ['John Smith', 90, 80, 85], ['Maria Garcia', 91, 81, 86]];
  const { groups } = extractScoreTables(grid);
  assert.equal(groups[0].rows.length, 2);
});

test('class code data cells do not hijack header detection', () => {
  const grid = [['Rank', 'Name', 'Class', 'Prone', 'Standing', 'Kneeling'], ['1', 'John Smith', 'S', 90, 80, 85]];
  const { groups, headerRow } = extractScoreTables(grid);
  assert.equal(headerRow, 0);
  assert.equal(groups[0].rows[0].prone, 90);
});

test('cell + header parsing primitives', () => {
  assert.deepEqual(parseScoreCell('87,6'), { value: 87.6 });
  assert.equal(parseScoreCell('DQ').value, null);
  assert.equal(parseScoreCell(' 95* ').value, 95);
  assert.equal(parseHeaderCell('Prone (100)').field, 'prone');
  assert.equal(parseHeaderCell("X's").field, 'bulls');
  assert.equal(parseHeaderCell('Notes'), null);
});

test('decodeText handles BOMs and windows-1252', () => {
  assert.equal(decodeText(new Uint8Array([0xef, 0xbb, 0xbf, 0x41])), 'A');
  assert.equal(decodeText(new Uint8Array([0xff, 0xfe, 0x41, 0x00])), 'A');
  // Invalid UTF-8 falls back to a single-byte decode instead of throwing
  // (browsers map 0x92 → ’; Node's small-icu build may map it to U+0092).
  assert.equal(decodeText(new Uint8Array([0x4f, 0x92, 0x42])).length, 3);
});

test('parseDelimited quoted fields + gridToCsv round trip', () => {
  const rows = parseDelimited('"Smith, John",90\n"Say ""hi""",1', ',');
  assert.deepEqual(rows, [['Smith, John', '90'], ['Say "hi"', '1']]);
  assert.deepEqual(parseDelimited(gridToCsv(rows), ','), rows);
});

test('roster matching: reversed, typo, initials, accents, ambiguity', () => {
  assert.equal(matchRoster('O\'Brien, Aiden', ROSTER).name, 'Aiden O\'Brien');
  assert.equal(matchRoster('Aiden OBrein', ROSTER).name, 'Aiden O\'Brien');
  assert.equal(matchRoster('J. Smith', ROSTER).name, 'John Smith');
  assert.equal(matchRoster('María García', ROSTER).name, 'Maria Garcia');
  assert.equal(matchRoster('Garcia', ROSTER).name, 'Maria Garcia');
  assert.equal(matchRoster('Totally Different', ROSTER), null);
  assert.equal(matchRoster('J Lee', [...ROSTER, 'Jamie Lee']), null, 'two J. Lees → no guess');
  assert.equal(normalizeName('Aiden J. O’Brien'), 'aiden obrien');
});

test('drafts: unmatched names default to excluded when a roster exists', () => {
  const on = toDraft({ raw_name: 'Smith, John', prone: 90 }, ROSTER);
  const off = toDraft({ raw_name: 'Opponent Kid', prone: 90 }, ROSTER);
  const empty = toDraft({ raw_name: 'Opponent Kid', prone: 90 }, []);
  assert.equal(on.include, true);
  assert.equal(on.name, 'John Smith');
  assert.equal(off.include, false);
  assert.equal(empty.include, true);
});

test('validation catches bad numbers, ranges, duplicates, mismatched totals', () => {
  const d = (over) => ({ ...toDraft({ raw_name: 'John Smith' }, ROSTER), ...over });
  const rows = [
    d({ prone: '90', standing: '80', kneeling: '85', total: '250' }),       // total mismatch → warn
    d({ name: 'John Smith', prone: 'abc' }),                                // dup + bad number
    d({ name: 'Maria Garcia', prone: '120' }),                              // > 109
    d({ name: 'Jordan Lee', bulls: '2.5', prone: '90' }),                   // fractional X
    d({ name: 'Chris Park', prone: '98.' }),                                // mid-typing decimal is fine
  ];
  const v = validateDrafts(rows, ROSTER);
  const levels = (i) => v.rows.get(rows[i].key).map((x) => x.level);
  assert.ok(levels(0).includes('warn'));
  assert.ok(!levels(0).includes('error'));
  assert.equal(levels(1).filter((l) => l === 'error').length, 3, 'dup + bad number + nothing usable left');
  assert.ok(levels(2).includes('error'));
  assert.ok(levels(3).includes('error'));
  assert.ok(!levels(4).includes('error'));
  assert.equal(v.errorCount, 5);
});

test('finalize fills total from P+S+K and rounds; diff vs existing', () => {
  const rows = finalizeDrafts([{ ...toDraft({ raw_name: 'John Smith' }, ROSTER), prone: '90.04', standing: '80', kneeling: '85.1', bulls: '3' }]);
  assert.equal(rows[0].prone, 90);
  assert.equal(rows[0].total, 255.1);
  assert.equal(diffAgainstExisting(rows[0], null), 'new');
  assert.equal(diffAgainstExisting(rows[0], { prone: 90, standing: 80, kneeling: 85.1, total: 255.1, bulls: 3 }), 'same');
  assert.equal(diffAgainstExisting(rows[0], { prone: 89, standing: 80, kneeling: 85.1, total: 254.1, bulls: 3 }), 'update');
});

test('a "Week N" title in column A labels a flat table', () => {
  const grid = [[''], ['Match results — Week 3'], ['Name', 'Prone', 'Standing', 'Kneeling'], ['John Smith', 90, 80, 85]];
  const { groups } = extractScoreTables(grid);
  assert.equal(groups[0].week, 3);
});

test('season workbook title in A1 does not steal week labels', () => {
  const grid = [
    ['2026 Rifle Scores', 'Week 1', '', '', 'Week 2', '', ''],
    ['Name', 'Prone', 'Standing', 'Kneeling', 'Prone', 'Standing', 'Kneeling'],
    ['John Smith', 90, 80, 85, 91, 81, 86],
  ];
  const { groups } = extractScoreTables(grid);
  assert.deepEqual(groups.map((g) => g.week), [1, 2]);
});

test('fuzzy matches start unticked on a sheet that is mostly other schools', () => {
  const meet = toDrafts([{ raw_name: 'Jon Smith' }, { raw_name: 'Kid A' }, { raw_name: 'Kid B' }, { raw_name: 'Kid C' }], ROSTER);
  assert.equal(meet[0].name, 'John Smith');
  assert.equal(meet[0].include, false);
  const own = toDrafts([{ raw_name: 'Jon Smith' }, { raw_name: 'Maria Garcia' }, { raw_name: 'Jordan Lee' }], ROSTER);
  assert.equal(own[0].include, true);
});
