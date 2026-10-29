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
