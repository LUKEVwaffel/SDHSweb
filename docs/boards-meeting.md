# Leadership meeting workshop

Prepared November 13, 2026 for the approximately 2:20 p.m. meeting. Nothing starts or ends on a timer.

## Meeting links

- Company leaders and presenter: `https://sdhsjrotc.com/boards/meeting`
- Independent company rehearsal: `https://sdhsjrotc.com/boards/practice`

The presenter uses an existing S-6 DISPATCH login in the same browser, or selects **Presenter or staff sign-in** and uses that account. The new **Open meeting controls** button is also available in DISPATCH → Promotion boards.

## Presenter sequence

1. Share the meeting link. All twelve leaders choose their names, verify their roster DOB once, choose a four-digit PIN, and confirm it. Existing PIN holders are sent straight to PIN entry. Supabase preserves completed setup and signed-in sessions.
2. Watch the presenter dashboard for leaders coming online. Presence is reported while their workshop page is open; an idle or disconnected browser may show offline. PIN readiness and signatures refresh automatically.
3. Click **Start meeting practice** when ready. Each company receives its own snapshotted roster, excluding the three board seats. Real names, LETs, and ranks are read from the existing cadet database. Practice changes never update that database.
4. Any CO, XO, or 1SG clicks the arriving cadet. All three screens open that cadet with questions and correct answers beside one shared grading sheet. Different categories merge; conflicting edits to the same field require review. Complete returns everyone to the roster; Pause retains grades for resuming. Leaders take turns asking questions.
5. Click **End practice & request signatures**, then confirm. All company sessions close for scoring. Completed and draft practice records are preserved. Up to six clearly marked simulated examples per company are added where that cadet has no saved practice. The examples use varied scores, promotion/hold decisions, and an absence. They use only that company's roster snapshot.
6. Open leader pages automatically switch to review. A late or reconnecting leader also sees the pending review. Each leader inspects the frozen list, confirms review, then enters their own PIN to sign their own position. Signatures can arrive in any order. The dashboard tracks all twelve.
7. A company session becomes signed only after CO, XO, and 1SG have all signed. A workshop round completes only after every company is signed. Start another practice round after completion if needed.

In independent company practice, a company leader starts the session and can end it after all saved drafts are completed or discarded. Ending requests the other two leaders' signatures in the same shared workflow.

## Audit update

See [the November 13 audit](boards-meeting-audit-2026-11-13.md) for the hardened workflow, recovery controls, and test evidence. Cancel/restart now preserves unsigned history without manufacturing signatures; completed reviews are frozen separately from unfinished drafts.

## Boundaries

- This is a shared online sandbox, separate from the old fictional per-tab `/boards/sandbox`.
- Real roster names remain company-restricted by row-level security.
- `board_practice_*` tables hold all training scores, sessions, presence, and signatures. Official `board_sheets`, `board_sessions`, quarters, and real cadet ranks are never written by practice functions.
- LET 1 class questions are still absent from the supplied guide. Practice remains available; the screen identifies the missing section. Official board completion retains its stricter question readiness checks.
- No cadet response-entry fields exist; the questions and correct answers are displayed for oral questioning.
- Notifications are in the open workshop page. Realtime changes plus polling and focus/reconnect checks deliver the session-ended state; this does not send emails, texts, or OS notifications.
- First-time DOB verification is limited to five failures before a fifteen-minute lock. The pre-auth name directory exposes no DOBs or school emails. Setup proofs expire after ten minutes, are stored hashed, and are single-use. An existing PIN cannot be replaced through DOB setup.
- S-6 can recover a forgotten PIN using the existing Board accounts tools. Leaders should not repeat DOB enrollment after setup is complete.

## Installation

Apply `supabase/BOARD_MEETING.sql` after the existing boards schema and `BOARD_RELIABILITY.sql`.

Deploy:

- `board-onboarding` with JWT verification disabled: it is the pre-auth endpoint and performs its own DOB/proof/PIN checks.
- `board-practice-sign` with JWT verification enabled: it verifies the signed-in leader and their own PIN before the service-only signature transaction.

Publish the updated frontend. The release was built from production commit `a869cf7b8d8d4558014a235424b38b52cf6ab5eb` plus only `src/components/boards`, `src/components/admin/panels/boards`, and `src/lib/boardRules.js`, preserving unrelated production changes.

## Verification

- Existing board rules and CSV tests: 19 passing.
- Disposable database integration checks: DOB failure lockout, single-use enrollment proof, returning-user setup status, service-only enrollment/signature functions, four-company roster creation, seat exclusion, stale-save rejection, cross-company isolation, presenter-only closing, frozen post-close saves, same-position idempotent signatures, consistent review seals, and no writes to official records or real ranks.
- Actual row-level-security tests use the `authenticated` role and verify one company's account sees only its company session and sheets.
- Separate database connections verify concurrent meeting starts create one round, conflicting first saves produce one success and one recoverable conflict, and three simultaneous signatures produce a fully signed session with one consistent seal.
- PostgreSQL 17 migration dry-run against production completed with rollback before applying. Integration and concurrency tests use a local disposable PostgreSQL 14 fixture.
- Frontend builds and targeted lint pass. Browser inspection confirms the live-backed twelve-name picker and DOB screen.
- Production smoke tests confirm the public directory exposes only intended fields, anonymous reads of enrollment secrets/practice records are denied, unknown DOB enrollment is rejected, and an unsigned signature request receives HTTP 401.

Do not include birthdates, PINs, setup tokens, or auth session tokens in logs, fixtures, screenshots, or the instruction video. Test fixtures contain fictional values only.

Apply `supabase/BOARD_SHARED_CADET.sql` after `BOARD_MEETING_HARDENING.sql`. It adds shared cadet selection, per-field optimistic concurrency, monotonic edit sequences, and completion/pause events. Whole-sheet browser saves are disabled. Verify with `tests/boardSharedCadet.integration.sql`, `tests/boardSharedCadet.concurrent.py`, and `tests/boardSharedFields.test.js`.
