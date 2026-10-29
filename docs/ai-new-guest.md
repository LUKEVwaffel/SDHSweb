# AI: add a new guest to an existing Ball reservation

S-6 can prepare `prepare_ball_guest_addition(signup_id, guest)` without an existing solo reservation for the new guest. The dedicated SQL functions use the existing `ball_reservation_changes` audit and reviewed Apply flow. This adds a pending invitation, never a fake verification or approval.

Resolve the exact host and check active/removed guests first. Required information: date/friend, full name, personal email, age, gender, current SDHS enrollment and school. Existing cadet dates use an exact roster ID. Outside-program guests need the same point-of-contact name/email/phone required by the signup form. Ask for missing details together; don't tell a new guest they must create a solo reservation.

The review card shows current/after totals, existing payment, remaining balance/credit and guest details. Add guest & send invitation atomically creates one unverified guest, sets the host to guest_pending, preserves existing host forms/attire/payment, and sends the standard guest verification invitation plus host update. Date uses current couple pricing. Friend preserves the host price and uses the current solo price as a separate unpaid ticket; record its payment separately even if the host physically brings it. Existing host money is never automatically credited to that new friend.

Preparation writes only a pending audit proposal. Applying stale/expired/occupied or already-delivered reservations is rejected. Repeated Apply returns the same saved result. Guest email uniqueness is case-insensitive. Invitation retry checks the exact applied change, current guest and reviewed email, and uses a stable provider idempotency key. Never expose verification tokens in tool results. Provider acceptance is not inbox delivery.

## Deployment/source integration

Install BALL_ADD_NEW_GUEST.sql after the existing reservation-change migrations. Deploy ball-resend-guest-invite, ball-reservation-change and dispatch-ai-chat with JWT checks retained. Update BallReservationChange.jsx in the AI frontend.

The full Dispatch AI implementation remains in the original active checkout. `supabase/patches/dispatch-new-guest.patch` preserves the exact chat-tool dispatch and capability-list changes against the prior deployed source; apply it to that implementation when integrating branches. The new tool schema and instructions are in `_shared/ballGuestAdditionTool.ts`. The active source also adds the new-guest section to its knowledge and rebuilds knowledge.generated.ts with scripts/sync-knowledge-base.mjs. The deployed AI uses these updated sources.

## Validation

Disposable DB only: tests/fixtures/ball-new-guest-schema.sql, BALL_ADD_NEW_GUEST.sql and tests/ballGuestAddition.integration.sql on top of the existing Ball test fixture. Covers preview-only behavior, missing details and unauthorized rejection, stale state, payment/host-status preservation, pending guest requirements, separate unpaid friend tickets, duplicate email and retry idempotency.

Run `deno test --no-lock tests/ballGuestInvitation.test.ts` and type-check the three endpoints. No feature test creates real attendees or sends real invitations.
