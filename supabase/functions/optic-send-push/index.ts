// Edge function: optic-send-push
// Admin-triggered from /lukepwa (SubEvents tab, "SEND ALERT" — see
// LukePwa.jsx). Sends one web-push notification to every device subscribed
// for the given event. Dead subscriptions (410/404 from the push service —
// the browser uninstalled or the user cleared data) are deleted so the table
// stays clean without a separate sweep job.
//
// Self-contained (no ../_shared imports) so this can be pasted directly into
// the Supabase Dashboard's function editor if the local CLI's bundler is
// unavailable — see supabase/functions/README_DEPLOY.md.
//
// Deploy WITH jwt (default) — this is an authenticated admin action, unlike
// the pre-auth ball-* notify functions:
//   supabase functions deploy optic-send-push
//   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com
import webpush from "npm:web-push@3";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const preflight = () => new Response("ok", { headers: cors });

function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

// Same shape as _shared/supabase.ts's getCaller: identifies the signed-in
// caller from the Authorization bearer token and checks admin_roles. Fails
// closed (null) on any missing token, invalid session, or lookup error.
async function getCaller(req: Request): Promise<{ email: string; role: string | null } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const scoped = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );
  const { data: { user } } = await scoped.auth.getUser();
  const email = user?.email?.toLowerCase();
  if (!email) return null;

  const svc = serviceClient();
  const { data, error } = await svc.from("admin_roles").select("role").eq("email", email).maybeSingle();
  if (error) { console.error("optic-send-push admin_roles lookup", error); return null; }
  return { email, role: data?.role ?? null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const caller = await getCaller(req);
  if (!caller || !caller.role) return json({ error: "not authorised" }, 403);

  const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
  const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
  const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT");
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    return json({ error: "VAPID secrets not configured" }, 500);
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  try {
    const { event_id, title, body, url } = await req.json().catch(() => ({}));
    if (!event_id) return json({ error: "event_id required" }, 400);

    const svc = serviceClient();
    const { data: subs, error } = await svc
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("event_id", event_id);
    if (error) { console.error("optic-send-push lookup", error); return json({ error: "internal error" }, 500); }
    if (!subs?.length) return json({ ok: true, sent: 0, failed: 0 });

    const payload = JSON.stringify({
      title: title || "OPTIC",
      body: body || "New photos are up.",
      url: url || "/optic",
    });

    let sent = 0;
    const dead: string[] = [];
    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) dead.push(s.id);
        else console.error("optic-send-push send failed", s.id, err);
      }
    }));

    if (dead.length) await svc.from("push_subscriptions").delete().in("id", dead);

    return json({ ok: true, sent, failed: subs.length - sent, pruned: dead.length });
  } catch (e) {
    console.error("optic-send-push", e);
    return json({ error: "internal error" }, 500);
  }
});
