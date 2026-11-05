# Chief ticket receipt and birthday welcome

Chief's Ball portal shows three ticket states: **Hand out tickets**, **Tickets received**, or **Tickets not ready**. Full ticket readiness uses the existing payment, per-person form, verification and attire rules, including on-site decisions. The pickup person's name/company and the number of tickets are shown. Chief confirms a handoff with **Mark tickets received**. The server verifies current eligibility and the reviewed version; retries preserve the original receipt. The normal S-6 Ticket Delivery page and receipt/label exclusions share the same delivery records.

## Confirmed historical handout

The user confirmed **host company** as the basis for Alpha/Staff handouts, regardless of reservation completion. A fixed cohort of 31 existing reservations was captured on November 5, 2026. `BALL_OPS_TICKETS_ALPHA_STAFF.sql` installs tracking and records this exact cohort: 18 Alpha and 13 Staff. It is not a rule for future reservations. Eight pre-existing receipts are preserved; 23 new receipts are attributed truthfully to the user-reported historical handout, with previous delivery values retained for audit. The recorded timestamp is when the report was recorded, not a claim about the actual handout time.

The historical exception is stored in a service-only table, restricted to the original host company and companion identity, and usable only in the original recording transaction. It does not grant a lasting eligibility bypass. A persistent batch ID makes repeated SQL imports safe and prevents a rerun from undoing a later staff correction. New Alpha or Staff reservations are not automatically marked received. Receiving tickets never marks payments, forms, verification or attire complete and does not bypass door admission.

The user ran the combined script. Live verification confirmed **18/18 Alpha and 13/13 Staff received**, **23 newly recorded**, and **44 total received** across the Ball ledger. Twenty-one of the selected received reservations still have outstanding requirements; those requirements were retained.

## Installation and access

- `supabase/BALL_OPS_TICKETS.sql` installs the feature without recording any handouts.
- `supabase/BALL_OPS_TICKETS_ALPHA_STAFF.sql` includes the feature plus the fixed, one-time historical batch. It has already been applied and can be rerun safely.
- `ball-ops-reservation` has been deployed with the `tickets` and `receive_tickets` actions. Both require an active Ball Ops reviewer with the password gate completed. The database mutations are service-only; a browser cannot supply its own actor or manufacture a historical exception.
- Before installation, the endpoint provides a read-only compatibility view of existing ticket facts and disables receipt writes. It never infers a handout from a company name.
- Frontend publication is separate. The updated local build contains the UI and birthday welcome.

## Birthday welcome

After authorized entry to the portal, a full-screen confetti welcome says **HAPPY BIRTHDAY CHIEF — Congrats on turning 24**. It is shown once per account per browser using a dated local storage key. It can be dismissed with the button, close control or Escape, and respects reduced-motion settings. It does not modify reservation data or send messages. A separate dev-only preview is at `/tests/browser/chief-birthday.html`.

## Verification

- Database suite `tests/ballOpsTickets.integration.sql`: completion checks, original receipt preservation on retry, unauthorized calls, scoped historical records, companion changes, future reservations, stale confirmations and restricted exception-table access.
- The complete 31-reservation script was tested in a disposable fixture: 23 new/8 preserved, no attendee changes, no other-company changes, safe reruns, preserved later corrections, and no permanent exception after the original transaction.
- `tests/ballOpsTickets.test.ts`: read-only fallback, no automatic company receipts, completion independent of receipt, date/friend pickup and ticket counts.
- Browser checks: birthday dialog, dismissal and no repeat after reload; complete reservation handoff/confirmation; received Alpha sample retaining missing guest paperwork; compact left/right layout.
