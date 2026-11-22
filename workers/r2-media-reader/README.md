# r2-media-reader

Public, read-only Worker in front of the R2 media buckets. Every raider video,
beta event photo and TV photo on the site loads through it:

    https://r2-media-reader.sdhs-battalion.workers.dev/<bucket>/<key>

Uploads and deletes do NOT go through here. DISPATCH asks the `r2-presign`
edge function for a short-lived upload URL instead (see `src/lib/r2Storage.js`).

## What it does

- `GET` and `HEAD` only. Anything else gets 405.
- Byte ranges (`Range: bytes=0-99`, `bytes=100-`, `bytes=-500`) return 206.
  iPhones and Safari will not play video without this.
- Every response sends `Cache-Control: public, max-age=31536000, immutable`.
  File names start with a timestamp and are never reused, so this is safe.
- Unknown bucket or missing file: 404.

## Deploy

From the repo root, with wrangler logged into the Cloudflare account that
owns the buckets (`npx wrangler whoami` should show 5567iamhim@gmail.com):

    cd workers/r2-media-reader
    npx wrangler deploy

## Adding a bucket

1. Add an `[[r2_buckets]]` block in `wrangler.toml`.
2. Add the same name to `BUCKET_BINDINGS` in `src/index.js`.
3. Deploy.

Only add buckets that are meant to be public. Private files (documents,
permission slips, chat attachments) must never be served from here.

## Check it

    curl -sI https://r2-media-reader.sdhs-battalion.workers.dev/raider-videos/<key>
    curl -s -o /dev/null -D - -H "Range: bytes=0-1" https://r2-media-reader.sdhs-battalion.workers.dev/raider-videos/<key>

The first should show `content-length` and `cache-control`. The second should
show `HTTP/2 206` and `content-range: bytes 0-1/<size>`.
