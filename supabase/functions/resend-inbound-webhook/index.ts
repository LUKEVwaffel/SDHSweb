// Supabase Edge Function: resend-inbound-webhook
// Receives Resend's `email.received` webhook (a reply landing on the domain's
// receiving address) and stores it in public.email_replies for the admin
// Inbox tab. See supabase/email_inbound.sql for the one-time Resend
// dashboard setup this depends on (receiving domain + webhook + secret).
//
// Secrets:
//   RESEND_WEBHOOK_SECRET   required — the "whsec_..." signing secret Resend
//                            shows once when the webhook is created.
// Deploy (no user JWT arrives on this call — Resend authenticates the
// request itself via the Svix signature below):
//   supabase functions deploy resend-inbound-webhook --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cors, json, preflight } from "../_shared/http.ts";

// Resend signs webhooks the Svix way: HMAC-SHA256 over
// "<svix-id>.<svix-timestamp>.<raw body>", keyed by the base64 payload after
// the secret's "whsec_" prefix. The header carries one or more
// "v1,<base64 signature>" entries — any match is a pass.
async function isValidSignature(secret: string, id: string, timestamp: string, body: string, signatureHeader: string): Promise<boolean> {
  const secretBytes = Uint8Array.from(atob(secret.replace(/^whsec_/, "")), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${timestamp}.${body}`));
  const expected = btoa(String.fromCharCode(...new Uint8Array(signed)));
  return signatureHeader.split(" ").some((entry) => entry.split(",")[1] === expected);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const WEBHOOK_SECRET = Deno.env.get("RESEND_WEBHOOK_SECRET");
  if (!WEBHOOK_SECRET) return json({ error: "RESEND_WEBHOOK_SECRET not configured" }, 500);

  const rawBody = await req.text();
  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return json({ error: "missing svix headers" }, 400);
  }
  if (!(await isValidSignature(WEBHOOK_SECRET, svixId, svixTimestamp, rawBody, svixSignature))) {
    return json({ error: "invalid signature" }, 401);
  }

  let payload: { type?: string; data?: Record<string, unknown> };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }

  // Ack anything that isn't an inbound message so Resend stops retrying it —
  // this endpoint only cares about replies landing in the inbox.
  if (payload.type !== "email.received") return json({ ok: true, skipped: payload.type });

  const data = payload.data ?? {};
  const headers = Array.isArray(data.headers) ? data.headers as Array<{ name?: string; value?: string }> : [];
  const findHeader = (name: string) => headers.find((h) => h?.name?.toLowerCase() === name.toLowerCase())?.value ?? null;

  const fromRaw = String(data.from ?? "");
  const fromMatch = fromRaw.match(/^(.*?)\s*<(.+)>$/);
  const fromName = fromMatch ? fromMatch[1].replace(/^"|"$/g, "").trim() || null : null;
  const fromAddress = fromMatch ? fromMatch[2] : fromRaw;

  const toRaw = data.to;
  const toAddress = Array.isArray(toRaw) ? String(toRaw[0] ?? "") : String(toRaw ?? "");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { error } = await supabase.from("email_replies").upsert({
    resend_email_id: (data.email_id as string) ?? (data.id as string) ?? svixId,
    from_address: fromAddress || "unknown",
    from_name: fromName,
    to_address: toAddress || null,
    subject: (data.subject as string) ?? null,
    text_body: (data.text as string) ?? null,
    html_body: (data.html as string) ?? null,
    in_reply_to: findHeader("In-Reply-To"),
    raw: payload,
  }, { onConflict: "resend_email_id" });

  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
});
