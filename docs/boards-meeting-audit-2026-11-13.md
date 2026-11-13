# Leadership workshop audit — November 13, 2026

Meeting entry: https://www.sdhsjrotc.com/boards/meeting

The workshop was reviewed across authentication, company isolation, shared edits, presenter controls, review freezing, signatures, reconnection, and browser navigation. This report describes tested behavior, not a guarantee that every school device or network has been rehearsed.

## Issues corrected

| Issue | Correction |
| --- | --- |
| A leader already signed into another portal could bypass board PIN setup and reach signing without a PIN. | Both initial authentication and refreshed identity check whether their assigned seat still needs a PIN. Existing portal sessions cannot skip setup. |
| An in-flight read could be mistaken for the refresh after a save. | Refreshes are serialized; mutation completion requests a new read after any older read finishes. |
| A hanging request could leave a stale green connection indicator and enabled actions. | Reads have a deadline, connection freshness advances on a clock, and stale actions are disabled while editable work remains recoverable. |
| Polling could erase a meaningful action error. | Connection errors and operation errors have separate state. Failed operations remain visible, including within confirmation dialogs. |
| Repeated multi-table reads could combine different points in a session transition and eventually truncate history. | One RLS-governed snapshot RPC returns current company sessions, frozen reviews, signatures, identity, and permitted account status together. |
| Unsaved scoring could disappear when leaving or refreshing the sheet. | Leaving prompts for confirmation; a temporary, account/session/cadet-scoped tab recovery copy preserves unsent work and its original revision. |
| Recovery after another leader saved could accidentally use a newer revision. | Recovered work keeps its old revision. It cannot overwrite another leader. An already-committed identical form is recognized after a lost response. |
| A prior account's review checkbox or dialog could survive into another user or round. | Account, role, session, and phase changes reset transient editing/review/signing state. |
| A partial draft could enter the list leaders sign. | Session closure freezes completed results and separate simulated examples. Original drafts remain outside the signed review. |
| A host request with a company-session ID could close only part of a global meeting. | Presenter-controlled close always closes every company session in that round. |
| A company could start independent practice while the global round still awaited other signatures. | The server blocks independent starts until the shared round is complete or explicitly cancelled. |
| An absent leader or interrupted independent rehearsal could prevent a clean restart. | A presenter can cancel a round with a recorded reason. Existing records/signatures remain; no missing signature is manufactured. Open independent rehearsals are shown as a preflight blocker with cancellation controls. |
| DOB/PIN lockouts had no meeting-specific recovery path. | Presenter account help reports missing setup data and allows another verification attempt without changing a DOB or PIN. Unlock actions are recorded. Forgot-PIN changes remain in the existing S-6 account tools. |
| Expired setup proof could strand the user at PIN confirmation. | The endpoint returns the next step and the UI returns to DOB verification when necessary, or PIN login if another attempt already completed setup. |
| Cancelling a PIN dialog could still allow a delayed submit callback. | Closing, clearing, or resetting cancels the pending submission. Hardware keyboard signing still works. |
| Keyboard focus could escape a dialog or reset on every poll. | Dialogs trap focus, restore it on close, and keep focus stable during refreshes. |
| A partially edited promotion decision could make Save draft fail. | Practice drafts can retain incomplete intent; full scoring/rank/eligibility checks still apply when completing. Drafts cannot enter the signed review. |

## Verification performed

- **27 automated board-rule, CSV, refresh, identity-setup, and recovery tests pass.**
- Disposable database integration tests cover initial enrollment, attempt locks, one-use proof, role restrictions, roster isolation, stale saves, closing, signature order independence, seal consistency, frozen drafts, cancellation/restart, and audited lockout recovery.
- Actual `authenticated`-role tests verify that a company account sees only its company's sessions and sheets, and cannot obtain privileged verification status.
- Separate database connections test simultaneous meeting starts, conflicting saves, and all three signatures arriving concurrently.
- **12 simultaneous live PIN sign-in tests passed in approximately 9 seconds.** These used temporary fictional viewer accounts, tested wrong-PIN rejection, real Auth token exchange, protected Edge Function authorization, and denied presenter access. Every temporary account was removed.
- Browser rehearsal used the actual UI components with an isolated fictional transport across a presenter and three leader tabs. It exercised scoring, unsaved-change protection, shared saves, remote closing, late joining, all three signatures, presenter restart, fresh review state, keyboard PIN signing, and cancellation of a pending PIN entry. It did not change production workshop records.
- The live roster contains 12 linked company leaders with DOB records and valid age plausibility checks; all four company rosters contain valid LET levels. Exact birthdays were not displayed, changed, or written to audit logs.
- PostgreSQL 17 production migration dry-run completed with rollback before applying. Local integration/concurrency tests use a disposable PostgreSQL 14 fixture.
- Frontend builds pass. Targeted lint has only the existing Fast Refresh warnings from the shared UI export pattern.
- Built public assets were checked for accidental inclusion of the service-role key or the development harness; neither was present.

## Remaining content and presentation steps

LET 1 class-knowledge questions are still blank in the supplied guide. The workshop explicitly identifies that section as pending and allows scoring practice; no questions were invented. Official boards retain their stricter content-readiness requirement.

Refresh the meeting page after release so an already-open tab loads the audited frontend. Use the presenter dashboard to confirm leader setup/online status, then start manually. Nothing starts based on the clock. The workshop cannot change official cadet ranks or real board records.
