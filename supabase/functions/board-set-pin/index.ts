// Edge function: board-set-pin
// SELF-ONLY PIN change for a signed-in board member. Requires the CURRENT
// PIN too — boards run on a shared laptop, so a signed-in session alone must
// not be enough to replace someone's signature PIN.
// Body: { current_pin, new_pin }
// Deploy WITH jwt verification (default).
import { json, preflight } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { hashPin, PIN_RE } from "../_shared/pin.ts";
import { getBoardMember, checkBoardPin } from "../_shared/board.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const me = await getBoardMember(req);
    if (!me) return json({ error: "not authenticated" }, 401);

    const { current_pin, new_pin } = await req.json().catch(() => ({}));
    if (!PIN_RE.test(String(new_pin ?? ""))) return json({ error: "PIN must be exactly 4 digits" }, 400);
    if (!PIN_RE.test(String(current_pin ?? ""))) return json({ error: "invalid" }, 401);

    const check = await checkBoardPin(me.email, String(current_pin));
    if (!check.ok) return json(check.body, check.status);

    const { error } = await serviceClient().from("board_credentials").update({
      pin_hash: await hashPin(String(new_pin)), pin_fail_count: 0, pin_locked_until: null,
      updated_at: new Date().toISOString(),
    }).eq("email", me.email);
    return error ? json({ error: error.message }, 500) : json({ ok: true });
  } catch (e) {
    console.error("board-set-pin", e);
    return json({ error: "internal error" }, 500);
  }
});
