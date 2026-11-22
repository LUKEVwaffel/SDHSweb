# Company promotion boards

Prepared November 13, 2026. For the shared leadership workshop and self-service PIN setup, see [boards-meeting.md](boards-meeting.md). The live route `/boards` uses the site's existing Supabase client and cadet database. `/boards/sandbox` uses fictional data and browser session storage.

## Confirmed rules

The user confirmed these rules on November 13; they override the older 15-point Annex E:

| Category | Maximum |
| --- | ---: |
| Correctly addressing the board | 1 |
| Facing movements | 3 |
| Full creed, pass/fail | 1 |
| Uniform inspection | 9 |
| JROTC knowledge | 3 |
| Class knowledge | 3 |
| Total | 20 |

Minimum promotion scores: LET 1 = 16; LET 2–4 = 17. Promotions advance exactly one rank, within the existing LET caps (CPL, SSG, SFC, MSG). Leadership positions receive an evaluation only; company CO/XO/1SG seats are excluded from boarding. Known personnel-directory links also prevent promotion server-side. Company leaders should confirm any leadership roles not present in that directory using the evaluation-only checkbox.

Class A starts at 9 points. Ranks, nametag, ribbons, arcs, star, crest, and socks each deduct 1; tie/neck tab and belt deduct 2 each. Any missing jacket, grey shirt, pants, or shoes sets the uniform score to zero. Deductions stop at zero. Khakis and polo receives all 9 points only when the board confirms the cadet has no issued uniform.

## Questions

Imported 69 question-and-answer pairs from the supplied `Boards study guide  (1).pdf`. Annex A maps to LET 1; B to LET 2; C to LET 3; D to LET 4. The bank retains the document's supplied answers; names and local officeholders have not been independently verified.

| LET | JROTC questions | Class questions |
| --- | ---: | ---: |
| 1 | 15 | 0 |
| 2 | 15 | 3 |
| 3 | 12 | 6 |
| 4 | 13 | 5 |

The board screen shows all questions and correct answers for the cadet's LET. There are no cadet response-entry fields. Each board member asks one question from each section. Before completing a sheet, the bank must contain at least three questions per section for that LET; LET 1 class questions remain outstanding. Drafts and absences can still be recorded. A completed sheet retains its question-bank snapshot so later edits do not change the signed record. S-6 maintains the bank in DISPATCH → Promotion boards → Questions & answers.

## Database installation and release

For an existing installation, apply only:

1. `supabase/BOARD_RELIABILITY.sql`
2. `supabase/BOARD_QUESTIONS_SEED.sql`
3. Deploy `board-sign-session` and `board-sai-signoff`, with JWT verification enabled.

For a fresh installation, first apply `supabase/company_boards.sql` and its listed prerequisites, then the two files above. Do not reapply the bootstrap file alone; it contains the legacy function definitions. The migration is transactional and rejects an implicit conversion of historical 15-point sheets. The question seed uses deterministic IDs and preserves any subsequent edits when reapplied.

The frontend changes must be included in the next normal site release. The current local preview runs with `npm run dev` at `/boards/sandbox`. No board quarter was opened during preparation; no real scores, signatures, promotions, or PINs were created.

## Reliability

Sheet saves use a stable UUID and the last confirmed `updated_at`; stale edits fail instead of overwriting another device's work. Saves and approvals serialize on the quarter row to prevent duplicate open sessions and races between saving, signing, and signoff.

The first signature freezes the original sheet contents. Each subsequent signature rechecks the seal. Final sealing and all sheet locks commit together. SAI signoff, roster promotions, and the recorded promotion count commit together; errors roll back the entire signoff. Repeated signature/signoff requests are harmless. Browser roles cannot invoke the service-only signature transaction functions.

Opening a company in a new quarter does not automatically begin a session; the first saved sheet creates it. Absentees may be boarded in a later session before final company signoff.

## Remaining setup

- Supply LET 1 class-knowledge questions and answers.
- Company leaders now set their own PIN after name/DOB verification at `/boards/meeting`. S-6 retains PIN recovery and SAI setup. No default PINs were assigned.
- Review account assignments and roster leadership flags before live use.
- Run the shared workshop as a staff acceptance rehearsal before opening the real quarter.

The built-in Leadership guide follows the exact sequence for the planned instruction video: prepare accounts/roster → welcome cadet → evaluate → inspect uniform → ask questions → decide → save → company signatures → Chief review → S-1/S-4 follow-through.

## Verification

- 19 board-rule and CSV tests pass.
- SQL integration assertions cover score thresholds, one-rank limits, khaki/polo eligibility, leadership exclusions, stale saves, signature order, post-signature immutability, seals, rollback on a forced promotion-write failure, repeat signoff, and service-only permissions.
- Migration dry-run passed against the live PostgreSQL 17 database with a rollback.
- The isolated integration fixture uses PostgreSQL 14 with only the PostgreSQL 15+ `security_invoker` view option omitted; production retains that option.
- Production frontend build passes. Targeted lint has existing Fast Refresh export warnings.
- Browser inspection confirms the LET 2 question-and-answer display and 20-point score sheet.
