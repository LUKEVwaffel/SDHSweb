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
import { getBoardMember, checkBoardPin, sha256Hex } from "../_shared/board.ts";

const COMPANIES = ["alpha", "bravo", "charlie", "delta"];
const LADDER: Record<string, number> = {
  PVT: 0, PV2: 1, PFC: 2, CPL: 3, SGT: 4, SSG: 5, SFC: 6, MSG: 7, "1SG": 7,
  SGM: 8, CSM: 8, "2LT": 9, "1LT": 10, CPT: 11, MAJ: 12, LTC: 13, COL: 14,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const sai = await getBoardMember(req);
    if (!sai || sai.board_role !== "sai") return json({ error: "SAI only" }, 403);

    const { quarter_id, company, pin, note } = await req.json().catch(() => ({}));
    if (!COMPANIES.includes(company)) return json({ error: "bad company" }, 400);
    if (!PIN_RE.test(String(pin ?? ""))) return json({ error: "invalid" }, 401);

    const svc = serviceClient();
    const { data: quarter } = await svc.from("board_quarters").select("id, status").eq("id", quarter_id).maybeSingle();
    if (!quarter) return json({ error: "quarter not found" }, 404);

    const { data: existing } = await svc.from("board_sai_signoffs")
      .select("id").eq("quarter_id", quarter_id).eq("company", company).maybeSingle();
    if (existing) return json({ error: "already signed off" }, 409);

    const { data: sessions, error: sErr } = await svc.from("board_sessions")
      .select("id, status, seal").eq("quarter_id", quarter_id).eq("company", company);
    if (sErr) { console.error("signoff sessions", sErr); return json({ error: "internal error" }, 500); }

    const { data: sheets, error: shErr } = await svc.from("board_sheets")
      .select("id, session_id, cadet_id, rank_before, decision, promote_to, sai_decision, sai_promote_to, seal")
      .eq("quarter_id", quarter_id).eq("company", company);
    if (shErr) { console.error("signoff sheets", shErr); return json({ error: "internal error" }, 500); }

    const openWithWork = (sessions ?? []).filter((s) =>
      s.status === "open" && (sheets ?? []).some((sh) => sh.session_id === s.id));
    if (openWithWork.length) return json({ error: "the company board has unsigned sheets" }, 409);
    if (!(sheets ?? []).length) return json({ error: "no board sheets for this company" }, 409);

    const check = await checkBoardPin(sai.email, String(pin));
    if (!check.ok) return json(check.body, check.status);

    // Empty open sessions are just an unused laptop login — drop them.
    const emptyOpen = (sessions ?? []).filter((s) => s.status === "open").map((s) => s.id);
    if (emptyOpen.length) await svc.from("board_sessions").delete().in("id", emptyOpen);

    const seal = await sha256Hex((sheets ?? []).map((s) => s.seal ?? "").sort().join(":"));
    const { data: signoff, error: insErr } = await svc.from("board_sai_signoffs").insert({
      quarter_id, company, signed_by: sai.email, signed_name: sai.display_name,
      note: typeof note === "string" && note.trim() ? note.trim().slice(0, 2000) : null, seal,
    }).select("*").single();
    if (insErr) {
      if (insErr.code === "23505") return json({ error: "already signed off" }, 409);
      console.error("signoff insert", insErr);
      return json({ error: "internal error" }, 500);
    }

    // Apply promotions — never lowers a rank that was raised some other way.
    let applied = 0;
    const now = new Date().toISOString();
    for (const s of sheets ?? []) {
      const finalDecision = s.sai_decision ?? s.decision;
      const target = finalDecision === "promote" ? (s.sai_promote_to ?? s.promote_to) : null;
      if (!target || !s.cadet_id) continue;
      const { data: cadet } = await svc.from("cadet_consent").select("cadet_rank").eq("id", s.cadet_id).maybeSingle();
      if (cadet && (LADDER[cadet.cadet_rank ?? "PVT"] ?? 0) >= LADDER[target]) continue;
      const { error } = await svc.from("cadet_consent").update({
        cadet_rank: target, cadet_rank_updated_at: now, cadet_rank_source: "promotion",
      }).eq("id", s.cadet_id);
      if (error) console.error("apply promotion", s.cadet_id, error);
      else applied++;
    }
    await svc.from("board_sai_signoffs").update({ promotions_applied: applied }).eq("id", signoff.id);

    return json({ ok: true, signoff: { ...signoff, promotions_applied: applied } });
  } catch (e) {
    console.error("board-sai-signoff", e);
    return json({ error: "internal error" }, 500);
  }
});
