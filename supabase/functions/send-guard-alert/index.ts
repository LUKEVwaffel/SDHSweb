// Edge function: send-guard-alert
// Fires when an admin clicks "ALERT COLOR GUARD" / "ALERT HONOR GUARD" in
// EventsPanel.jsx. Direct-to-Resend, no email_messages row, no SAI/Top-3
// review — same posture as notify-new-message (in-app message alerts).
// Re-sendable anytime: every click re-notifies everyone currently on the
// roster (even if unchanged since last time — intentional, admin's
// discretion), AND separately notifies anyone who was on the roster at the
// last alert but has since been removed.
//
// AUTHENTICATED via getCaller() (mirrors notify-new-message / submit-for-review).
// Deploy WITH jwt verification (default):
//   supabase functions deploy send-guard-alert

import { json, preflight, escapeHtml } from "../_shared/http.ts";
import { serviceClient, getCaller } from "../_shared/supabase.ts";

type Position = {
  position_label: string;
  cadet_consent_id: string | null;
  cadet_consent: { name: string; school_email: string | null } | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const caller = await getCaller(req);
    if (!caller) return json({ error: "not authenticated" }, 401);
    if (caller.role !== "s5" && caller.role !== "s6") return json({ error: "forbidden" }, 403);

    const { event_id, guard_type } = await req.json().catch(() => ({}));
    if (!event_id || (guard_type !== "color" && guard_type !== "honor")) {
      return json({ error: "event_id and guard_type ('color'|'honor') required" }, 400);
    }

    const svc = serviceClient();

    const { data: event, error: eErr } = await svc
      .from("events")
      .select("id, title, date, event_time, location, team, color_guard_notes, honor_guard_notes")
      .eq("id", event_id).single();
    if (eErr || !event) return json({ error: "event not found" }, 404);

    // S-5 write scope mirrors event_color_guard_write_admin RLS exactly —
    // this function uses the service-role client, so RLS never applies and
    // that check has to be replicated here.
    if (caller.role === "s5" && event.team && event.team !== "raiders") {
      return json({ error: "forbidden" }, 403);
    }

    const table = guard_type === "color" ? "event_color_guard" : "event_honor_guard";
    const { data: rows, error: rErr } = await svc
      .from(table)
      .select("position_label, cadet_consent_id, cadet_consent:cadet_consent_id(name, school_email)")
      .eq("event_id", event_id)
      .order("sort_order");
    if (rErr) return json({ error: rErr.message }, 500);

    const positions = (rows ?? []) as unknown as Position[];
    const filled = positions.filter((p) => p.cadet_consent_id && p.cadet_consent?.school_email);
    const currentIds = filled.map((p) => p.cadet_consent_id as string);

    const { data: lastLog } = await svc
      .from("guard_alert_log")
      .select("recipient_ids")
      .eq("event_id", event_id).eq("guard_type", guard_type)
      .order("sent_at", { ascending: false })
      .limit(1).maybeSingle();
    const previousIds: string[] = lastLog?.recipient_ids ?? [];
    const currentSet = new Set(currentIds);
    const removedIds = previousIds.filter((id) => !currentSet.has(id));

    let removedNames: { name: string; school_email: string }[] = [];
    if (removedIds.length) {
      const { data: removedRows } = await svc
        .from("cadet_consent").select("id, name, school_email")
        .in("id", removedIds);
      removedNames = (removedRows ?? [])
        .filter((r: { school_email: string | null }) => r.school_email)
        .map((r: { name: string; school_email: string }) => ({ name: r.name, school_email: r.school_email }));
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM = Deno.env.get("FROM_EMAIL") ?? "Trojan Battalion <onboarding@resend.dev>";
    if (!RESEND_API_KEY) return json({ error: "RESEND_API_KEY not configured" }, 500);
    const fromAddress = FROM.replace(/.*<(.+)>.*/, "$1");

    const guardLabel = guard_type === "color" ? "Color Guard" : "Honor Guard";
    const dateLabel = event.date
      ? new Date(`${event.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })
      : "TBD";
    const notes = guard_type === "color" ? event.color_guard_notes : event.honor_guard_notes;

    const rosterHtml = filled
      .map((p) => `<li>${escapeHtml(p.position_label)} — ${escapeHtml(p.cadet_consent?.name ?? "")}</li>`)
      .join("");
    const rosterText = filled.map((p) => `- ${p.position_label}: ${p.cadet_consent?.name ?? ""}`).join("\n");

    async function sendBatch(toEmails: string[], subject: string, html: string, text: string) {
      if (!toEmails.length) return 0;
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM, to: [fromAddress], bcc: toEmails, subject, html, text }),
      });
      return res.ok ? toEmails.length : 0;
    }

    let notified = 0;
    if (filled.length) {
      const subject = `You're on ${guardLabel} — ${event.title}`;
      const html = `<p>You have been placed on <strong>${escapeHtml(guardLabel)}</strong> for:</p>
<p><strong>${escapeHtml(event.title)}</strong><br>${escapeHtml(dateLabel)}${event.event_time ? ` at ${escapeHtml(event.event_time)}` : ""}${event.location ? ` — ${escapeHtml(event.location)}` : ""}</p>
<p><strong>Full ${escapeHtml(guardLabel)} roster:</strong></p>
<ul>${rosterHtml}</ul>
${notes ? `<p><strong>Directions:</strong> ${escapeHtml(notes)}</p>` : ""}
<p>You will be added to a group chat later to discuss specifics.</p>`;
      const text = `You have been placed on ${guardLabel} for ${event.title} (${dateLabel}).\n\nFull roster:\n${rosterText}\n${notes ? `\nDirections: ${notes}\n` : ""}\nYou will be added to a group chat later to discuss specifics.`;
      notified = await sendBatch(filled.map((p) => p.cadet_consent!.school_email as string), subject, html, text);
    }

    let removed = 0;
    if (removedNames.length) {
      const subject = `Update: ${guardLabel} roster change — ${event.title}`;
      const html = `<p>You have been removed from the <strong>${escapeHtml(guardLabel)}</strong> roster for <strong>${escapeHtml(event.title)}</strong> (${escapeHtml(dateLabel)}).</p>
<p>Contact leadership if you have questions.</p>`;
      const text = `You have been removed from the ${guardLabel} roster for ${event.title} (${dateLabel}). Contact leadership if you have questions.`;
      removed = await sendBatch(removedNames.map((r) => r.school_email), subject, html, text);
    }

    await svc.from("guard_alert_log").insert({
      event_id, guard_type, sent_by: caller.email,
      recipient_ids: currentIds, removed_ids: removedIds,
      recipient_count: notified, removed_count: removed,
    });

    return json({ ok: true, notified, removed });
  } catch (e) {
    console.error("send-guard-alert", e);
    return json({ error: "internal error" }, 500);
  }
});
