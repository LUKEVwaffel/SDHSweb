// Supabase Edge Function: send-email
// Sends a signed email_messages row to all active subscribers via Resend.
//
// SIGNATURE GATE (enforced server-side): refuses unless the message row is
// status='signed'. The client button being disabled is convenience; THIS is the
// real lock — even a crafted request cannot send an unsigned message.
//
// Secrets (set with `supabase secrets set`, NEVER in .env / client bundle):
//   RESEND_API_KEY   required
//   FROM_EMAIL       optional, e.g. "Trojan Battalion <s6@yourdomain.org>"
//                    (must be a Resend-verified domain; defaults to the Resend
//                     test sender, which only delivers to the account owner)
// Deploy: supabase functions deploy send-email
//
// If invocation is rejected for auth, disable JWT verification for this function
// (it is passcode-gated in the app, not per-user authed):
//   supabase functions deploy send-email --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const { message_id } = await req.json();
    if (!message_id) return json({ error: "message_id required" }, 400);

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) return json({ error: "RESEND_API_KEY not configured" }, 500);
    const FROM = Deno.env.get("FROM_EMAIL") ?? "Trojan Battalion <onboarding@resend.dev>";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Load message + enforce the gate.
    const { data: msg, error: mErr } = await supabase
      .from("email_messages").select("*").eq("id", message_id).single();
    if (mErr || !msg) return json({ error: "message not found" }, 404);
    if (msg.status === "sent") return json({ error: "already sent" }, 409);
    if (msg.status !== "signed") return json({ error: "not cleared to send — message must be signed" }, 403);

    // Active recipients.
    const { data: subs, error: sErr } = await supabase
      .from("email_subscribers").select("email").eq("active", true);
    if (sErr) return json({ error: sErr.message }, 500);
    const emails = (subs ?? []).map((s: { email: string }) => s.email).filter(Boolean);
    if (!emails.length) return json({ error: "no active subscribers" }, 400);

    // Resend caps recipients per send — batch as BCC to protect privacy.
    let sent = 0;
    for (const batch of chunk(emails, 45)) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM,
          to: [FROM.replace(/.*<(.+)>.*/, "$1")],
          bcc: batch,
          subject: msg.subject,
          text: msg.body,
        }),
      });
      if (!res.ok) {
        const detail = await res.text();
        await supabase.from("email_messages").update({ send_error: `Resend ${res.status}: ${detail}`.slice(0, 500) }).eq("id", message_id);
        return json({ error: `send failed (${res.status})`, detail }, 502);
      }
      sent += batch.length;
    }

    await supabase.from("email_messages")
      .update({ status: "sent", sent_at: new Date().toISOString(), recipient_count: sent, send_error: null })
      .eq("id", message_id);

    return json({ ok: true, recipient_count: sent });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
