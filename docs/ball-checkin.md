# Ball check-in

The desk page is `/ball/checkin`. Staff sign in with a four-digit check-in PIN.

## Set up a staff member

1. In DISPATCH, open Military Ball → CHECK-IN.
2. Enter the staff member’s name and email and choose **Generate PIN**.
3. Give the PIN and check-in URL to that staff member privately. Their email
   identifies them in the audit log. They only enter the PIN at the desk.
4. Have them enter the PIN on the device they will use at the desk.
5. Disable the staff member from the same tab when access is no longer needed.

A PIN lasts 72 hours. Generate a replacement for the same staff email if it
expires or needs changing. A PIN signs into a separate desk-only identity, so
the staff member’s other sign-ins and DISPATCH privileges are unaffected.

## At the door

Search a cadet, guest or VIP by name, select the reservation, confirm the person
is physically present, then press **Check in**. If both people are present and
cleared, choose **Check in both**. Each person keeps a separate arrival record.
Use the **VIPs** filter to browse VIP reservations by either person’s name. Undo asks for confirmation. Unpaid tickets block entry and cash is never accepted at the door. Missing
verification still goes to Chief. Every attending SDHS student needs their own
signed form, including non-cadet guests. If school enrollment is unknown, the
desk must establish whether the attendee currently attends SDHS first.

Extra paper forms may be used only when the parent comes to the desk and signs.
The operator records the parent’s name and confirms the parent is present and
the signed paper has been received. Host and guest receipt are independent.
Recording a form cannot bypass payment or attire.

Aubry Gillott, Kylie Gray, Luke Vetsch, and Danielle can approve or deny attire at the door. The
reviewer opens Verify on site, chooses approve or deny with the arrow keys,
presses Enter, and enters their four-digit attire passcode. The code
automatically identifies the reviewer; the popup displays who verified it.
Incorrect-code limits apply per desk operator in sandbox too. Reviewer codes
must differ; duplicate codes fail closed and S-6 must reset one. No
passcode is saved in roster state or audit records. Denied attire blocks entry;
a corrected outfit may be reviewed again with an authorized code. On-site
decisions have an audit separate from the prior photo-approval record. A registered male cadet's standard
uniform does not require an individual attire approval unless rejected.

Counts describe people. Results group people into reservations, so a partially
arrived reservation appears in both arrival filters. Staff can search either
person's name. The live roster refreshes every 15 seconds or manually. The live desk pauses writes after a failed refresh until the next successful refresh.
A stale station cannot overwrite another station's arrival or undo.

Arrivals are stored independently of registration and payments. Every change
records the signed-in email in an audit log. No emails are sent by check-in.
Door staff see names, companies, companions, readiness issues and arrival times;
private contacts, medical details and verification tokens are excluded.

## Before leaving Wi-Fi

1. Use one supervised welcome-desk computer for offline check-in. Open
   `/ball/checkin` in its normal browser profile, sign in, and choose
   **Set up offline check-in**. It downloads the roster, switches the desk to
   local recording and gives staff a 24-hour work window. Prepare it after
   final payment and verification updates are in the roster.
2. While still connected, have each on-duty attire reviewer choose **Add attire reviewer** and enter their attire passcode. Choose **Copy code**. Each reviewer privately saves
   their generated offline code for this station. During an offline review,
   the reviewer enters that code. The station saves verification keys and
   signed decisions. The PIN and offline code stay out of the saved roster
   and action queue.
3. Turn off Wi-Fi and reload the page in the same profile. Confirm that the
   guest list opens, names are searchable, and the station shows it is ready.
   The roster and saved actions survive closing and reopening the browser.

Use the prepared desk for all arrivals at the venue. Independent stations
cannot see each other's work during an outage. The offline desk applies the
usual paid-ticket, verification, signed-form and attire requirements using the
saved roster. School confirmation, signed-form receipt, attire decisions,
check-in and undo are saved locally as they happen. Changes made elsewhere to
registrations or payments require a new roster prepared while connected.

## After reconnecting

Choose **Upload and return to live** with the same staff identity that prepared the
station. If the login expired, enter that staff member’s PIN again. The desk returns to live check-in once every saved action uploads.
Sync rechecks current entry requirements and revisions, preserves the original
arrival time and desk operator, and records the server receipt separately.
Retrying the same action after an interrupted upload does not duplicate it.

If a conflict appears, open **More options**, export the unsynced actions, and hand the file privately
to the organizer. The upload continues for other attendees. The conflicting
action and later actions for that attendee stay on the device for review.
Keep the device supervised and signed into its normal browser profile until
the queue is reconciled. The organizer can review synced offline operations in
the S-6-only `ball_offline_receipts` table.

## Development and deployment

- `/ball/checkin?sandbox=1` (also `?demo=1`) reads the real guest list using
  the signed-in staff account. Check-in, undo, form receipt and school
  confirmation stay in tab memory. Attire still requires the real protected
  passcode verifier, invoked with sandbox=true; it does not persist a decision.
  Credential lockout counters remain active for security. Attendance and form
  write RPCs are never called. Refreshing roster data retains local
  practice arrivals. Reset practice, reloading, or signing out clears them.
- Import `supabase/BALL_CHECKIN.sql` after the Ball, VIP and reservation-change
  schemas. It creates staff permissions, arrival storage and narrowly scoped
  roster/check-in RPCs. The migration does not check anyone in.
- Import `supabase/BALL_DOOR_RULES.sql` after `BALL_CHECKIN.sql` and deploy
  `ball-door-action` to verify the reviewer code and record live door decisions.
  Existing Aubry/Kylie staff PINs are reused; no new codes are generated.
- Import `supabase/BALL_CHECKIN_OFFLINE.sql` after the door status parity and
  automatic PIN migrations, then redeploy `ball-door-action`. Publish the
  production frontend through the usual pipeline. Offline preparation uses
  the built assets and requires HTTPS or localhost.
- Apply `supabase/BALL_CHECKIN_PIN.sql` after the offline migration. Deploy
  `ball-checkin-issue-pin` and `ball-door-action` with JWT verification, and
  `ball-checkin-pin-login` with `--no-verify-jwt` for the pre-auth PIN exchange.
  The SQL rate limit applies before a PIN can be matched.
- Apply `supabase/BALL_DOOR_ADDITIONAL_REVIEWERS.sql` after the desk PIN migration,
  then redeploy `ball-door-action` and `ball-door-reset-pin`. Configure Luke’s and Danielle’s
  separate door attire codes under **Military Ball → Check-in**.
- Apply `supabase/BALL_CHECKIN_PAIR.sql` for the paired arrival button. The
  live action uses one transaction and keeps the usual per-person audit.
- Attendance is scoped to the 2026 Ball; prepare a new event scope before reusing
  the system for another year's event.

Validation uses `node --test tests/ballCheckin.test.mjs`,
`tests/ballCheckinOffline.integration.sql` in a disposable fixture database, targeted lint, Vite production build, and
browser practice checks at desktop and phone widths. Never run fixture tests
against the production guest list.

## Keyboard shortcuts

- From search, Down/Up focuses the first/last result. Up/Down moves through
  results; Enter opens the focused reservation. Left returns to search.
- In the selected reservation, arrows move between available actions; Enter
  activates the focused action. Opening a reservation focuses check-in or
  Verify on site, depending on what is available.
- In the attire popup, arrows select approval or denial, Enter advances to PIN
  entry, and Enter submits the entered code. Escape cancels without a decision.
- The verification result names the actual reviewer. Enter on Done returns to
  the desk. Next arrival resets and focuses search. Entry still requires all
  payment, signed-form, verification and attire checks to pass.
- Import `supabase/BALL_DOOR_AUTO_PIN.sql` and deploy `ball-door-action` plus
  `ball-door-reset-pin` for automatic reviewer identification and code uniqueness.
