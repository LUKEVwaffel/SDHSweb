# Chief Ball reservation tools

Implemented in Ball Ops: guided roster search, solo/date/friend creation, optional guest email, paper registration acknowledgment, received forms and payments, guest removal with confirmation, and a printable receipt plus per-attendee dress-code instructions. Print opens a browser document; choose Print / Save as PDF. Each attendee receives a separate instructions/signature page. Female contacts and Weston come from the existing shared contact constants.

## Deploy

1. Apply `supabase/ball_reservation_changes.sql` if its amount_paid/payment trigger migration is not already installed. Follow existing deployment order for that migration; do not rerun older reservation-change functions over newer additions.
2. Apply `supabase/BALL_OPS_RESERVATIONS.sql`.
3. Deploy `ball-ops-reservation` and the updated `ball-resend-guest-invite` with the project's normal authenticated-function configuration.
4. Publish the frontend through the existing hosting workflow.

Current status: the Chief endpoint and resend endpoint are deployed, and a November 5 read-only check confirms that the database function is installed and ready. Frontend changes remain local. The audit did not modify existing reservations. New actions require an active Ball Ops reviewer who has completed the password gate. The database RPC is service-only and independently checks the reviewer capability. Existing base-table column permissions are unchanged.

The creation screen uses the cadet roster's school email as database identity without requiring the cadet to receive email. Cadet name, company and LET are loaded on the server. No made-up personal contact information is stored. Guest email is optional for paper packets (stored as an empty string to support the existing NOT NULL schema). In email mode the saved screen provides an explicit send/retry button, so a mail failure does not cause another reservation to be created.

Paper-completed guest registration requires Chief to confirm that the actual signed paperwork and dress-code acknowledgment were reviewed. It does not grant attire approval. Required forms and payment remain independent. Chief can later change received payment/form flags through existing tools.

Removal locks and checks the selected guest and the reviewed host payment. A date removal switches the host to the configured solo price while preserving the amount paid. Friend removal preserves host price/payment. Both retain the deleted guest and payment details in `ball_ops_audit` for staff review, including separate friend payments. No automatic refund is issued. Packet reprints retrieve current server records.

## Verification

- `npx vite build` and targeted Oxlint.
- `node --test tests/ballOpsPacket.test.mjs`.
- `tests/ballOpsReservations.integration.sql` against a disposable local PostgreSQL database, with the existing payment trigger installed: paid dates, pending friends, paper acknowledgment, duplicate and unauthorized rejection, stale payment rejection, payment preservation and audit snapshots.
- Browser review of roster selection and the paperwork form with isolated mock data. Improved button legibility, narrow-screen wrapping, labels, focus rings, form validation and detail-mode feedback. Live authenticated end-to-end and email-delivery testing still require deployment.

## Full Ball audit and compact workspace (November 5, 2026)

The Chief portal now uses the available width with the list on the left and a selected reservation or creation flow on the right. The large header and summary strip were removed; creation is in the list toolbar and secondary controls are in the footer. Desktop panels scroll independently within the viewport. Phone layouts stack details above the list without horizontal overflow.

The dev-only fixture is at `/tests/browser/ball-ops.html` when Vite is running. It renders the actual portal with sample data and intercepts all network calls. It neither writes live records nor sends mail. It is not a production entry point. The real authenticated portal remains `/ball/ops`.

Audit fixes include:

- Keeping in-progress forms/details on refresh failure, blocking stale writes, and discarding superseded refresh results.
- Confirming the exact current guest, payment, and solo price before removal; record changes invalidate the confirmation.
- Idempotent creation requests so a lost response can be retried without creating another reservation.
- Completing guest registration from reviewed signed paper in the reservation detail, independently of payment/forms/attire.
- Confirmed school information for guests exempted from SDHS forms, finite prices/payments, and checking for an existing guest email before creation.
- Re-fetching saved records for packet reprints, using the backend's public website origin instead of localhost, and using shared per-person form requirements.
- Pinning emailed invitations to the reviewed guest and email address.
- Web Crypto byte-array compatibility with current Deno TypeScript for signup tokens and protected attire codes. Hashing and verification rules are unchanged.

Verification: 36 JavaScript tests, 45 Deno backend/PDF tests, six edge-function type checks, Ball-scoped lint, and production build. Disposable PostgreSQL suites covered Chief operations, ledger snapshot freshness, verified label batches, database/JavaScript readiness parity (140 boundary cases), and door admission parity. Browser checks covered selection, guest-paper completion, separate friend payment, failed refresh and recovery, no-email creation, and phone-width overflow. Older PDF test mocks were updated to the current atomic ledger-snapshot contract.

A read-only production check confirmed the current ticket snapshot is available and the new Chief RPC is not yet installed. No production reservation, payment, approval, arrival, or email was changed. Authenticated live end-to-end testing and actual email delivery remain deployment checks.

### Deployment outcome and connection-error fix

`ball-ops-reservation` and `ball-resend-guest-invite` have now been deployed. The new endpoint responds to preflight with HTTP 200. The connected credentials were denied database-query access (HTTP 403), so `BALL_OPS_RESERVATIONS.sql` still needs to be run by an authorized operator in the Supabase SQL editor. The function checks database readiness before offering ticket prices, so creation stays disabled until setup is complete. The migration also adds missing roster/contact facts to the existing Ops views without exposing invitation tokens or medical details.

The old “request may have reached the server” warning is now limited to uncertain writes. Failed reads explicitly say they do not change reservations; a missing endpoint identifies deployment setup. Two regression tests cover those distinctions. Latest JavaScript count: 38 tests; Deno backend/PDF count: 45.

The global cybersecurity startup dialog was unmounted from `main.jsx`; the remaining promotional context defaults to ready so unrelated homepage behavior is retained.

### Follow-up full audit

The earlier SQL installation blocker is resolved: live health and packet/version reads now succeed. See [the full review](ball-system-review-2026-11-05.md) for the current verification and deployment state. This supersedes the earlier missing-function and 403 installation notes above. Staff signatures have been removed from generated packets.
