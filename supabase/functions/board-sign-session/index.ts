// Edge function: board-sign-session
// One board member signs their company's open session with their OWN PIN,
// on the shared board laptop. Order matches the paper sheet: 1SG → XO →
// CMMDR. The CMMDR signature seals the session: every complete sheet is
// locked and stamped with a SHA-256 seal of exactly what was signed.
//
// Body: { session_id, seat: '1sg' | 'xo' | 'co', pin }
// The laptop's signed-in account must be a board member of that company;
// the PIN is checked against whoever holds `seat`, not the laptop account.
// Deploy WITH jwt verification (default).
import { json, preflight } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { PIN_RE } from "../_shared/pin.ts";
import { getBoardMember, checkBoardPin } from "../_shared/board.ts";

const ORDER = ["1sg", "xo", "co"] as const;
type Seat = typeof ORDER[number];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const laptop = await getBoardMember(req);
    if (!laptop || !laptop.company || !ORDER.includes(laptop.board_role as Seat)) {
      return json({ error: "not a company board member" }, 403);
    }

    const { session_id, seat, pin } = await req.json().catch(() => ({}));
    if (!ORDER.includes(seat)) return json({ error: "bad seat" }, 400);
    if (!PIN_RE.test(String(pin ?? ""))) return json({ error: "invalid" }, 401);

    const svc = serviceClient();
    const { data: session, error: sErr } = await svc
      .from("board_sessions").select("*").eq("id", session_id).maybeSingle();
    if (sErr) { console.error("sign session lookup", sErr); return json({ error: "internal error" }, 500); }
    if (!session || session.company !== laptop.company) return json({ error: "session not found" }, 404);
    const { data: holder, error: hErr } = await svc
      .from("board_members").select("email, display_name")
      .eq("company", session.company).eq("board_role", seat).eq("active", true).maybeSingle();
    if (hErr) { console.error("sign seat holder", hErr); return json({ error: "internal error" }, 500); }
    if (!holder) return json({ error: `no active ${seat.toUpperCase()} account for this company` }, 409);

    const check = await checkBoardPin(holder.email, String(pin));
    if (!check.ok) return json(check.body, check.status);

    const { data: updated, error: commitError } = await svc.rpc('board_commit_signature', {
      p_session_id: session.id, p_seat: seat, p_holder: holder.email, p_laptop: laptop.email,
    });
    if (commitError) {
      console.error('board signature transaction', commitError);
      return json({ error: commitError.message.startsWith('board: ') ? commitError.message.slice(7) : 'Could not record signature; please retry' }, commitError.message.startsWith('board: ') ? 409 : 500);
    }

    return json({ ok: true, session: updated });
  } catch (e) {
    console.error("board-sign-session", e);
    return json({ error: "internal error" }, 500);
  }
});
