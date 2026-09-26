// OPTIC photo storage Worker — fronts the `optic-photos` R2 bucket.
//
//   GET/HEAD /<key>   public read, edge-cached, immutable (keys never reuse)
//   PUT      /<key>   upload one JPEG (anon, same as the old Supabase bucket
//                     policy — parents upload without an account)
//   DELETE   /<key>   remove one object; needs a DISPATCH login (Supabase
//                     access token in Authorization), verified against
//                     Supabase's /auth/v1/user
//
// Keys mirror the old Supabase layout exactly (raiders/<event uuid>/<stamp>.jpg
// and the _t.jpg thumbnail), so photos.storage_path means the same thing no
// matter which backend a row lives on.

const KEY_RE = /^[a-z]+\/[0-9a-f-]{36}\/[0-9]+_[a-z0-9]+(_t)?\.jpg$/;
// Reads are looser than uploads: photos copied over from the old Supabase
// bucket (scripts/migrate-photos-to-r2.mjs) keep their original paths, which
// older uploaders built differently (other teams, blurred copies, PNGs).
const READ_KEY_RE = /^[A-Za-z0-9][A-Za-z0-9._\-/ ()]*\.(jpe?g|png|webp|gif)$/i;
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

async function serve(req, env, ctx, key) {
  // Reads are open to every origin — the feed, the download/share path
  // (fetch() needs CORS) and the <img> tags all hit this.
  const cors = { 'Access-Control-Allow-Origin': '*' };
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

async function upload(req, env, key, cors) {
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
