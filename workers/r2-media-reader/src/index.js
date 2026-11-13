// Public read-only front door for the R2 media buckets.
//   GET/HEAD https://r2-media-reader.sdhs-battalion.workers.dev/<bucket>/<key>
// Used by src/lib/r2Storage.js (r2PublicUrl). Writes never come through here;
// they use presigned URLs from the r2-presign edge function.
//
// Range support matters: Safari/iOS will not play a video unless the server
// answers byte-range requests with 206, and seeking in the Raider TV player
// relies on it too. Deploy: see ../README.md.

// URL bucket name -> binding name in wrangler.toml. Add both together.
const BUCKET_BINDINGS = {
  'beta-event-photos': 'BETA_EVENT_PHOTOS',
  'event-photos': 'EVENT_PHOTOS',
  'tv-daily-photos': 'TV_DAILY_PHOTOS',
  'tv-team-photos': 'TV_TEAM_PHOTOS',
  'raider-videos': 'RAIDER_VIDEOS',
};

// Keys are timestamped and never overwritten, so a year of caching is safe.
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

export default {
  async fetch(request, env) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405, headers: { allow: 'GET, HEAD' } });
    }

    const target = resolve(request, env);
    if (!target) return new Response('Not Found', { status: 404 });
    const { bucket, key } = target;

    if (request.method === 'HEAD') {
      const meta = await bucket.head(key);
      if (!meta) return new Response(null, { status: 404 });
      const headers = baseHeaders(meta);
      headers.set('content-length', String(meta.size));
      return new Response(null, { status: 200, headers });
    }

    const rangeHeader = request.headers.get('range');
    const range = rangeHeader ? parseRange(rangeHeader) : null;

    let object;
    try {
      object = await bucket.get(key, range ? { range } : undefined);
    } catch {
      // R2 throws when the range starts past the end of the file.
      const meta = await bucket.head(key);
      if (!meta) return new Response('Not Found', { status: 404 });
      const headers = baseHeaders(meta);
      headers.set('content-range', `bytes */${meta.size}`);
      return new Response(null, { status: 416, headers });
    }
    if (!object) return new Response('Not Found', { status: 404 });

    const headers = baseHeaders(object);
    if (range) {
      const { start, length } = resolvedRange(range, object.size);
      headers.set('content-range', `bytes ${start}-${start + length - 1}/${object.size}`);
      headers.set('content-length', String(length));
      return new Response(object.body, { status: 206, headers });
    }
    headers.set('content-length', String(object.size));
    return new Response(object.body, { status: 200, headers });
  },
};

// "/<bucket>/<key>" -> { bucket binding, key }, or null if unknown.
function resolve(request, env) {
  const path = decodeURIComponent(new URL(request.url).pathname.replace(/^\/+/, ''));
  const slash = path.indexOf('/');
  if (slash === -1) return null;
  const bindingName = BUCKET_BINDINGS[path.slice(0, slash)];
  const key = path.slice(slash + 1);
  if (!bindingName || !env[bindingName] || !key) return null;
  return { bucket: env[bindingName], key };
}

function baseHeaders(object) {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', CACHE_CONTROL);
  headers.set('access-control-allow-origin', '*');
  headers.set('access-control-expose-headers', 'content-length, content-range, accept-ranges, etag');
  headers.set('accept-ranges', 'bytes');
  return headers;
}

// Single byte ranges only ("bytes=0-99", "bytes=100-", "bytes=-500"). Anything
// else (multi-range, junk) is ignored and the whole file is sent with a 200,
// which the HTTP spec allows.
export function parseRange(header) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, startStr, endStr] = match;
  if (startStr === '' && endStr === '') return null;
  if (startStr === '') {
    const suffix = parseInt(endStr, 10);
    return suffix > 0 ? { suffix } : null;
  }
  const offset = parseInt(startStr, 10);
  if (endStr === '') return { offset };
  const end = parseInt(endStr, 10);
  if (end < offset) return null;
  return { offset, length: end - offset + 1 };
}

// The parsed range may be a suffix range or run past the end of the file.
// Turn it into a concrete start + length. (Computed from the request, not
// object.range: live R2 does not fill object.range the same way every time.)
export function resolvedRange(r, size) {
  if ('suffix' in r) {
    const length = Math.min(r.suffix, size);
    return { start: size - length, length };
  }
  const start = r.offset ?? 0;
  const length = Math.min(r.length ?? size - start, size - start);
  return { start, length };
}
