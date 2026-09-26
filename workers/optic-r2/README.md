# OPTIC photos on Cloudflare R2

Moves OPTIC photo files off Supabase Storage so parents scrolling the feed stop
burning the Supabase egress quota. R2 charges nothing for egress. The Postgres
database (rows, likes, realtime, auth) stays on Supabase — only the image files
move.

## One-time setup (about 10 minutes)

1. **Create the bucket.** Cloudflare dashboard → R2 → *Create bucket* → name it
   `optic-photos`. (First time using R2 asks you to enable it; the free tier is
   10 GB stored and free egress.)
2. **Fill in `wrangler.toml`.** Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` to
   the same values as `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in the
   site's `.env`. (Only used to check a DISPATCH login before a delete.)
3. **Deploy the Worker.**
   ```sh
   cd workers/optic-r2
   npx wrangler login
   npx wrangler deploy
   ```
   It prints the URL, e.g. `https://optic-photos.<you>.workers.dev`.
4. **Point the site at it.** Vercel → Project → Settings → Environment
   Variables → add `VITE_OPTIC_R2_URL` = that URL (no trailing slash) for
   Production (and Preview if you test there). **Redeploy** — Vite bakes env
   vars in at build time, so it does nothing until the next build.
5. **Smoke test.** Open `/optic`, upload one photo, and check the new row's
   `photo_url` in Supabase starts with the Worker URL. Then delete it from
   `/lukepwa` and confirm it's gone.

Optional, better caching: add a custom domain (Workers → `optic-photos` →
*Settings → Domains & Routes*, e.g. `photos.sdhsjrotc.com`). The Worker's edge
cache only works on a custom domain, not on `*.workers.dev`; without it every
image read goes to R2 (still free up to 10M reads/month). If you add one,
update `VITE_OPTIC_R2_URL` to it and redeploy.

## Rolling back

Remove `VITE_OPTIC_R2_URL` in Vercel and redeploy. Uploads go back to Supabase
Storage. Photos already uploaded to R2 keep working (their URLs point at the
Worker), so leave the Worker running.

## What the Worker allows

- `GET` any photo: public, cached for a year (keys are never reused).
- `PUT` a new photo: anonymous (same as the old Supabase bucket policy), JPEG
  only, 10 MB cap, key must look like `raiders/<event uuid>/<stamp>.jpg`, and
  it refuses to overwrite an existing file.
- `DELETE`: requires a signed-in Supabase session (DISPATCH / Luke's PWA).

## Moving existing photos over (`scripts/migrate-photos-to-r2.mjs`)

Copies every `photos` row still on Supabase Storage into R2 at the same path,
then points `photo_url` / `thumb_url` at the Worker. Re-runnable; the
Supabase copies are left in place until you delete them yourself.

**Redeploy the Worker first.** The current `src/index.js` lets reads use the
older path formats that migrated photos keep. Without that update, migrated
photos come back as "Bad key".

1. R2 → **Manage API tokens** → *Create API token* → **Object Read & Write**,
   limited to the `optic-photos` bucket. Keep the Access Key ID and Secret.
   The Account ID is the hex string at the start of the bucket's S3 API URL.
2. Put these in `.env.local` (git-ignored, never commit it):
   ```
   SUPABASE_SERVICE_ROLE_KEY=...   # Supabase → Project Settings → API Keys → service_role
   R2_ACCOUNT_ID=...
   R2_ACCESS_KEY_ID=...
   R2_SECRET_ACCESS_KEY=...
   VITE_OPTIC_R2_URL=https://optic-photos.sdhs-battalion.workers.dev
   ```
   `.env` needs `VITE_SUPABASE_URL`.
3. Dry run, then the real thing:
   ```sh
   npm install
   node --env-file=.env --env-file=.env.local scripts/migrate-photos-to-r2.mjs --dry-run
   node --env-file=.env --env-file=.env.local scripts/migrate-photos-to-r2.mjs
   ```
   `--event <uuid>` limits it to one comp. `--limit 5` is a good first real run.

Every file is downloaded from Supabase once, so this uses Supabase egress one
last time. If the project is restricted, it stops at the first refused
download without changing anything.
