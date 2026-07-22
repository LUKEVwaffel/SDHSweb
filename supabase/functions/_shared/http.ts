// Shared HTTP helpers for DISPATCH edge functions. Matches the CORS posture of
// the existing send-email function.
export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

export const preflight = () => new Response("ok", { headers: cors });

// Frontend origin for building deep links in outbound emails. Reuses the
// WEBAUTHN_ORIGIN secret (already set to the exact production origin for
// passkey RP config) instead of adding a duplicate secret — it's the same
// value by definition (the site's own scheme+host).
export const siteOrigin = (): string => Deno.env.get("WEBAUTHN_ORIGIN") ?? "";

// Minimal HTML escaper for values interpolated into Resend notification
// bodies (reviewer feedback, subjects) — same allowlist-nothing approach as
// src/components/admin/panels/email/emailRender.js's escapeHtml.
export function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
