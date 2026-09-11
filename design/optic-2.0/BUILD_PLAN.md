# OPTIC 2.0 Beta — build plan

Target: Spring Hill Raider Competition, Thu 2026-09-11.
Design source: `OPTIC Redesign.dc.html` (4 screens: LOCKED / ONBOARDING / FEED / REEL).
`ios-frame.jsx` + `support.js` are Claude Design canvas scaffolding — reference only, not ported.

Survey basis: 12 responses, `optic-return-2026-09`. 100% would bring OPTIC back.
Only real asks: **team filter** (42% top change, 25% worst trouble spot), one **upload-cap bug**,
notifications (92% receptive). Everything else scored ~0% problems.

---

## Decisions locked

| Topic | Decision |
|---|---|
| Name | OPTIC 2.0 Beta |
| Route | `/rhea` -> `/optic` |
| Rhea hardcoding | Full strip: dir `rhea/` -> `optic/`, `RHEA_EVENT_ID` -> `optic_config.active_event_id`, hooks/lib/css renamed, all "RHEA COUNTY" strings gone, new localStorage keys |
| Feed layout | Hero (first photo, native aspect) + 2-col square grid. Was 1-col list |
| Feed order | Newest capture first — `coalesce(taken_at, created_at) DESC` |
| Filter | Chips: ALL / MALE / COED / UNASSIGNED, per-chip counts, team-colour active state. Reel pages the filtered list |
| New photos while scrolled | "N NEW up" pill -> prepend + smooth-scroll top; auto-flush at top or after 3.2s |
| Upload entry | FAB `+` bottom-right -> slide-up bottom sheet. Was always-on in-feed card |
| Parent upload | Add team picker (Male / Coed / Not sure) so parent photos hit the filters |
| Capture time | `exifr`, read from original file BEFORE resize/HEIC-convert. Both Luke-bulk + parent paths. `photos.taken_at`, NULL ok |
| Team tagging | Schedule windows x `taken_at` -> `optic_retag_photos(event)` RPC. No window = dead time (posts, no chip) |
| Schedule | All events loaded from MOI night before, times NULL. Editor in `/lukepwa` sets/drags times on-site. Camera-offset field |
| Upload limits | Killed. Flood-stop only (400 / 10 min / device) |
| iPhone download | Web Share API file -> Save to Photos. `<a download>` is dead on iOS |
| Zoom | Pinch-zoom in reel, scroll-snap disabled while zoomed (not in mock — added, it's a locked ask) |
| Notifications | Web push, opt-in, installed-PWA only. Trigger = Luke taps send after RE-TAG. Per-event batch, never per-photo |
| Face recognition | Dropped |

Team colours: male `#C9A961` · coed `oklch(76% 0.1 205)` · unassigned `rgba(244,236,216,0.55)`.
Palette unchanged: ink `#06101F`, deep `#0A1628`, navy `#142847`, gold `#C9A961`, bright `#E8C77A`, cream `#F4ECD8`.
Type: Oswald (head) / Inter (body) / JetBrains Mono (labels).

---

## Slices, in build order

### 1. SQL migration — DONE (`supabase/optic_2.sql`), Luke to run
`photos.taken_at` · `raider_sub_events.starts_at/ends_at` (nullable) · `optic_config`
(camera offset + active event) · loosen `photos_rate_limit` · `optic_retag_photos(event)` RPC.
Gate reset is a day-of one-liner (in the file's footer comment).

### 2. De-Rhea rename + config  `[no visual change]`
- `src/components/rhea/` -> `src/components/optic/`; files `Rhea.jsx` -> `Optic.jsx`, `RheaOnboarding` -> `OpticOnboarding`, `LukeUpload`, `LukePwa`, `AdminGate`, css.
- `src/lib/rheaComp.js` -> `opticComp.js`; `RHEA_EVENT_ID` const -> read `optic_config.active_event_id` (hook `useOpticConfig`).
- `src/hooks/useRhea*.js` -> `useOptic*.js`.
- `App.jsx`: route `/rhea` -> `/optic` (keep `/rhea` 301-style redirect for old links one comp).
- localStorage keys `rhea_onboarded` / `rhea_walkthrough` -> `optic_onboarded_v2` / `optic_walkthrough_v2`.
- Kill "RHEA COUNTY" in: header title, beta banner, lock badge, onboarding kickers, `navigator.share` title. Pull event title from config.
- Other referencers to update: `OpticPopup.jsx`, `RaiderCarousel.jsx`, `tv/TvCongratsScreen.jsx`, `raiderCompGallery.js`, `compPhotoVote.js`, `useRheaLikes.js`.

### 3. EXIF capture time  `src/lib/opticExif.js` (new)
- Add `exifr` dep. `readTakenAt(file)` -> ISO string | null. Reads `DateTimeOriginal` (+ `OffsetTimeOriginal`).
- `Optic.jsx` `UploadCard.addFiles`: read taken_at from the raw File before `resizeForUpload`; for HEIC read from the `.heic` before `convertHeicToJpeg`, carry through the swap.
- `LukeUpload.jsx` bulk path: same, per file. Show "reading photo times… N/M".
- `opticComp.js` `uploadOpticPhoto(file, { ..., takenAt })` -> insert `taken_at`.
- Post-upload summary: "280 uploaded · 265 have capture time · 15 no EXIF -> dead time".

### 4. Feed redesign  `Optic.jsx` + `optic.css`  → mock: FEED
- Sticky blur header: glyph + `SDHS JROTC · OPTIC` + event title + `?` help.
- Filter chip row (horizontal scroll, right-edge fade). Counts from photos.
- `visiblePhotos` = filter on `raider_team` (`both` shows under MALE and COED).
- Hero figure (visible[0], native aspect) + `grid-template-columns:1fr 1fr` squares (aspect 1/1).
- Each tile: img, like pill (absolute bottom-left), team chip, caption (name + chip; hero adds time).
- Sort `coalesce(taken_at, created_at)` desc in `useOpticPhotos`.
- Queued-insert pattern: realtime inserts while `!pastTop` go to `queued[]`, not `photos[]`.
  "N NEW up" pill (op-pop) -> `flushQueued`. Auto-flush on scroll-to-top + 3.2s timer at top.
- Per-filter empty states.
- Infinite scroll / page size (~60) — feed currently maps every row.
- Time label shows capture time.

### 5. Reel redesign  `Optic.jsx` (Reel)  → mock: REEL
- Keep the scroll-snap vertical Shorts reel (survey liked it). Layer mock's styling:
  full-bleed `#030810`, top `pos / total` + close, right rail LIKE / SHARE / SAVE as
  circular glass buttons, bottom-left name + chip + time. Conditional prev/next chevrons.
- Reel list = the filtered `visiblePhotos`, not all.
- **Pinch-zoom**: `touch-action` + transform, disable snap while zoomed, double-tap 2x.
- **SAVE**: `navigator.canShare({files})` -> `navigator.share({files:[File]})`; else open full-res
  tab + "long-press -> Save to Photos" hint; desktop/Android keep blob `<a download>`.
- SHARE: keep `navigator.share` url path.

### 6. Onboarding + Locked redesign  `OpticOnboarding.jsx` / lock screen  → mock: ONBOARDING, LOCKED
- Onboarding down to 3 steps: `welcome` -> `role` (A CADET / FAMILY) -> `install`.
  Dots for role+install, Skip (hidden on install), primary "START" / "ADD TO HOME SCREEN".
  Drop the 2 about-panels + separate done screen. De-Rhea copy. New storage key.
  Install step mentions notifications.
- Lock screen: BETA badge, aperture glyph, "The feed opens {day, time}.", countdown card, install hint. De-Rhea.

### 7. FAB + upload bottom sheet  `Optic.jsx`
- Replace always-on `UploadCard` with FAB `+` -> overlay + slide-up sheet.
- Sheet: dashed drop zone, multi-pick, per-thumb status (converting/uploading/done/failed),
  name field, **team picker**, HEIC "converting N…", reject message, POST button.
- Kill the "exceeded limit" failure branch. Partial failure keeps the tray.

### 8. Schedule editor  `src/components/optic/OpticSchedule.jsx` (new), in `/lukepwa`
- Row list: name / team select / start / end (time inputs, date = comp day). Add / edit inline / delete.
- "No time set" state. Camera-offset field -> `optic_config.camera_offset_seconds`.
- Overlap warnings (same team, windows overlap). Gap / dead-time display.
- RE-TAG button -> `rpc('optic_retag_photos', { p_event_id })` -> toast "214 tied · 38 dead time".
- Live per-bucket counts. Cross-link: "38 unassigned -> tag them" jumps to tagging tab pre-filtered.
- Tagging tab: add range-select (tap first, tap last, whole run) + "DEAD TIME" filter.

### 9. Notifications  `src/lib/opticPush.js` (new) + edge fn `optic-send-push`
- `push_subscriptions` table (endpoint, keys, device_fp, event_id). VAPID keys as secrets.
- SW (`optic-sw.js`) `push` + `notificationclick` handlers.
- Opt-in card in feed: "Turn on photo alerts" (behind a tap). Safari-not-installed -> "add to home screen first".
- Settings toggle to unsubscribe.
- `/lukepwa`: "Send alert — 42 new from The Gauntlet, notify N families?" after RE-TAG. Last-sent + cooldown.

---

## Ship gate (Thursday MUST)
Slices 1-5, 7. De-Rhea, EXIF order, feed + filter, reel + iOS save, upload sheet, limits gone,
events + schedule loaded, gate reset.

## Fast-follow (Thu if time, else right after)
Slice 6 polish, 8 (schedule editor can be crude for v1 — even raw SQL windows + RE-TAG button), 9 push.

## Needs Luke
- Run `supabase/optic_2.sql`.
- Full MOI -> event + sub-event rows (names + teams; times blank).
- `/design-login` from an interactive terminal if we want to pull the canvas again.
- Confirm camera clock is synced; note any offset.
- Day-of: gate reset UPDATE, set `optic_config.active_event_id`.
