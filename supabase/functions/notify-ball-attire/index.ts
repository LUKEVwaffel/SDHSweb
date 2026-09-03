// Edge function: notify-ball-attire
// Fires fire-and-forget after a ball signup is created (ball-submit-signup
// invokes it). Alerts the attire approver ACCOUNTS (ball_dress_staff, by the
// email set on each account in the Attire Staff Accounts panel):
//   • any female attendee — cadet OR guest → role = 'female_dress'  (/ball/dress)
//   • a male GUEST                         → role = 'male_guest_attire' (/ball/attire, Weston)
// A male cadet with no guest triggers nothing — Class A uniform, no approval.
//
// Same shape as notify-ball-allergy. Public-triggered (chained off a pre-auth
// submit). Deploy WITHOUT jwt:
//   supabase functions deploy notify-ball-attire --no-verify-jwt
import { json, preflight, escapeHtml, siteOrigin } from "../_shared/http.ts";
import { BALL_NOTIFY_BCC } from "../_shared/ballNotify.ts";
import { serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const { signup_id } = await req.json().catch(() => ({}));
    if (!signup_id) return json({ error: "signup_id required" }, 400);

    const svc = serviceClient();

    const { data: signup, error } = await svc
      .from("ball_signups")
      .select("cadet_name, cadet_gender, cadet_let_level, cadet_company")
      .eq("id", signup_id)
      .maybeSingle();
    if (error) { console.error("notify-ball-attire lookup", error); return json({ error: "internal error" }, 500); }
    if (!signup) return json({ error: "not_found" }, 404);

    const { data: guest } = await svc
      .from("ball_guests")
      .select("name, gender")
      .eq("signup_id", signup_id)
      .maybeSingle();

    const femalePresent = signup.cadet_gender === "female" || guest?.gender === "female";
    const maleGuest = !!guest && guest.gender === "male";
    if (!femalePresent && !maleGuest) return json({ ok: true, notified: 0 });

    const roles: string[] = [];
    if (femalePresent) roles.push("female_dress");
    if (maleGuest) roles.push("male_guest_attire");

    const { data: staff, error: sErr } = await svc
      .from("ball_dress_staff")
      .select("email, role")
      .in("role", roles);
    if (sErr) { console.error("notify-ball-attire staff", sErr); return json({ error: "internal error" }, 500); }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM = Deno.env.get("FROM_EMAIL") ?? "Trojan Battalion <onboarding@resend.dev>";
    if (!RESEND_API_KEY) return json({ error: "RESEND_API_KEY not configured" }, 500);
    const origin = siteOrigin();

    const meta = [
      signup.cadet_let_level ? `LET ${signup.cadet_let_level}` : "",
      signup.cadet_company ? `${signup.cadet_company} Company` : "",
    ].filter(Boolean).join(" · ");

    let notified = 0;
    for (const role of roles) {
      const to = (staff ?? []).filter((s) => s.role === role).map((s) => s.email).filter(Boolean);
      if (!to.length) continue;

      const isFemaleRole = role === "female_dress";
      const label = isFemaleRole ? "female attire" : "male-guest attire";
      const portalPath = isFemaleRole ? "/ball/dress" : "/ball/attire";
      const portal = origin ? `${origin}${portalPath}` : null;
      const who = isFemaleRole && signup.cadet_gender === "female"
        ? `Cadet ${signup.cadet_name}`
        : `${signup.cadet_name}'s guest ${guest?.name ?? ""}`.trim();

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM,
          bcc: BALL_NOTIFY_BCC,
          to,
          subject: `New Ball signup — ${label} approval needed`,
          html: `<p><strong>${escapeHtml(who)}</strong>${meta ? ` (${escapeHtml(meta)})` : ""} just signed up for the Military Ball and needs ${escapeHtml(label)} approval.</p>${portal ? `<p><a href="${escapeHtml(portal)}">Open the approval portal</a></p>` : ""}`,
          text: `${who}${meta ? ` (${meta})` : ""} just signed up for the Military Ball and needs ${label} approval.${portal ? `\n\n${portal}` : ""}`,
        }),
      });
      if (res.ok) notified += to.length;
    }

    return json({ ok: true, notified });
  } catch (e) {
    console.error("notify-ball-attire", e);
    return json({ error: "internal error" }, 500);
  }
});
