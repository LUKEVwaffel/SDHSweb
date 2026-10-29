# Ball receipts and Ticket Delivery freshness

Receipts and Ticket Delivery read `ball_ticket_snapshot()`: one SQL statement containing the current host, guest, roster and saved-delivery records. A content version changes with any relevant record, and `checked_at` uses the database clock. RPC access is S-6/service only and exposes no invitation tokens or contact details.

Receipt generation uses this snapshot, excludes delivered/ticket-ready reservations, and saves both its version and regeneration filters. The authenticated `ball-receipts` function regenerates a packet. The PDF card and Ticket Delivery print action regenerate and compare the current database version before opening a PDF. If the read fails or records change during generation, printing is blocked. Legacy cards without saved filters explicitly regenerate all companies. Files already downloaded or printed remain historical snapshots.

Ticket Delivery and Ball Labels refresh every 15 seconds, on focus/visibility and realtime events, discard superseded loads, and block actions after a refresh failure. Label printing rebuilds names and eligibility from current rows; undelivered printing rechecks saved delivery. The database delivery guard validates the latest form/payment/attire rules, including SDHS guest forms despite an old exemption flag. No attendance, approval, payment or delivered flag is changed by installing this fix.

Receipt wording separates recorded approvals, denials and approval not recorded; pending attire may be reviewed on site by Aubry or Kylie. Paid paperwork-complete bookings have an explicit status. Generated PDFs include the exact timestamp/timezone.

## Deployment

Install `BALL_TICKET_DISTRIBUTION.sql` (current guard) then `BALL_LIVE_STATUS.sql`, deploy `ball-receipts` and `dispatch-ai-chat` with JWT verification retained, then publish the frontend. The AI chat deployment must include the updated shared PDF modules.

## Validation

Disposable Postgres fixtures: `tests/fixtures/ball-live-schema.sql`, the two migration files above, then `tests/ballLiveSnapshot.integration.sql`. Never run fixture inserts in production.

Run `node --test tests/ballLabelEligibility.test.mjs` and `deno test --no-lock tests/ballReceiptFreshness.test.ts`. The latter covers newly completed/delivered exclusions, preserving regeneration scope, approval wording, and failed snapshot reads.

## Full completion audit — policy 2

The older label predicate accepted NULL attire approval as “not rejected.” On the 72-reservation audit snapshot it admitted 12 reservations without required attire approval. Its ready count was 29 versus 18 under positive approval rules (one standard-uniform male had an old false flag and is correctly exempt from individual review). A further cross-check with door admission found one already-delivered reservation whose guest school status was unconfirmed. Final ticket-ready count is 17; the delivered record is retained and flagged for review, not silently revoked.

Both label paths now call the read-only S-6 `ball_label_print_batch` function. The database validates the entire selection, resolves current pickup names/companies, excludes delivered records for undelivered-only printing, and rejects the whole batch if any selected reservation is incomplete. Raw label names no longer satisfy the printer interface. `ball_ticket_blockers` is shared by database printing and delivery writes, with explicit NULL handling. In particular, an unpaid friend with an unknown payment method cannot pass through SQL three-valued logic.

`ball_ticket_snapshot({p_policy_version:2})` overlays actual on-site attire decisions. On-site denial overrides even a standard-uniform exemption. Receipts, labels, the admin overview and delivery use these facts. The previous no-argument RPC fails with a reload message so cached clients cannot continue with the previous contract. Staff must reload Dispatch after this release.

Overview green status now means ticket ready, registration verification is labeled separately, and Ops uses “cash/forms complete” for its narrower queue. School identity includes matched SDHS roster IDs; unknown guest enrollment is held for confirmation. Door admission has the same identity/finite-payment protections. Revocation no longer sends a “received” notification, and the endpoint verifies the saved field before any positive notification. Reminders compute remaining amounts from the ledger, use shared per-person requirements, and stop the remaining send loop if the ledger changes. No audit step sends email.

Install `BALL_LIVE_STATUS.sql`, `BALL_LABEL_PRINT_GUARD.sql`, `BALL_TICKET_DISTRIBUTION.sql` and (where the door system is installed) `BALL_DOOR_STATUS_PARITY.sql` in one transaction, then deploy updated shared PDF consumers, `ball-receipts`, `dispatch-ai-chat`, `send-ball-reminders`, `notify-ball-status-update` and the website. No attendee flags, payments, PINs or delivery records are modified by these migrations.

Additional tests: `ballSystemAudit.test.mjs` compares database and JavaScript decisions across 140 boundary cases, plus all 72 live snapshot records when `BALL_LIVE_SNAPSHOT` is supplied; raw printing and false receipt confirmation tests are included. The database fixtures are disposable only. `ballLabelPrintGuard.integration.sql` covers mixed batches, unpaid friends, school status, on-site denial, stale pickup company/name, duplicate selection, authorization and retired clients. `ballDoorAudit.integration.sql` covers admission parity. These checks do not promise protection against inaccurate staff entries or changes after a paper copy is printed.
