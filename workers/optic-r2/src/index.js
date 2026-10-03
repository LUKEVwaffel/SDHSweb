// OPTIC photo storage Worker — fronts the `optic-photos` R2 bucket.
//
//   GET/HEAD /<key>   public read, edge-cached, immutable (keys never reuse)
//   PUT      /<key>   upload one JPEG, or one parent video clip (.mp4 / .mov
//                     / .webm), anon, same as the old Supabase bucket
//                     policy — parents upload without an account
//   DELETE   /<key>   remove one object; needs a DISPATCH login (Supabase
//                     access token in Authorization), verified against
//                     Supabase's /auth/v1/user
//
// Keys mirror the old Supabase layout exactly (raiders/<event uuid>/<stamp>.jpg
// plus the _t.jpg feed thumbnail and the _s.jpg grid thumbnail /lukepwa
// tiles use), so photos.storage_path means the same thing no
// matter which backend a row lives on. A video row's clip sits at
// <stamp>.mp4 / .mov / .webm with its poster frame at the usual _t / _s.jpg.

const KEY_RE = /^[a-z]+\/[0-9a-f-]{36}\/[0-9]+_[a-z0-9]+(?:(_t|_s)?\.jpg|\.(mp4|mov|webm))$/;
const VIDEO_KEY_RE = /\.(mp4|mov|m4v|webm)$/i;
const VIDEO_TYPES = { mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm' };
// Cloudflare refuses request bodies over 100MB on this plan anyway.
const MAX_VIDEO_BYTES = 95 * 1024 * 1024;
// Reads are looser than uploads: photos copied over from the old Supabase
// bucket (scripts/migrate-photos-to-r2.mjs) keep their original paths, which
// older uploaders built differently (other teams, blurred copies, PNGs).
const READ_KEY_RE = /^[A-Za-z0-9][A-Za-z0-9._\-/ ()]*\.(jpe?g|png|webp|gif|mp4|mov|m4v|webm)$/i;
const MAX_BYTES = 10 * 1024 * 1024; // resized uploads are ~0.3MB; this is just a ceiling
const IMMUTABLE = 'public, max-age=31536000, immutable';

function corsHeaders(req, env) {
  const origin = req.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '*').split(',').map((s) => s.trim());
  const allow = allowed.includes('*') ? '*' : (allowed.includes(origin) ? origin : allowed[0]);
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, HEAD, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const json = (body, status, cors) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, 'Content-Type': 'application/json' },
});

// Video players (iOS Safari above all) won't play a clip unless the server
// answers byte-range requests, so videos skip the edge cache and stream
// straight from R2 with Range support.
async function serveVideo(req, env, key, cors) {
  const range = req.headers.get('Range');
  const obj = range
    ? await env.PHOTOS.get(key, { range: req.headers })
    : await env.PHOTOS.get(key);
  if (!obj) return new Response('Not found', { status: 404, headers: cors });

  const headers = new Headers(cors);
  obj.writeHttpMetadata(headers);
  headers.set('Cache-Control', IMMUTABLE);
  headers.set('ETag', obj.httpEtag);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
  let status = 200;
  let length = obj.size;
  if (range && obj.range) {
    const offset = obj.range.offset ?? (obj.range.suffix != null ? obj.size - obj.range.suffix : 0);
    length = obj.range.length ?? (obj.range.suffix ?? obj.size - offset);
    headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${obj.size}`);
    status = 206;
  }
  headers.set('Content-Length', String(length));
  return new Response(req.method === 'HEAD' ? null : obj.body, { status, headers });
}

async function serve(req, env, ctx, key) {
  // Reads are open to every origin — the feed, the download/share path
  // (fetch() needs CORS) and the <img> tags all hit this.
  const cors = { 'Access-Control-Allow-Origin': '*' };
  if (VIDEO_KEY_RE.test(key)) return serveVideo(req, env, key, cors);
  const cache = caches.default;
  const cacheKey = new Request(new URL(req.url).toString(), { method: 'GET' });
  const hit = await cache.match(cacheKey);
  if (hit) return req.method === 'HEAD' ? new Response(null, hit) : hit;

  const obj = await env.PHOTOS.get(key);
  if (!obj) return new Response('Not found', { status: 404, headers: cors });

  const headers = new Headers(cors);
  obj.writeHttpMetadata(headers);
  headers.set('Content-Type', obj.httpMetadata?.contentType || 'image/jpeg');
  headers.set('Cache-Control', IMMUTABLE);
  headers.set('ETag', obj.httpEtag);
  const res = new Response(obj.body, { headers });
  ctx.waitUntil(cache.put(cacheKey, res.clone()));
  return req.method === 'HEAD' ? new Response(null, { headers }) : res;
}

// Clips are streamed straight into R2 (a 95MB body would blow the Worker's
// memory if buffered), then their first bytes are checked and the object
// dropped if it isn't really a video.
async function uploadVideo(req, env, key, cors) {
  const ext = key.split('.').pop().toLowerCase();
  const type = (req.headers.get('Content-Type') || '').split(';')[0].trim();
  if (type !== VIDEO_TYPES[ext]) return json({ error: 'Video type does not match' }, 415, cors);
  const len = Number(req.headers.get('Content-Length') || 0);
  if (!len) return json({ error: 'Content-Length required' }, 411, cors);
  if (len > MAX_VIDEO_BYTES) return json({ error: 'Video too large' }, 413, cors);
  if (!req.body) return json({ error: 'Bad size' }, 413, cors);

  const existing = await env.PHOTOS.head(key);
  if (existing) return json({ error: 'Already exists' }, 409, cors);

  await env.PHOTOS.put(key, req.body, { httpMetadata: { contentType: type, cacheControl: IMMUTABLE } });

  const head = await env.PHOTOS.get(key, { range: { offset: 0, length: 12 } });
  const b = head ? new Uint8Array(await head.arrayBuffer()) : new Uint8Array();
  const isMp4 = b.length >= 8 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70; // ....ftyp
  const isWebm = b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3;
  if (ext === 'webm' ? !isWebm : !isMp4) {
    await env.PHOTOS.delete(key);
    return json({ error: 'Not a video' }, 415, cors);
  }
  return json({ key }, 201, cors);
}

async function upload(req, env, key, cors) {
  if (VIDEO_KEY_RE.test(key)) return uploadVideo(req, env, key, cors);
  const len = Number(req.headers.get('Content-Length') || 0);
  if (len > MAX_BYTES) return json({ error: 'File too large' }, 413, cors);
  const type = (req.headers.get('Content-Type') || '').split(';')[0].trim();
  if (type !== 'image/jpeg') return json({ error: 'JPEG only' }, 415, cors);

  const buf = await req.arrayBuffer();
  if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) return json({ error: 'Bad size' }, 413, cors);
  const head = new Uint8Array(buf, 0, 3);
  if (head[0] !== 0xff || head[1] !== 0xd8 || head[2] !== 0xff) return json({ error: 'Not a JPEG' }, 415, cors);

  // Never overwrite: keys are unique per upload, and an overwrite would be
  // someone replacing another person's photo.
  const existing = await env.PHOTOS.head(key);
  if (existing) return json({ error: 'Already exists' }, 409, cors);

  await env.PHOTOS.put(key, buf, { httpMetadata: { contentType: 'image/jpeg', cacheControl: IMMUTABLE } });
  return json({ key }, 201, cors);
}

async function isSignedIn(req, env) {
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ') || !env.SUPABASE_URL) return false;
  const res = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, {
    headers: { Authorization: auth, apikey: env.SUPABASE_ANON_KEY || '' },
  });
  return res.ok;
}

async function remove(req, env, ctx, key, cors) {
  if (!(await isSignedIn(req, env))) return json({ error: 'Sign in required' }, 401, cors);
  await env.PHOTOS.delete(key);
  ctx.waitUntil(caches.default.delete(new Request(new URL(req.url).toString(), { method: 'GET' })));
  return json({ key, deleted: true }, 200, cors);
}

export default {
  async fetch(req, env, ctx) {
    const cors = corsHeaders(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const key = decodeURIComponent(new URL(req.url).pathname.replace(/^\/+/, ''));
    if (!key) return new Response('OPTIC photos', { headers: cors });
    const isRead = req.method === 'GET' || req.method === 'HEAD';
    const validKey = isRead ? READ_KEY_RE.test(key) && !key.includes('..') : KEY_RE.test(key);
    if (!validKey) return json({ error: 'Bad key' }, 400, cors);

    try {
      if (isRead) return await serve(req, env, ctx, key);
      if (req.method === 'PUT') return await upload(req, env, key, cors);
      if (req.method === 'DELETE') return await remove(req, env, ctx, key, cors);
      return json({ error: 'Method not allowed' }, 405, cors);
    } catch (err) {
      return json({ error: String(err?.message || err) }, 500, cors);
    }
  },
};
