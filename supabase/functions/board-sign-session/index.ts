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
import { getBoardMember, checkBoardPin, sha256Hex, canonical, sealPayload } from "../_shared/board.ts";

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
    if (session.status !== "open") return json({ error: "session already signed" }, 409);

    const idx = ORDER.indexOf(seat);
    for (const prior of ORDER.slice(0, idx)) {
      if (!session[`sig_${prior}_at`]) return json({ error: `${prior.toUpperCase()} must sign first` }, 409);
    }
    if (session[`sig_${seat}_at`]) return json({ error: "already signed" }, 409);

    const { data: sheets, error: shErr } = await svc
      .from("board_sheets").select("*").eq("session_id", session.id);
    if (shErr) { console.error("sign sheets lookup", shErr); return json({ error: "internal error" }, 500); }
    const complete = (sheets ?? []).filter((s) => s.status === "complete");
    if (complete.length === 0) return json({ error: "no completed sheets to sign" }, 409);
    if ((sheets ?? []).some((s) => s.status === "draft")) {
      return json({ error: "finish or discard every draft sheet before signing" }, 409);
    }

    const { data: holder, error: hErr } = await svc
      .from("board_members").select("email, display_name")
      .eq("company", session.company).eq("board_role", seat).eq("active", true).maybeSingle();
    if (hErr) { console.error("sign seat holder", hErr); return json({ error: "internal error" }, 500); }
    if (!holder) return json({ error: `no active ${seat.toUpperCase()} account for this company` }, 409);

    const check = await checkBoardPin(holder.email, String(pin));
    if (!check.ok) return json(check.body, check.status);

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      [`sig_${seat}_email`]: holder.email,
      [`sig_${seat}_name`]: holder.display_name,
      [`sig_${seat}_at`]: now,
    };

    // Final signature seals the session.
    if (seat === "co") {
      const seals: string[] = [];
      for (const s of complete.sort((a, b) => a.id.localeCompare(b.id))) {
        const seal = await sha256Hex(canonical(sealPayload(s)));
        seals.push(seal);
        const { error } = await svc.from("board_sheets").update({ locked: true, seal }).eq("id", s.id).eq("locked", false);
        if (error) { console.error("seal sheet", error); return json({ error: "internal error" }, 500); }
      }
      patch.status = "signed";
      patch.signed_at = now;
      patch.seal = await sha256Hex(seals.join(":"));
    }

    // Conditional on the seat still being empty — two taps can't double-sign.
    const { data: updated, error: uErr } = await svc
      .from("board_sessions").update(patch)
      .eq("id", session.id).eq("status", "open").is(`sig_${seat}_at`, null)
      .select("*").maybeSingle();
    if (uErr) { console.error("sign update", uErr); return json({ error: "internal error" }, 500); }
    if (!updated) return json({ error: "already signed" }, 409);

    return json({ ok: true, session: updated });
  } catch (e) {
    console.error("board-sign-session", e);
    return json({ error: "internal error" }, 500);
  }
});
