// Who may start an AI score-sheet read in rifle-comp-parse (spreadsheet /
// CSV imports are parsed client-side and need no edge function) — the
// coach asked that this be narrower than is_rifle_admin()/is_s6(): only the
// two people who actually maintain the season workbook. Mirrored client-side
// in src/components/rifle/portal/rifleStats.js's RIFLE_UPLOAD_ALLOWLIST for
// UI visibility only — this file is the real gate, since it runs inside the
// edge functions.
export const RIFLE_UPLOAD_ALLOWLIST = [
  "lukevetsch77@gmail.com",
  "kazminski_jay@hcde.org", // Sgt Kaz
];
