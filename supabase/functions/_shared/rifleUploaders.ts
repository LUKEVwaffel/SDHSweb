// Who may start a new rifle comp-score upload (paste-parse in
// rifle-comp-parse, or the spreadsheet import in rifle-xlsx-parse) — the
// coach asked that this be narrower than is_rifle_admin()/is_s6(): only the
// two people who actually maintain the season workbook. Mirrored client-side
// in src/components/rifle/portal/rifleStats.js's RIFLE_UPLOAD_ALLOWLIST for
// UI visibility only — this file is the real gate, since it runs inside the
// edge functions.
export const RIFLE_UPLOAD_ALLOWLIST = [
  "lukevetsch77@gmail.com",
  // TODO: add Kaz's email here.
];
