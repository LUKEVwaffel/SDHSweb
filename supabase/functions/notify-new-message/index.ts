// Edge function: notify-new-message
// Fires after an admin sends a DISPATCH chat message — Composer.jsx invokes
// this right after the insert succeeds, same fire-and-forget client pattern
// every other notify-* function uses (see notify-question-submitted).
//
// AUTHENTICATED, unlike notify-question-submitted (that one's public-
// triggered off an anon form submit). DISPATCH chat is admin-only end to
// end, so this follows submit-for-review / set-pin's getCaller() gate
// instead. Deploy WITH jwt verification (default):
//   supabase functions deploy notify-new-message
//
// Only emails recipients who are NOT "actively in DISPATCH" right now, per
// admin_presence.last_seen_at — see useAdminPresence.js's
// PRESENCE_ONLINE_WINDOW_MS. ONLINE_WINDOW_MS below MUST stay the same value;
// it can't literally share a constant with the client across the Deno/JS
// boundary, but the two must agree on 90s.
import { json, preflight, escapeHtml, siteOrigin } from "../_shared/http.ts";
import { serviceClient, getCaller } from "../_shared/supabase.ts";

const ONLINE_WINDOW_MS = 90_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const caller = await getCaller(req);
    if (!caller) return json({ error: "not authenticated" }, 401);

    const { message_id } = await req.json().catch(() => ({}));
    if (!message_id) return json({ error: "message_id required" }, 400);

    const svc = serviceClient();

    const { data: msg, error: mErr } = await svc
      .from("messages").select("*").eq("id", message_id).single();
    if (mErr || !msg) return json({ error: "message not found" }, 404);

    // Caller must be the actual sender of record — a crafted request can't
    // trigger a notification email for someone else's message.
    if (msg.sender_email?.toLowerCase() !== caller.email) return json({ error: "forbidden" }, 403);

    const { data: convo, error: cErr } = await svc
      .from("conversations").select("id, is_group, title").eq("id", msg.conversation_id).single();
    if (cErr || !convo) return json({ error: "conversation not found" }, 404);

    const { data: parts, error: pErr } = await svc
      .from("conversation_participants").select("email").eq("conversation_id", msg.conversation_id);
    if (pErr) return json({ error: pErr.message }, 500);

    const recipientEmails = (parts ?? [])
      .map((p: { email: string }) => p.email.toLowerCase())
      .filter((e: string) => e !== caller.email);
    if (!recipientEmails.length) return json({ ok: true, notified: 0 });

    // Skip anyone actively in DISPATCH right now — they're already seeing
    // this live over Realtime, an email would just be noise.
    const { data: presenceRows } = await svc
      .from("admin_presence").select("email, last_seen_at").in("email", recipientEmails);
    const now = Date.now();
    const recentlyActive = new Set(
      (presenceRows ?? [])
        .filter((r: { last_seen_at: string }) => now - new Date(r.last_seen_at).getTime() < ONLINE_WINDOW_MS)
        .map((r: { email: string }) => r.email.toLowerCase())
    );
    const toEmail = recipientEmails.filter((e: string) => !recentlyActive.has(e));
    if (!toEmail.length) return json({ ok: true, notified: 0, skipped_active: recipientEmails.length });

    const { data: roles } = await svc
      .from("admin_roles").select("email, display_name").in("email", [caller.email, ...toEmail]);
    const nameByEmail: Record<string, string> = {};
    (roles ?? []).forEach((r: { email: string; display_name: string | null }) => {
      nameByEmail[r.email.toLowerCase()] = r.display_name || r.email;
    });
    const senderName = nameByEmail[caller.email] || caller.email;

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM = Deno.env.get("FROM_EMAIL") ?? "Trojan Battalion <onboarding@resend.dev>";
    const origin = siteOrigin();
    if (!RESEND_API_KEY) return json({ error: "RESEND_API_KEY not configured" }, 500);
    if (!origin) return json({ error: "WEBAUTHN_ORIGIN not configured (reused as site origin)" }, 500);

    const link = `${origin}/admin/messages?c=${encodeURIComponent(msg.conversation_id)}`;
    const convoLabel = convo.is_group ? (convo.title ? `"${convo.title}"` : "a group chat") : "a direct message";
    const snippet = msg.body
      ? (msg.body.length > 200 ? `${msg.body.slice(0, 200)}…` : msg.body)
      : (msg.attachment_filename ? `📎 ${msg.attachment_filename}` : "(no text)");

    let notified = 0;
    for (const email of toEmail) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM,
          to: [email],
          subject: `New DISPATCH message from ${senderName}`,
          html: `<p>${escapeHtml(nameByEmail[email] || email)},</p>
<p><strong>${escapeHtml(senderName)}</strong> sent you a message in ${escapeHtml(convoLabel)}:</p>
<p>${escapeHtml(snippet)}</p>
<p><a href="${escapeHtml(link)}">Open DISPATCH</a> to reply.</p>`,
          text: `${senderName} sent a message in ${convoLabel}: ${snippet}\n\n${link}`,
        }),
      });
      if (res.ok) notified += 1;
    }

    return json({ ok: true, notified, skipped_active: recipientEmails.length - toEmail.length });
  } catch (e) {
    console.error("notify-new-message", e);
    return json({ error: "internal error" }, 500);
  }
});
