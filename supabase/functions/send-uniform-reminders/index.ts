// Edge function: send-uniform-reminders
// Called ONLY by pg_net from generate_uniform_reminders() (supabase/uniform_reminders.sql),
// itself fired daily by pg_cron. Fully automated — no admin click, no draft,
// no review. "Ironclad": every Thursday UNIFORM_DAY event auto-emails every
// cadet on the preceding Monday and Wednesday.
//
// Auth: the caller is pg_net, not a human — it presents the project's own
// service_role key (pulled from Vault) as its bearer token. That's already a
// valid Supabase JWT, so the platform's own jwt-verification gate passes;
// this function ALSO checks the bearer equals SUPABASE_SERVICE_ROLE_KEY
// directly, so nothing else can ever trigger a real send by guessing a URL.
// Deploy WITH jwt verification (default):
//   supabase functions deploy send-uniform-reminders

import { json, preflight, escapeHtml } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceKey || authHeader !== `Bearer ${serviceKey}`) {
      return json({ error: "forbidden" }, 403);
    }

    const { event_id, offset } = await req.json().catch(() => ({}));
    if (!event_id) return json({ error: "event_id required" }, 400);

    const svc = serviceClient();

    const { data: event, error: eErr } = await svc
      .from("events").select("id, title, date, uniform").eq("id", event_id).single();
    if (eErr || !event) return json({ error: "event not found" }, 404);

    const { data: cadets, error: cErr } = await svc
      .from("cadet_consent").select("school_email")
      .in("company", ["alpha", "bravo", "charlie", "delta"])
      .not("school_email", "is", null);
    if (cErr) return json({ error: cErr.message }, 500);

    const emails = Array.from(new Set((cadets ?? [])
      .map((c: { school_email: string | null }) => c.school_email?.toLowerCase())
      .filter((e): e is string => !!e)));
    if (!emails.length) return json({ ok: true, sent: 0, reason: "no cadet school emails on file" });

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM = Deno.env.get("FROM_EMAIL") ?? "Trojan Battalion <onboarding@resend.dev>";
    if (!RESEND_API_KEY) return json({ error: "RESEND_API_KEY not configured" }, 500);
    const fromAddress = FROM.replace(/.*<(.+)>.*/, "$1");

    const dateLabel = event.date
      ? new Date(`${event.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })
      : "Thursday";
    const dayLabel = offset === "monday" ? "in 3 days" : "in 2 days";
    const subject = `Uniform Reminder: ${event.title} — ${dateLabel}`;
    const html = `<p>Reminder: wear uniform for <strong>${escapeHtml(event.title)}</strong> on <strong>${escapeHtml(dateLabel)}</strong> (${dayLabel}).</p>
${event.uniform ? `<p><strong>Uniform:</strong> ${escapeHtml(event.uniform)}</p>` : ""}
<p>No excuses — come prepared.</p>`;
    const text = `Reminder: wear uniform for ${event.title} on ${dateLabel} (${dayLabel}).${event.uniform ? `\nUniform: ${event.uniform}` : ""}\nNo excuses — come prepared.`;

    function chunk<T>(arr: T[], size: number): T[][] {
      const out: T[][] = [];
      for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
      return out;
    }

    let sent = 0;
    for (const batch of chunk(emails, 45)) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM, to: [fromAddress], bcc: batch, subject, html, text }),
      });
      if (res.ok) sent += batch.length;
    }

    return json({ ok: true, sent });
  } catch (e) {
    console.error("send-uniform-reminders", e);
    return json({ error: "internal error" }, 500);
  }
});
