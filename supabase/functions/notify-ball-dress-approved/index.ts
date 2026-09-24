// Edge function: notify-ball-dress-approved
// AUTHENTICATED, ball_dress_staff-gated. The dress (/ball/dress) and attire
// (/ball/attire) portals flip dress_approved directly under RLS + the column
// guards — this function only sends the "your attire is approved" email
// afterward, since RESEND_API_KEY must stay server-side. Fired
// fire-and-forget by BallDressPortal.jsx / BallAttirePortal.jsx right after a
// single toggle or bulk approve succeeds.
//
// Body: { kind: 'cadet' | 'guest' | 'vip' | 'vipdate', ids: uuid[] }
// Only rows that are CURRENTLY dress_approved get mailed, so a stale or
// replayed call can't send an approval for something that was revoked.
// Deploy WITH jwt verification (default):
//   supabase functions deploy notify-ball-dress-approved
import { json, preflight, escapeHtml, siteOrigin } from "../_shared/http.ts";
import { BALL_NOTIFY_BCC } from "../_shared/ballNotify.ts";
import { serviceClient, getCaller } from "../_shared/supabase.ts";
import { ballEmailShell } from "../_shared/ballEmail.ts";
import { loadBallTemplate, isDisabled, pick, paras } from "../_shared/ballTemplate.ts";

// Where each kind lives and which column holds the address to notify.
const KINDS: Record<string, { table: string; name: string; email: string }> = {
  cadet: { table: "ball_signups", name: "cadet_name", email: "notification_email" },
  guest: { table: "ball_guests", name: "name", email: "personal_email" },
  vip: { table: "ball_vip_signups", name: "name", email: "personal_email" },
  vipdate: { table: "ball_vip_dates", name: "name", email: "personal_email" },
};

// Mirrors the column guards: male-guest attire (Weston) only ever approves guests.
const ROLE_KINDS: Record<string, string[]> = {
  female_dress: ["cadet", "guest", "vip", "vipdate"],
  male_guest_attire: ["guest"],
};

const MAX_IDS = 200;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const caller = await getCaller(req);
    if (!caller) return json({ error: "not authorized" }, 403);

    const svc = serviceClient();
    const { data: staff, error: staffErr } = await svc
      .from("ball_dress_staff")
      .select("role")
      .eq("email", caller.email)
      .eq("active", true)
      .maybeSingle();
    if (staffErr) { console.error("notify-ball-dress-approved staff", staffErr); return json({ error: "internal error" }, 500); }
    if (!staff) return json({ error: "not authorized" }, 403);

    const { kind, ids } = await req.json().catch(() => ({}));
    const spec = KINDS[kind];
    if (!spec || !Array.isArray(ids) || !ids.length || ids.length > MAX_IDS) {
      return json({ error: "kind and ids[] are required" }, 400);
    }
    if (!(ROLE_KINDS[staff.role] ?? []).includes(kind)) return json({ error: "not authorized for this kind" }, 403);

    const { data: rows, error } = await svc
      .from(spec.table)
      .select(`id, ${spec.name}, ${spec.email}`)
      .in("id", ids)
      .eq("dress_approved", true);
    if (error) { console.error("notify-ball-dress-approved lookup", error); return json({ error: "internal error" }, 500); }

    const t = await loadBallTemplate(svc, "dress_approved");
    if (isDisabled(t)) return json({ ok: true, notified: 0, skipped: true });

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM = Deno.env.get("FROM_EMAIL") ?? "Trojan Battalion <onboarding@resend.dev>";
    if (!RESEND_API_KEY) return json({ error: "RESEND_API_KEY not configured" }, 500);
    const origin = siteOrigin();

    let notified = 0;
    for (const row of (rows ?? []) as Record<string, string>[]) {
      const to = (row[spec.email] || "").trim();
      if (!to) continue;
      const name = row[spec.name] || "";
      const vars = { name: escapeHtml(name) };
      const closingHtml = pick(t, "closing_html", "", vars);
      const html = ballEmailShell({
        preheader: "Your Military Ball attire has been approved.",
        heading: pick(t, "heading", "Attire Approved", vars),
        introHtml: paras(pick(t, "intro_html", "{{name}},\n\nYour attire for the Trojan Battalion Military Ball has been reviewed and approved. No further action is needed on attire.", vars)),
        noticeHtml: pick(t, "notice_html", "", vars) || undefined,
        closingHtml: closingHtml ? paras(closingHtml) : undefined,
        siteUrl: origin ? `${origin}/ball` : undefined,
      });

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM,
          bcc: BALL_NOTIFY_BCC,
          to: [to],
          subject: pick(t, "subject", "Military Ball: attire approved", { name }),
          html,
          text: `${name}, your attire for the Trojan Battalion Military Ball has been approved. No further action is needed on attire.`,
        }),
      }).catch((e) => { console.error("notify-ball-dress-approved send", e); return null; });
      if (res?.ok) notified += 1;
      else if (res) console.error("notify-ball-dress-approved resend", res.status, await res.text().catch(() => ""));
    }

    return json({ ok: true, notified });
  } catch (e) {
    console.error("notify-ball-dress-approved", e);
    return json({ error: "internal error" }, 500);
  }
});
