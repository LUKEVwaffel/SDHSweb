// Vercel Routing Middleware — keeps banned visitors off the breadstick counter.
// Runs at the edge before the SPA is served, so a banned IP (or a browser that
// already carries the ban cookie) gets a 403 instead of the page. The ban
// lists live in Supabase (supabase/roll_counter_ban.sql); any lookup failure
// fails open so a Supabase hiccup never takes the page down for everyone.

export const config = {
  matcher: ['/breadsticks', '/breadsticks/:path*', '/rolls', '/rolls/:path*'],
};

const BAN_COOKIE = 'bs_ban';
const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

function bannedResponse() {
  return new Response(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
      + '<title>Banned</title><body style="font-family:system-ui;background:#1a1410;color:#f5ede4;'
      + 'display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:16px">'
      + '<div><h1>You\'re banned</h1><p>You are permanently banned from the breadstick counter.</p></div>',
    {
      status: 403,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'set-cookie': `${BAN_COOKIE}=1; Path=/; Max-Age=${TEN_YEARS}; Secure; SameSite=Lax`,
      },
    },
  );
}

function clientIp(request) {
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();
  const fwd = request.headers.get('x-forwarded-for');
  return fwd ? fwd.split(',')[0].trim() : null;
}

export default async function middleware(request) {
  const cookies = request.headers.get('cookie') || '';
  if (new RegExp(`(?:^|;\\s*)${BAN_COOKIE}=1(?:;|$)`).test(cookies)) return bannedResponse();

  const ip = clientIp(request);
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!ip || !url || !key) return;

  try {
    const res = await fetch(`${url}/rest/v1/rpc/roll_counter_ip_is_banned`, {
      method: 'POST',
      headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ p_ip: ip }),
      signal: AbortSignal.timeout(1500),
    });
    if (res.ok && (await res.json()) === true) return bannedResponse();
  } catch {
    // fail open
  }
}
