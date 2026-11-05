# Military Ball system review — November 5, 2026

The reviewed code passes the automated checks below. Live Chief database readiness and reservation reads also pass; the earlier missing-database-function blocker is resolved. This is evidence for the tested paths, not a guarantee against network outages, inaccurate staff entries, or every possible concurrent action.

## Issues corrected in this review

1. **Staff signatures:** removed the staff-signature line from Chief’s generated packet. Attendee and parent signatures remain where their forms require them. A regression test prevents the staff-signature line from returning.
2. **Concurrent cashier changes:** Chief’s confirmation retains the originally reviewed action, value, guest ID and name. A refresh cannot silently turn “receive payment” into “revoke payment.” The database update matches the reviewed value; a changed record produces no write. Browser simulation confirmed that another cashier’s payment stays recorded.
3. **Interrupted public requests:** public Ball API calls now have a finite timeout and consistently return an error result even when the transport throws or returns no data. Signup and guest verification can leave their busy state instead of getting stuck. Read failures do not imply a reservation was saved.
4. **Partial guest verification:** a retry now reconciles the parent reservation even if guest verification was already saved. The required phone number is included in the guest update. Repeated verification preserves the original guest answers. Missing invitations do not mark a host verified. Optional notification failures no longer turn successful verification into a failed response.
5. **Misleading completion wording:** guest confirmation now states that payment, signed permission forms, and attire approval remain separate. Missing invitation URLs have a useful return path.
6. **Premature registration email:** cadet confirmation now waits until the required reservation and guest records exist. A rejected guest insert cannot send a false signup confirmation before cleanup. Email sends have finite timeouts; actual provider acceptance is returned to the signup screen. Failed mail does not erase a saved signup, and the screen tells the cadet how to request a resend or printed packet.

7. **Unneeded private fields:** Chief’s protected endpoint now removes allergy and separate attire-review fields from packet responses. Invitation/contact and payment facts remain available. The service-only database RPC rejects anonymous calls (verified `42501`); source SQL includes the same projection as defense in depth.

## Verification

| Area | Checks | Result |
|---|---|---|
| JavaScript behavior | 42 tests: ticket eligibility, label printing, 140 database/JS decision comparisons, check-in and practice mode, protected attire codes, packets, request failures | Passed |
| Backend/PDF behavior | 50 Deno tests: guest invitation/verification, VIP compatibility, guest changes, cancellation, current receipts and PDF rendering | Passed |
| Backend compilation | All 22 Ball signup, lookup, guest, reviewer, Chief, receipt, cancellation, door and notification functions | Passed |
| Chief database operations | Creation replay, duplicate rejection, authorization, stale guest/payment/price rejection, no-email registration, paper completion, preserved payments, audit snapshots, restricted Ops views | Passed in disposable PostgreSQL |
| Reservation changes | Paid/unpaid friend removal, date merge, removed-date restoration, guest addition; reviewed pricing and payment allocations, stale proposals, duplicate identity and idempotency | Passed in disposable PostgreSQL |
| Door and permissions | Separate arrivals, undo, stale stations, revoked access, parent forms, school identity, payment/attire denial, reviewer allowlist, code limiting, RPC and RLS isolation | Passed in disposable PostgreSQL |
| Tickets and print freshness | Atomic ledger snapshot/version, changed eligibility, verified mixed batches, saved delivery, on-site denial and admission parity | Passed in disposable PostgreSQL |
| UI | Persistent left list/right details, compact layout, phone-width overflow, creation and print flow, failed refresh/recovery; concurrent cashier change simulated without live writes | Passed local browser checks |
| Static/build | Ball-scoped lint, production Vite build, whitespace checks | Passed |

There are 11 SQL integration suites in the database coverage above. The expanded fixture was built from schema metadata and the repository’s migrations in a disposable local database; it was not loaded into production. Missing fixture dependencies and grants encountered while assembling that fixture were corrected in the fixture before the final suites passed.

## Live checks and deployment state

- Read-only live readiness: `ball_ops_reservation` health succeeds; packet reads succeed and contain a content version; the current ticket snapshot succeeds.
- The audit snapshot contained 74 reservations, 42 guests, and 21 recorded ticket deliveries. Missing payments/forms/verification/attire and one unknown school status remain ordinary attendee requirements; the audit did not mark them complete or bypass eligibility.
- Updated `ball-guest-verify`, `ball-submit-signup`, and the packet filtering in `ball-ops-reservation` backend functions were deployed after compilation and checks, preserving their existing public JWT configuration.
- Chief’s endpoint and guest-invitation resend endpoint were already deployed in the prior work.
- Frontend changes, including signature removal and cashier confirmation behavior, are in the local workspace/build. Production frontend publication was not part of this audit.
- No live attendee was created, removed, charged, refunded, approved, checked in, or sent an email by the audit.

## Practical limits

An authenticated live save/removal and actual email delivery were not exercised against real attendees. Guest verification remains a multi-request operation; retries now recover an interrupted parent update. Ticket/admission checks independently require both host and guest verification. Network or email-provider failures are handled explicitly but cannot be ruled out. Previously downloaded or printed documents remain historical copies.
