# R2 migration audit

Read-only audit of every place the site stores files, taken on 2026-11-05,
right after the raider-videos move (Part 1). The goal is to move all file
storage to Cloudflare R2, so Supabase only keeps Postgres, Auth, Realtime, RLS
and Edge Functions.

Nothing in this document has been changed yet. It is the map for the work
that follows.

## Where things stand

- **Supabase Storage: 640.8 MB used** of the 1 GB free limit (was 1.495 GB).
  We are under quota again.
- **R2 actually holds data in only 2 buckets:** `optic-photos` (4,951
  files, 734 MB) and `raider-videos` (25 files, 10.9 GB). The other 11 R2
  buckets were created in September but are **empty**.
- **Sippy is still on** for `tv-team-photos`, `tv-daily-photos`,
  `beta-event-photos` and `event-photos`. Sippy is a Cloudflare feature that
  copies a file from Supabase into R2 the first time someone asks R2 for it.
  It is off everywhere else (and now off for `raider-videos`).

| Supabase bucket | Files | Size | Public? | Matching R2 bucket | Copied to R2 already |
|---|---:|---:|---|---|---|
| team-photos | 3,331 | 519.5 MB | yes | `optic-photos` (not `team-photos`) | 2,925 of 3,331 |
| staff-photos | 34 | 63.5 MB | yes | `personnel-photos` (empty) | 0 |
| achievement-icons | 26 | 38.6 MB | yes | `achievement-icons` (empty) | 0 |
| tv-team-photos | 22 | 5.2 MB | yes | `tv-team-photos` (empty, Sippy on) | 0 |
| ball-assets | 5 | 3.0 MB | yes | none | 0 |
| permission-slips | 2 | 2.8 MB | yes | none | 0 |
| beta-event-photos | 10 | 2.3 MB | yes | `beta-event-photos` (empty, Sippy on) | 0 |
| documents | 6 | 2.3 MB | **private** | `documents` (empty) | 0 |
| chat-attachments | 2 | 2.1 MB | **private** | none | 0 |
| tv-daily-photos | 11 | 1.6 MB | yes | `tv-daily-photos` (empty, Sippy on) | 0 |
| raider-videos | 0 | 0 | yes | `raider-videos` | done (Part 1) |
| aar-documents | 0 | 0 | **private** | none | n/a |
| email-attachments | 0 | 0 | yes | none | n/a |
| admin-avatars | 0 | 0 | yes | none | n/a |
| rafting-photos | 0 | 0 | yes | `rafting-photos` (empty) | n/a |
| raider-photos | 0 | 0 | yes | `raider-photos` (empty) | n/a |
| event-photos | 0 | 0 | yes | `event-photos` (empty) | n/a |

Buckets the code mentions that **do not exist in Supabase at all**:
`site-assets` and `personnel-photos`. The DISPATCH Media panel and the Health
panel both try to read them, so those tabs show nothing or report an error
today. R2 buckets with those names exist and are empty.

A second, older Supabase project also holds files:
`tpracdgjahzmqtzjsiol.supabase.co`, bucket `cadet-photos`. 24 personnel
photos, 5 admin photos and 5 login-picker photos still load from it (see
section 4). It does not count against this project's quota, but it is a
free project that nobody is watching. If it gets paused, those photos break.

---

## 1. How the existing R2 setup works

There are **two separate R2 systems**. They were built at different times
and work differently.

### A. OPTIC photos (`optic-photos` bucket, `workers/optic-r2/`)

Used by `/optic`, `/lukeupload`, `/lukepwa` and the OPTIC comp photo flow.

- **Worker:** `optic-photos`, live at
  `https://optic-photos.sdhs-battalion.workers.dev`. Source is in the repo at
  `workers/optic-r2/src/index.js`.
- **Reads:** `GET`/`HEAD` are public and cached for a year. Videos support
  byte ranges.
- **Uploads go straight to the Worker with no login at all.** This is how parents
  submit photos without an account. The Worker protects itself instead:
  - the key must look like `raiders/<event uuid>/<stamp>_<id>.jpg` (or
    `_t.jpg`, `_s.jpg`, `.mp4`, `.mov`, `.webm`)
  - photos must be real JPEGs (checked by the first bytes), 10 MB max
  - videos must have a matching video Content-Type, 95 MB max, and are
    checked after upload
  - it never overwrites an existing file
- **Deletes** need a Supabase login token in the `Authorization` header. The
  Worker checks it against `/auth/v1/user`. Note: it accepts **any**
  signed-in Supabase user, not only admins (see "Security notes").
- **Site code:** `src/lib/photoStorage.js`
  - `putPhotoFile(path, blob)` uploads to R2 when `VITE_OPTIC_R2_URL` is set,
    otherwise falls back to the Supabase `team-photos` bucket.
  - `removePhotoFiles(rows)` looks at each row's URL to decide whether the
    file is on R2 or Supabase, and deletes it from the right place.
  - `publicUrlFor(path)` builds the public URL.
  - Rows do not have a "backend" column. **The URL tells you where the
    file is.** A `photo_url` starting with
    `https://optic-photos.sdhs-battalion.workers.dev/` is on R2.
- **Used by:** `src/lib/opticComp.js` (uploads, videos, blur, grid thumbs)
  and `LukePwa.jsx`.

**Important:** `r2-presign` is **not** part of the public OPTIC submit. OPTIC
never calls it. Anonymous uploads only work through the `optic-photos` Worker.

### B. DISPATCH media (`r2-presign` + `r2-media-reader`)

Built in September for the 5 buckets that caused the egress spike.

- **Uploads and deletes:** `supabase/functions/r2-presign/index.ts`
  - Signed-in DISPATCH staff only. The caller must have an `admin_roles` row
    and must not be stuck on "change your password first".
  - Only these buckets are allowed: `beta-event-photos`, `event-photos`,
    `tv-daily-photos`, `tv-team-photos`, `raider-videos`.
  - Only `PUT` and `DELETE`. Keys with `..` or a leading `/` are refused.
  - It returns a presigned R2 URL that is good for 5 minutes. The browser
    then uploads straight to R2 with it.
  - It does not limit file size or type. That is acceptable because only
    staff can get a URL.
  - Secrets `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` are
    stored as Supabase function secrets.
- **Reads:** `workers/r2-media-reader/` (now in the repo, deployed
  2026-11-05). Public `GET`/`HEAD` at
  `https://r2-media-reader.sdhs-battalion.workers.dev/<bucket>/<key>`, with
  byte ranges and one-year caching. It only serves buckets listed in its
  `wrangler.toml`, which today are the same 5 buckets as above.
- **Site code:** `src/lib/r2Storage.js`
  - `r2Upload(bucket, path, file)`: asks `r2-presign` for a URL, then PUTs.
  - `r2Remove(bucket, paths)`: same, with DELETE.
  - `r2PublicUrl(bucket, path)` / `r2GetPublicUrl(bucket, path)` build the
    public URL. The base comes from `VITE_R2_MEDIA_BASE`, falling back to the
    workers.dev URL.
  - There is **no** list function and **no** signed-download function.
- **Used by:** `RaiderTvPanel.jsx`, `BetaFeaturesPanel.jsx`,
  `src/lib/tvPhotosFolders.js`, `src/lib/tvDailyPhotos.js`,
  `src/lib/raiderTv.js`.

### Image compression (`src/lib/imageResize.js`)

- `resizeForUpload(file)` makes a 1600px JPEG plus a 400px thumbnail
  (quality 0.82).
- `isRawFile(file)` rejects camera RAW files (`.cr2 .cr3 .nef .arw .dng .raf
  .orf .rw2 .pef .srw`), which browsers cannot read.
- Already used by: OPTIC uploads, `AdminBulkUpload`, `RaftingPanel`, TV
  photos, beta photos. `PhotoUploader.jsx` resizes but **does not** reject
  RAW files. `AchievementCatalog`, `AccountsPanel`, `MediaPanel` and the Ball
  gallery upload full-size originals with no resize (this is why 26
  achievement icons take 38.6 MB).

### Private files

R2 has no equivalent of Supabase RLS. Everything served by either Worker is
public to anyone who has the URL. Today the private files are protected only
by Supabase:

| Bucket | Supabase bucket public? | Who can read | How the site opens files |
|---|---|---|---|
| documents | no | `is_s6()` | `createSignedUrls` in MediaPanel |
| aar-documents | no | `is_s5()` or `is_luke()` | `createSignedUrls` in AarsPanel |
| chat-attachments | no | members of that conversation (folder = conversation id) | `createSignedUrl` in ThreadView |
| permission-slips | **yes** | anyone with the link | public URL stored on `events` |
| email-attachments | **yes** | anyone with the link | public URL, Resend downloads it when sending |
| ball-assets | **yes** | anyone with the link | public URL, Resend attaches it |

To move the three private buckets to R2 we would have to add a "signed
download" mode to `r2-presign` that repeats the same rules (S-6 only, S-5 or
Luke, conversation member). Never bind a private bucket to
`r2-media-reader`. That would make it public.

---

## 2. Every remaining `storage.from(` call

50 calls, all in `src/`. **There are no `storage.from(` calls in
`supabase/functions/`.** Edge functions only touch storage through URLs
saved in the database (see the notes under the table).

"R2 helper?" means: is there already an R2 helper we can swap in?

| File:line | Supabase bucket | Operation | Feature | R2 helper? |
|---|---|---|---|---|
| `src/components/PhotoUploader.jsx:157` | team-photos | upload | Public photo submit page | Yes: `putPhotoFile` |
| `src/components/PhotoUploader.jsx:159` | team-photos | upload (thumb) | Public photo submit page | Yes: `putPhotoFile` |
| `src/components/PhotoUploader.jsx:162` | team-photos | getPublicUrl | Public photo submit page | Yes: `putPhotoFile` returns it |
| `src/components/PhotoUploader.jsx:163` | team-photos | getPublicUrl (thumb) | Public photo submit page | Yes |
| `src/components/admin/panels/photos/AdminBulkUpload.jsx:66` | team-photos | upload | DISPATCH bulk photo upload | Yes: `putPhotoFile` |
| `src/components/admin/panels/photos/AdminBulkUpload.jsx:68` | team-photos | upload (thumb) | DISPATCH bulk photo upload | Yes |
| `src/components/admin/panels/photos/AdminBulkUpload.jsx:70` | team-photos | getPublicUrl | DISPATCH bulk photo upload | Yes |
| `src/components/admin/panels/photos/AdminBulkUpload.jsx:71` | team-photos | getPublicUrl (thumb) | DISPATCH bulk photo upload | Yes |
| `src/components/admin/panels/photos/PhotoSubmissions.jsx:53` | team-photos | remove | Photo moderation: delete | Yes: `removePhotoFiles` |
| `src/components/admin/panels/photos/PhotoSubmissions.jsx:206` | team-photos | upload | Photo moderation: blur face | Yes: reuse `opticComp.js` blur (see note) |
| `src/components/admin/panels/photos/PhotoSubmissions.jsx:208` | team-photos | upload (thumb) | Photo moderation: blur face | Yes |
| `src/components/admin/panels/photos/PhotoSubmissions.jsx:211` | team-photos | getPublicUrl | Photo moderation: blur face | Yes |
| `src/components/admin/panels/photos/PhotoSubmissions.jsx:212` | team-photos | getPublicUrl (thumb) | Photo moderation: blur face | Yes |
| `src/components/admin/panels/photos/PhotoSubmissions.jsx:232` | team-photos | remove | Photo moderation: blur cleanup | Yes: `removePhotoFiles` |
| `src/components/admin/panels/photos/PhotoSubmissions.jsx:270` | team-photos | remove | Photo moderation: remove blur | Yes: `removePhotoFiles` |
| `src/components/admin/panels/photos/RaiderPolls.jsx:61` | team-photos | remove | Raider poll: delete photo | Yes: `removePhotoFiles` |
| `src/lib/photoStorage.js:31` | team-photos | getPublicUrl | Fallback when R2 env var missing | Is the helper |
| `src/lib/photoStorage.js:37` | team-photos | upload | Fallback when R2 env var missing | Is the helper |
| `src/lib/photoStorage.js:39` | team-photos | getPublicUrl | Fallback when R2 env var missing | Is the helper |
| `src/lib/photoStorage.js:70` | team-photos | remove | Deleting old Supabase-hosted photos | Is the helper |
| `src/components/admin/panels/MediaPanel.jsx:48` | site-assets, team-photos, personnel-photos, achievement-icons, documents | list | DISPATCH Media library | No (no R2 list) |
| `src/components/admin/panels/MediaPanel.jsx:56` | documents | createSignedUrls | Media library: private docs | No (no signed GET) |
| `src/components/admin/panels/MediaPanel.jsx:66` | same 5 | getPublicUrl | Media library | Partly: `r2PublicUrl` |
| `src/components/admin/panels/MediaPanel.jsx:92` | same 5 | upload (upsert) | Media library | Partly: `r2Upload`, bucket not allowed yet |
| `src/components/admin/panels/MediaPanel.jsx:125` | same 5 | remove | Media library | Partly: `r2Remove`, bucket not allowed yet |
| `src/components/admin/panels/advanced/AchievementCatalog.jsx:76` | achievement-icons | upload (upsert) | Achievement icon replace | Partly: `r2Upload`, bucket not allowed yet |
| `src/components/admin/panels/advanced/AchievementCatalog.jsx:77` | achievement-icons | getPublicUrl | Achievement icon replace | Partly: `r2GetPublicUrl` |
| `src/components/admin/panels/advanced/AchievementCatalog.jsx:114` | achievement-icons | upload (upsert) | New achievement | Partly: `r2Upload` |
| `src/components/admin/panels/advanced/AchievementCatalog.jsx:115` | achievement-icons | getPublicUrl | New achievement | Partly: `r2GetPublicUrl` |
| `src/components/admin/panels/advanced/AccountsPanel.jsx:81` | admin-avatars | upload (upsert) | DISPATCH account photo | Partly: `r2Upload`, needs a bucket |
| `src/components/admin/panels/advanced/AccountsPanel.jsx:83` | admin-avatars | getPublicUrl | DISPATCH account photo | Partly: `r2GetPublicUrl` |
| `src/components/admin/panels/advanced/HealthPanel.jsx:28` | team-photos, personnel-photos, site-assets | list (limit 1) | Health check | No (replace with a Worker ping) |
| `src/components/admin/panels/EventsPanel.jsx:258` | permission-slips | upload | Event permission slip PDF | Partly: `r2Upload`, needs a bucket |
| `src/components/admin/panels/EventsPanel.jsx:261` | permission-slips | getPublicUrl | Event permission slip PDF | Partly: `r2GetPublicUrl` |
| `src/components/admin/panels/rafting/RaftingPanel.jsx:58` | rafting-photos | upload | Rafting trip photos | Partly: `r2Upload`, bucket not allowed yet |
| `src/components/admin/panels/rafting/RaftingPanel.jsx:60` | rafting-photos | getPublicUrl | Rafting trip photos | Partly: `r2GetPublicUrl` |
| `src/components/admin/panels/rafting/RaftingPanel.jsx:65` | rafting-photos | remove (failed insert) | Rafting trip photos | Partly: `r2Remove` |
| `src/components/admin/panels/rafting/RaftingPanel.jsx:86` | rafting-photos | remove | Rafting trip photos | Partly: `r2Remove` |
| `src/components/admin/panels/email/builder/EmailBuilder.jsx:105` | email-attachments | upload (upsert) | Email builder attachment | Partly: `r2Upload`, needs a bucket |
| `src/components/admin/panels/email/builder/EmailBuilder.jsx:111` | email-attachments | getPublicUrl | Email builder attachment | Partly: `r2GetPublicUrl` |
| `src/components/admin/panels/messages/Composer.jsx:34` | chat-attachments | upload | DISPATCH chat attachment | No (private) |
| `src/components/admin/panels/messages/ThreadView.jsx:63` | chat-attachments | createSignedUrl | DISPATCH chat attachment | No (private) |
| `src/components/admin/panels/aars/AarsPanel.jsx:75` | aar-documents | createSignedUrls | AAR tracker files | No (private) |
| `src/components/admin/panels/aars/AarsPanel.jsx:114` | aar-documents | upload | AAR tracker files | No (private) |
| `src/components/admin/panels/ball/BallPanel.jsx:93` | ball-assets | upload (upsert) | **Ball** field trip form PDF | Partly: `r2Upload`, needs a bucket |
| `src/components/admin/panels/ball/BallPanel.jsx:95` | ball-assets | getPublicUrl | **Ball** field trip form PDF | Partly |
| `src/components/admin/panels/ball/BallPanel.jsx:104` | ball-assets | upload (upsert) | **Ball** landing gallery photo | Partly |
| `src/components/admin/panels/ball/BallPanel.jsx:106` | ball-assets | getPublicUrl | **Ball** landing gallery photo | Partly |
| `src/components/admin/panels/ball/BallPanel.jsx:124` | ball-assets | remove | **Ball** landing gallery photo | Partly |
| `src/lib/r2Storage.js:4` | n/a | comment only | n/a | n/a |

Notes:

- **Hard-coded Supabase URL:** `src/components/Raiders.jsx:24` points a
  fallback image straight at the Supabase `team-photos` bucket. It needs to
  be changed to the R2 copy before `team-photos` is cleaned up.
- **Blur in PhotoSubmissions:** its blurred file names
  (`..._blur_<stamp>_<id>.jpg`) do not match the `optic-photos` Worker's
  upload key rule. Do not just swap in `putPhotoFile`. Reuse the blur
  function in `src/lib/opticComp.js`, which already uploads blurred copies to
  R2 with a valid key.
- **Edge functions that use storage by URL** (no `storage.from` calls):
  - `send-email` attaches email-builder files by their public URL
    (`content_json` blocks). Resend downloads them, so they must stay public.
  - `ball-submit-signup`, `ball-resend-guest-invite` and `send-ball-reminders`
    attach `ball_config.field_trip_form_pdf_url` (a `ball-assets` PDF).
  - `ball-receipts` builds receipt PDFs in memory and returns them as base64.
    **It never touches storage.** No ball labels or receipts are stored
    anywhere.

---

## 3. Buckets that need a new R2 bucket

| Supabase bucket | R2 bucket to use | Notes |
|---|---|---|
| team-photos | **`optic-photos`** (already in use) | The September script already copies here. Do not use the empty R2 `team-photos` bucket. |
| staff-photos | **`personnel-photos`** (exists, empty) | Yes, staff-photos is the personnel photo bucket. See below. |
| achievement-icons | `achievement-icons` (exists, empty) | |
| tv-team-photos, tv-daily-photos, beta-event-photos | same names (exist, empty) | Code already writes to R2. Only old files need copying. |
| permission-slips | **new:** `permission-slips` | Public, PDFs. |
| ball-assets | **new:** `ball-assets` | After Nov 21. |
| email-attachments | **new:** `email-attachments` | Public (Resend has to download). Empty today. |
| chat-attachments | **new:** `chat-attachments` | Private. Needs signed downloads. |
| aar-documents | **new:** `aar-documents` | Private. Empty today. |
| documents | `documents` (exists, empty) | Private. Needs signed downloads. |
| admin-avatars | none. Use `personnel-photos` | Empty. Account photos already live with staff photos. |
| rafting-photos | `rafting-photos` (exists, empty) | Empty both sides. Code change only. |
| raider-photos, event-photos | none needed | Empty, no code uses them. Delete the Supabase buckets later. |
| site-assets | `site-assets` (exists, empty) | No Supabase bucket. Only the Media panel tab uses the name. |

**Does staff-photos map to personnel-photos? Yes.**

- `staff-photos` holds 34 staff headshots named by person
  (`Aiden Clifton.png`, `Makaio Roos.png`, ...). Each is about 1.9 MB.
- `personnel.photo_url` (9 rows), `admin_roles.photo_url` (1) and
  `login_accounts.photo_url` (1) point at it.
- The Supabase `personnel-photos` bucket never existed. The Media panel's
  "PERSONNEL-PHOTOS" tab has always been empty.
- Only 8 of the 34 files are used by a row. The other 26 look like spare
  copies, but keep them until a person confirms.
- The other people's photos (24 personnel, 5 admin, 5 login picker) are in
  the **old project's** `cadet-photos` bucket. They should go to
  `personnel-photos` too, so everything lives in one place.
- Good moment to compress: a 1.9 MB PNG headshot can become a JPEG of about
  100 KB with no visible difference.

---

## 4. Database columns that store a file URL or path

Counted on 2026-11-05. "Supabase" means a `*.supabase.co/storage` URL.

| Table.column | Rows with a value | On Supabase | On R2 | What it holds |
|---|---:|---:|---:|---|
| `photos.photo_url` | 2,300 | 196 (team-photos) | 2,104 | Full-size photo URL |
| `photos.thumb_url` | 2,300 | 196 (team-photos) | 2,104 | Thumbnail URL |
| `photos.grid_url` | 735 | 0 | 735 | Grid thumbnail URL |
| `photos.storage_path` | 2,300 | n/a | n/a | Key, same on both backends |
| `photos.orig_storage_path`, `orig_photo_url`, `orig_thumb_url` | few | | | Original kept while a photo is blurred |
| `personnel.photo_url` | 33 | 33 (24 old-project cadet-photos, 9 staff-photos) | 0 | Staff/cadet headshot |
| `admin_roles.photo_url` | 6 | 6 (5 cadet-photos, 1 staff-photos) | 0 | DISPATCH account photo |
| `login_accounts.photo_url` | 6 | 6 (5 cadet-photos, 1 staff-photos) | 0 | Login picker photo |
| `achievements.icon_url` | 24 | 24 | 0 | Achievement icon |
| `tv_photos.photo_url` | 20 | 20 (tv-team-photos) | 0 | TV team photo |
| `tv_photos.storage_path` | 20 | n/a | n/a | Key |
| `beta_event_spotlight.photos` (jsonb array of `{url, path}`) | 1 row | 10 URLs | 0 | Beta spotlight photos |
| `tv_daily_settings.uploaded_photo_urls` (text[]) | 1 row | 0 (empty array) | 0 | TV daily photos |
| `tv_daily_settings.spotlight_photo_url` | 0 | | | |
| `events.permission_slip_url` | 2 | 2 (permission-slips) | 0 | Event permission slip |
| `ball_config.field_trip_form_pdf_url` | 1 | 1 (ball-assets) | 0 | **Ball** field trip form |
| `ball_gallery.photo_url`, `storage_path` | 0 rows | | | **Ball** landing gallery (empty) |
| `messages.attachment_path` | 2 | n/a | n/a | Key in private chat-attachments |
| `document_meta.storage_path` | 6 | n/a | n/a | Key in private documents |
| `aars.storage_path` | 0 | | | Key in private aar-documents |
| `raider_videos.storage_path` | 25 | n/a | n/a | Key, read from R2 (done) |
| `email_messages.content_json` (jsonb) | | 0 URLs today | | Email builder attachment blocks |
| `change_log.value_before` / `value_after` (jsonb) | | 352 URLs | | **History only.** Old values. Do not rewrite. |

`events_by_calendar` is a view over `events`, so it is covered by `events`.

`tv-daily-photos` has 11 files in Supabase, but no row points at them
(`uploaded_photo_urls` is empty). They are probably leftovers. Check `/tv`
before deleting them.

### SQL to count Supabase vs R2 rows

Run in the Supabase SQL editor. Read only.

```sql
with urls as (
  select 'photos.photo_url' as col, photo_url as url from public.photos
  union all select 'photos.thumb_url', thumb_url from public.photos
  union all select 'photos.grid_url', grid_url from public.photos
  union all select 'personnel.photo_url', photo_url from public.personnel
  union all select 'admin_roles.photo_url', photo_url from public.admin_roles
  union all select 'login_accounts.photo_url', photo_url from public.login_accounts
  union all select 'achievements.icon_url', icon_url from public.achievements
  union all select 'tv_photos.photo_url', photo_url from public.tv_photos
  union all select 'events.permission_slip_url', permission_slip_url from public.events
  union all select 'ball_config.field_trip_form_pdf_url', field_trip_form_pdf_url from public.ball_config
  union all select 'ball_gallery.photo_url', photo_url from public.ball_gallery
  -- photos is a jsonb array of {url, path} objects
  union all select 'beta_event_spotlight.photos', p ->> 'url'
    from public.beta_event_spotlight, jsonb_array_elements(
      case when jsonb_typeof(photos) = 'array' then photos else '[]'::jsonb end) as p
)
select
  col,
  count(*) filter (where url like '%bjgyvmdzcymruunzavni.supabase.co/storage%') as this_supabase,
  count(*) filter (where url like '%tpracdgjahzmqtzjsiol.supabase.co/storage%') as old_project,
  count(*) filter (where url like '%.workers.dev/%' or url like '%sdhsjrotc.com/%') as r2,
  count(*) filter (where url is not null
    and url not like '%supabase.co/storage%'
    and url not like '%.workers.dev/%'
    and url not like '%sdhsjrotc.com/%') as other
from urls
group by col
order by col;
```

`change_log` is left out on purpose. It is history, and its old URLs should
stay as they were.

---

## 5. Earlier migration work already in the repo

| What | When | What it did |
|---|---|---|
| `scripts/migrate-photos-to-r2.mjs` | Sept 2026 (PRs #43, #44) | Copies each `photos` row's files from Supabase `team-photos` to R2 `optic-photos` at the same path, then rewrites `photo_url` / `thumb_url` to the Worker URL. Never deletes from Supabase. **Result:** 2,104 of 2,300 rows moved. 196 Raider rows are still on Supabase, and only 3 of their files are in R2. It was probably stopped when Supabase restricted the project. |
| `workers/optic-r2/` | Sept 2026 | The `optic-photos` Worker described in section 1A. |
| Commit `0abaee6` + `r2-presign` + `r2-media-reader` | 2026-09-27 | Switched TV photos, beta photos and raider videos to R2 for new uploads and reads. Copying old files was left to **Sippy**, not a script. |
| Sippy | 2026-09-23 | Turned on for the 5 buckets above. It copied the raider videos when they were played. It has copied **nothing** for the TV and beta buckets, because their rows still hold Supabase URLs, so nobody ever asks R2 for those files. |
| `scripts/migrate-raider-videos.mjs`, `cleanup-raider-videos.mjs`, `lib/storageMigration.mjs` | 2026-11-05 (Part 1) | Backup + log + verified cleanup. The shared lib is written so the same pattern works for every other bucket. |
| `scripts/upload-aars.mjs` | earlier | Not storage. Inserts AAR text rows only. |

---

## 6. Ball risk (Military Ball, Nov 21)

Everything ball-related that touches file storage:

| Item | Where | Status |
|---|---|---|
| Field trip permission form PDF | `ball-assets/field-trip-form-<stamp>.pdf`, URL in `ball_config.field_trip_form_pdf_url` | **Live.** Resend attaches it in `ball-submit-signup`, `ball-resend-guest-invite` and `send-ball-reminders`. Uploaded from DISPATCH, Ball panel. |
| Older field trip form PDFs | 4 more files in `ball-assets` | Not used by any row. Leave alone. |
| Ball landing gallery | `ball_gallery` table + `ball-assets` uploads | 0 rows today. `BallLanding.jsx` and `BallTv.jsx` read it. |
| Receipts | `ball-receipts` edge function | Made in memory, returned as base64. **No storage.** |
| Guest verification slips, other PDFs | `_shared/pdf/*` | Made in memory. **No storage.** |
| Labels / stickers | made outside the site | **No storage.** |

**Recommendation: leave `ball-assets` and `BallPanel.jsx` exactly as they are
until after Nov 21.**

- They use 3 MB, so moving them saves almost nothing.
- The PDF URL is attached to emails that are still being sent. If the URL
  breaks, every signup and reminder email after that fails to attach the
  form, and some of those may have already gone out with the old link.
- Nothing else in this plan depends on ball storage moving first.

After the ball:

1. Create R2 bucket `ball-assets` and bind it to `r2-media-reader`.
2. Add `ball-assets` to the `r2-presign` allowlist.
3. Switch `BallPanel.jsx` to `r2Upload` / `r2GetPublicUrl` / `r2Remove`, and
   run gallery photos through `resizeForUpload` with a RAW check.
4. Copy the 5 PDFs and update `ball_config.field_trip_form_pdf_url`.
5. Run the cleanup script for `ball-assets`.

---

## 7. Proposed order of work

Biggest savings and lowest risk first. Each step is its own commit (or a
few), and each bucket follows the same pattern as Part 1:
**code first, then copy + log, then check in the app, then verified
cleanup.**

Before step 1, it would help to turn `migrate-raider-videos.mjs` /
`cleanup-raider-videos.mjs` into one `migrate-bucket.mjs` /
`cleanup-bucket.mjs` that takes `--bucket` and `--r2-bucket`, and can also
rewrite URL columns. Then every step below reuses the same two scripts.

### Step 1: team-photos → optic-photos (saves about 520 MB)

1. Code: switch `PhotoUploader.jsx` and `AdminBulkUpload.jsx` to
   `putPhotoFile`, and add an `isRawFile` check to `PhotoUploader`. Switch
   `PhotoSubmissions.jsx` and `RaiderPolls.jsx` deletes to
   `removePhotoFiles`, and the blur to the `opticComp.js` blur function. Fix
   the hard-coded URL in `Raiders.jsx:24`.
2. Check Vercel Production and Preview both have `VITE_OPTIC_R2_URL` set
   (2,104 rows on R2 says Production does).
3. Run `scripts/migrate-photos-to-r2.mjs` again for the 196 remaining rows.
4. Check `/optic`, `/lukepwa`, the Raiders page and the Raider polls.
5. Cleanup: delete each Supabase file only if it is in `optic-photos` at the
   same size, or is one of the 17 files no row uses (back those up first).
6. Leave the fallback in `photoStorage.js` until the end, so old URLs keep
   working.

### Step 2: staff-photos → personnel-photos and achievement-icons (saves about 100 MB)

1. Bind `personnel-photos` and `achievement-icons` to `r2-media-reader`, and
   add them to the `r2-presign` allowlist.
2. Code: `AccountsPanel.jsx` and `AchievementCatalog.jsx` use `r2Upload`,
   with `resizeForUpload` (icons: a smaller max size) and the RAW check.
3. Copy staff-photos **and** the old project's cadet-photos into
   `personnel-photos`, compressing to JPEG. Then rewrite
   `personnel.photo_url`, `admin_roles.photo_url`, `login_accounts.photo_url`
   and `achievements.icon_url`.
4. Check `/staff`, the DISPATCH login picker, and achievements.
5. Cleanup `staff-photos` and `achievement-icons`. Leave the old project
   alone until a person decides whether to retire it.

### Step 3: small public buckets (saves about 12 MB)

- `tv-team-photos`, `tv-daily-photos`, `beta-event-photos`: code is already
  on R2. Copy the files, rewrite `tv_photos.photo_url` and
  `beta_event_spotlight.photos` to the `r2-media-reader` URL, check `/tv`,
  clean up, then turn Sippy off for these and `event-photos`.
- `permission-slips`: new R2 bucket, update `EventsPanel.jsx`, copy 2 PDFs,
  rewrite `events.permission_slip_url`.
- `email-attachments`, `rafting-photos`: empty, code changes only.
- `MediaPanel.jsx` and `HealthPanel.jsx`: rework to match whatever buckets
  are actually left (they reference two buckets that never existed).

### Step 4: private buckets (saves about 4 MB)

`documents`, `chat-attachments`, `aar-documents`. These need a new "signed
download" mode in `r2-presign` that checks the same rules the RLS policies
check today. This is the riskiest step for the least space. If the goal
allows it, a reasonable alternative is to keep these three on Supabase. They
are tiny and already correctly protected.

### Step 5: ball-assets, after Nov 21

See section 6.

### Step 6: tidy up

- Delete the empty Supabase buckets (`raider-videos`, `raider-photos`,
  `event-photos`, `rafting-photos`, `admin-avatars`, `email-attachments`,
  `aar-documents` if moved).
- Remove the Supabase fallback from `photoStorage.js` and the storage
  policies in the old SQL files.
- Optional: point `media.sdhsjrotc.com` at the Workers once the
  `sdhsjrotc.com` zone is active in Cloudflare, then set
  `VITE_R2_MEDIA_BASE`.

---

## Security notes found during the audit

These are not part of the migration, but they came up:

- **optic-photos Worker DELETE accepts any signed-in Supabase user**, not
  only DISPATCH admins. If anyone other than staff can get a Supabase login
  (reviewers, board members, ball door staff), they could delete OPTIC
  photos. Fix: have the Worker check `admin_roles` too, or move deletes to
  `r2-presign`.
- **PhotoSubmissions and RaiderPolls deletes only remove the Supabase
  copy.** For the 2,104 photos already on R2, deleting in DISPATCH removes
  the row but leaves the file in R2. That doesn't break anything, but the
  file stays public at its old URL, which matters if a photo was removed for
  privacy reasons. Step 1 fixes this.
- **`permission-slips` and `email-attachments` are public buckets.** Anyone
  with the link can open those files. That is fine for blank forms, but
  never upload a filled-in form with student information there.
