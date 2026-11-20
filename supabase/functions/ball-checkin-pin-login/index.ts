// A desk PIN authenticates a separate check-in identity, never a DISPATCH login.
import { json, preflight } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { mintSessionToken } from "../_shared/session.ts";
import { checkinTag } from "../_shared/checkinPin.ts";
import { PIN_RE } from "../_shared/pin.ts";

Deno.serve(async req => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const { pin, expected_actor } = await req.json();
    if (typeof pin !== "string" || !PIN_RE.test(pin) ||
        (expected_actor != null && (typeof expected_actor !== "string" || expected_actor.length > 254))) {
      return json({ error: "Enter all four digits of your check-in PIN." }, 400);
    }
    const address = req.headers.get("x-real-ip") || req.headers.get("cf-connecting-ip")
      || req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "unknown";
    const [tag, network] = await Promise.all([checkinTag("pin", pin), checkinTag("network", address.slice(0, 128))]);
    const { data, error } = await serviceClient().rpc("ball_lookup_checkin_pin", {
      p_tag: tag, p_network: network, p_expected_actor: expected_actor ?? null,
    });
    if (error) return json({ error: "Check-in sign-in is temporarily unavailable." }, 503);
    if (data?.limited) return json({ error: "Too many attempts. Try again later or ask the Ball organizer." }, 429);
    if (!data?.auth_email) return json({ error: "PIN not accepted. Check with the Ball organizer." }, 401);
    return json({ token_hash: await mintSessionToken(data.auth_email) });
  } catch {
    return json({ error: "Could not open check-in. Try again." }, 503);
  }
});
