// Edge function: ball-email-preview
// S-6 only. Renders any ball email (ball_email_templates key) with SAMPLE data
// so S-6 can see the current wording in the DISPATCH "Emails" tab, and
// optionally sends that sample to the caller's own address.
//
// This is a preview-only re-implementation of the shell arguments each real
// sender builds — the dynamic parts (checklist, particulars) use fixed sample
// content here. Deploy WITH jwt (default):
//   supabase functions deploy ball-email-preview
import { json, preflight, escapeHtml, siteOrigin } from "../_shared/http.ts";
import { serviceClient, getCaller } from "../_shared/supabase.ts";
import { ballEmailShell } from "../_shared/ballEmail.ts";
import { loadBallTemplate, pick, paras } from "../_shared/ballTemplate.ts";
import type { BallTemplate } from "../_shared/ballTemplate.ts";

const KEYS = ["registration_received", "guest_invitation", "guest_verified", "signup_update", "allergy_flag"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const caller = await getCaller(req);
    if (!caller || caller.role !== "s6" || caller.mustChangePassword) {
      return json({ error: "not authorized" }, 403);
    }

    const { key, send_test } = await req.json().catch(() => ({}));
    if (!KEYS.includes(key)) return json({ error: "unknown email key" }, 400);

    const svc = serviceClient();
    const t = await loadBallTemplate(svc, key);
    const origin = siteOrigin() || "https://example.org";

    const built = build(key, t, origin);

    if (send_test) {
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      const FROM = Deno.env.get("FROM_EMAIL") ?? "Trojan Battalion <onboarding@resend.dev>";
      if (!RESEND_API_KEY) return json({ error: "RESEND_API_KEY not configured" }, 500);
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM,
          to: [caller.email],
          subject: `[TEST] ${built.subject}`,
          html: built.html,
          text: "This is a sample render of a Military Ball email, sent from the DISPATCH Emails tab.",
        }),
      });
      if (!res.ok) return json({ error: `Resend returned ${res.status}` }, 502);
      return json({ ok: true, sent_to: caller.email });
    }

    return json({ subject: built.subject, html: built.html });
  } catch (e) {
    console.error("ball-email-preview", e);
    return json({ error: "internal error" }, 500);
  }
});

const SAMPLE_PARTICULARS = [
  { label: "Date", value: "Friday, October 17, 2026" },
  { label: "Time", value: "5:00 – 9:00 PM" },
  { label: "Venue", value: "The Mountain View Ballroom, Chattanooga, TN" },
];

function build(key: string, t: BallTemplate | null, origin: string): { subject: string; html: string } {
  const site = `${origin}/ball`;

  if (key === "registration_received") {
    const vars: Record<string, string> = {
      name: "Cadet A. Rivera", meta: " (LET 3 · Bravo Company)",
      deadline: "October 1, 2026", amount_due: "$50", ball_date: "Friday, October 17, 2026",
    };
    return {
      subject: pick(t, "subject", "Trojan Battalion Military Ball: Registration Received", { name: vars.name, meta: vars.meta, deadline: vars.deadline }),
      html: ballEmailShell({
        preheader: "Your Military Ball registration has been received.",
        heading: pick(t, "heading", "Registration Received", vars),
        introHtml: paras(pick(t, "intro_html", "{{name}},\n\nYour registration for the Trojan Battalion Military Ball has been received and recorded{{meta}}.", vars)),
        particulars: SAMPLE_PARTICULARS,
        listTitle: "What Remains",
        listItems: [
          "Print and sign the <strong>field trip permission form</strong> attached to this email and return it to 1SG Kaz or Chief.",
          "Render payment of <strong>$50</strong> in full, by cash or check, to 1SG Kaz or Chief.",
          "Obtain <strong>dress approval</strong>: text a photograph of your attire to one of the approvers listed on the registration page.",
        ],
        noticeHtml: pick(t, "notice_html", "All items above must be completed on or before <strong>{{deadline}}</strong>.", vars) || undefined,
        closingHtml: paras(pick(t, "closing_html", "You will receive further notice as your payment and any required forms are recorded.", vars)),
        siteUrl: site,
      }),
    };
  }

  if (key === "guest_invitation") {
    const link = `${origin}/ball/guest/SAMPLE-TOKEN`;
    const gVars: Record<string, string> = {
      guest_name: "Jordan Blake",
      cadet_name: `<strong style="color:#F4ECD8;">Cadet A. Rivera</strong>`,
      verify_url: escapeHtml(link),
    };
    return {
      subject: pick(t, "subject", "Trojan Battalion Military Ball: Invitation", { guest_name: "Jordan Blake", cadet_name: "Cadet A. Rivera" }),
      html: ballEmailShell({
        preheader: "Cadet A. Rivera has invited you to the Trojan Battalion Military Ball.",
        heading: pick(t, "heading", "You Are Invited", gVars),
        introHtml: paras(pick(t, "intro_html", "{{guest_name}},\n\n{{cadet_name}} has requested the honor of your company at the Trojan Battalion Military Ball.", gVars)),
        particulars: SAMPLE_PARTICULARS,
        cta: { label: "Confirm Your Attendance", url: escapeHtml(link) },
        noticeHtml: pick(t, "notice_html", "", gVars) || undefined,
        closingHtml: `${paras(pick(t, "closing_html", "This step confirms any food allergies and your review of the attire requirements. Your host's registration is not complete until it is done.", gVars), { lastMargin: "10px" })}
<p style="margin:0;font-size:12px;color:#8A8266;">If the button does not work, use this link:<br />${escapeHtml(link)}</p>`,
        siteUrl: site,
      }),
    };
  }

  if (key === "guest_verified") {
    const vars: Record<string, string> = { cadet_name: "Cadet A. Rivera", guest_name: "Jordan Blake", site_url: escapeHtml(site) };
    return {
      subject: pick(t, "subject", "Your Ball guest is verified", { cadet_name: "Cadet A. Rivera", guest_name: "Jordan Blake" }),
      html: ballEmailShell({
        preheader: "Your Military Ball guest has been verified.",
        heading: pick(t, "heading", "Guest Confirmed", vars),
        introHtml: paras(pick(t, "intro_html", "Your guest has finished their part of the Military Ball signup. Your entry is now fully verified.", vars)),
        noticeHtml: pick(t, "notice_html", "", vars) || undefined,
        closingHtml: (() => { const c = pick(t, "closing_html", "", vars); return c ? paras(c) : undefined; })(),
        siteUrl: site,
      }),
    };
  }

  if (key === "signup_update") {
    const vars: Record<string, string> = { cadet_name: "Cadet A. Rivera", what: "Cash/check payment has been marked received" };
    return {
      subject: pick(t, "subject", "Military Ball signup update", vars),
      html: ballEmailShell({
        preheader: vars.what,
        heading: pick(t, "heading", "Signup Update", vars),
        introHtml: paras(pick(t, "intro_html", "{{what}} for {{cadet_name}}.", vars)),
        noticeHtml: pick(t, "notice_html", "", vars) || undefined,
        closingHtml: (() => { const c = pick(t, "closing_html", "", vars); return c ? paras(c) : undefined; })(),
        siteUrl: site,
      }),
    };
  }

  // allergy_flag
  const link = `${origin}/admin/ballallergy`;
  const vars: Record<string, string> = {
    cadet_name: "Cadet A. Rivera",
    dispatch_url: escapeHtml(link),
    contact: "phone <strong>(423) 555-0148</strong> (call or text) &middot; email a.rivera@example.com",
  };
  return {
    subject: pick(t, "subject", "New Ball allergy flag: {{cadet_name}}", { cadet_name: "Cadet A. Rivera" }),
    html: ballEmailShell({
      preheader: "Cadet A. Rivera flagged a food allergy on their Ball signup.",
      heading: pick(t, "heading", "Food Allergy Flagged", vars),
      introHtml: paras(pick(t, "intro_html", "{{cadet_name}} flagged a food allergy on their Military Ball signup.\n\nReach them: {{contact}}. Call or text is fastest.", vars)),
      noticeHtml: pick(t, "notice_html", "", vars) || undefined,
      closingHtml: (() => { const c = pick(t, "closing_html", "", vars); return c ? paras(c) : undefined; })(),
      cta: { label: "Open the Ball allergy list", url: link },
      siteUrl: site,
    }),
  };
}
