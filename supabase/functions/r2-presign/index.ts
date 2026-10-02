// Edge function: r2-presign
// DISPATCH-staff only (any admin_roles row). Mints a short-lived presigned
// S3 URL for a Cloudflare R2 PUT or DELETE. R2's secret key can never ship
// to the browser (no anon-write RLS-equivalent on R2), so every write from
// the client goes through here instead of touching Supabase Storage.
//
// Scoped to the 5 egress-driver buckets migrated in this pass — see
// r2-migration project memory. Reads bypass this entirely and go straight
// to the r2-media-reader Worker at the public media domain.
//
// Deploy WITH jwt verification (default):
//   supabase functions deploy r2-presign
import { json, preflight } from "../_shared/http.ts";
import { getCaller } from "../_shared/supabase.ts";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";

const ALLOWED_BUCKETS = new Set([
  "beta-event-photos",
  "event-photos",
  "tv-daily-photos",
  "tv-team-photos",
  "raider-videos",
]);

const PRESIGN_TTL_SECONDS = 300;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const caller = await getCaller(req);
    if (!caller || !caller.role) return json({ error: "not authorized" }, 403);
    if (caller.mustChangePassword) return json({ error: "set your own password first" }, 403);

    const { bucket, key, method, contentType } = await req.json().catch(() => ({}));
    if (!ALLOWED_BUCKETS.has(bucket)) return json({ error: "invalid bucket" }, 400);
    if (typeof key !== "string" || !key || key.includes("..") || key.startsWith("/")) {
      return json({ error: "invalid key" }, 400);
    }
    if (method !== "PUT" && method !== "DELETE") return json({ error: "invalid method" }, 400);

    const accountId = Deno.env.get("R2_ACCOUNT_ID")!;
    const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID")!;
    const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY")!;

    const client = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });

    const encodedKey = key.split("/").map(encodeURIComponent).join("/");
    const url = new URL(`https://${accountId}.r2.cloudflarestorage.com/${bucket}/${encodedKey}`);
    url.searchParams.set("X-Amz-Expires", String(PRESIGN_TTL_SECONDS));

    const toSign = new Request(url, {
      method,
      headers: method === "PUT" && contentType ? { "content-type": contentType } : {},
    });
    const signed = await client.sign(toSign, { aws: { signQuery: true } });

    return json({ url: signed.url, expiresIn: PRESIGN_TTL_SECONDS });
  } catch (e) {
    console.error("r2-presign", e);
    return json({ error: "internal error" }, 500);
  }
});
