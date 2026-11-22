// Edge function: board-sai-signoff
// The SAI signs one company's boards for the open quarter with his PIN —
// one signature per company, not per cadet. Requires every session for that
// company to be board-signed. On success, applies each final promotion
// (board decision, or the SAI's overturn) to cadet_consent.cadet_rank.
//
// Body: { quarter_id, company, pin, note? }
// Deploy WITH jwt verification (default).
import { json, preflight } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { PIN_RE } from "../_shared/pin.ts";
import { getBoardMember, checkBoardPin } from "../_shared/board.ts";

const COMPANIES = ["alpha", "bravo", "charlie", "delta"];
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const sai = await getBoardMember(req);
    if (!sai || sai.board_role !== "sai") return json({ error: "SAI only" }, 403);

    const { quarter_id, company, pin, note } = await req.json().catch(() => ({}));
    if (!COMPANIES.includes(company)) return json({ error: "bad company" }, 400);
    if (!PIN_RE.test(String(pin ?? ""))) return json({ error: "invalid" }, 401);

    const check = await checkBoardPin(sai.email, String(pin));
    if (!check.ok) return json(check.body, check.status);
    const { data: signoff, error } = await serviceClient().rpc('board_commit_sai_signoff', {
      p_quarter_id: quarter_id, p_company: company, p_sai: sai.email,
      p_note: typeof note === 'string' ? note : null,
    });
    if (error) {
      console.error('board signoff transaction', error);
      return json({ error: error.message.startsWith('board: ') ? error.message.slice(7) : 'Could not apply signoff; please retry' }, error.message.startsWith('board: ') ? 409 : 500);
    }
    return json({ ok: true, signoff });
  } catch (e) {
    console.error("board-sai-signoff", e);
    return json({ error: "internal error" }, 500);
  }
});
