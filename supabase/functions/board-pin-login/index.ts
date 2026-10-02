// Edge function: board-pin-login
// PRE-AUTH login for /boards: email + 4-digit PIN → real Supabase session.
// Same lockout as rifle-pin-login (5 fails → 15 minutes). Email-only is NOT
// enough here — board members sign promotion sheets with this identity.
// Deploy WITHOUT jwt verification: supabase functions deploy board-pin-login --no-verify-jwt
import { json, preflight } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { PIN_RE } from "../_shared/pin.ts";
import { mintSessionToken } from "../_shared/session.ts";
import { checkBoardPin } from "../_shared/board.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const { email, pin } = await req.json().catch(() => ({}));
    const account = String(email || "").trim().toLowerCase();
    if (!account || !PIN_RE.test(String(pin ?? ""))) return json({ error: "invalid" }, 401);

    const check = await checkBoardPin(account, String(pin));
    if (!check.ok) return json(check.body, check.status);

    const { data: member, error } = await serviceClient()
      .from("board_members").select("active").eq("email", account).maybeSingle();
    if (error) { console.error("board-pin-login member", error); return json({ error: "internal error" }, 500); }
    if (!member?.active) return json({ error: "invalid" }, 401);

    const token_hash = await mintSessionToken(account);
    return json({ ok: true, token_hash });
  } catch (e) {
    console.error("board-pin-login", e);
    return json({ error: "internal error" }, 500);
  }
});
