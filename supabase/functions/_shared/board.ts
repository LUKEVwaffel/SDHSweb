// Shared helpers for the company promotion boards edge functions
// (supabase/company_boards.sql). board_members is its own population —
// separate from admin_roles / email_reviewers / rifle_admins.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serviceClient } from "./supabase.ts";
import { verifyPin } from "./pin.ts";

export interface BoardMember {
  email: string;
  display_name: string;
  board_role: "co" | "xo" | "1sg" | "sai" | "viewer";
  company: string | null;
  cadet_id: string | null;
}

const MAX_FAILS = 5;

/** Caller's email from the bearer token, or null. */
export async function callerEmail(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const scoped = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );
  const { data: { user } } = await scoped.auth.getUser();
  return user?.email?.toLowerCase() ?? null;
}

/** Active board member for the signed-in caller, or null. */
export async function getBoardMember(req: Request): Promise<BoardMember | null> {
  const email = await callerEmail(req);
  if (!email) return null;
  const { data, error } = await serviceClient()
    .from("board_members")
    .select("email, display_name, board_role, company, cadet_id")
    .eq("email", email)
    .eq("active", true)
    .maybeSingle();
  if (error) { console.error("getBoardMember", error); return null; }
  return (data as BoardMember) ?? null;
}

export type PinCheck =
  | { ok: true }
  | { ok: false; status: number; body: Record<string, unknown> };

function lockUntilMinute(ts: string): string {
  const d = new Date(ts);
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + 1);
  return d.toISOString();
}

/**
 * Reserve-before-verify PIN check with the 5-fails → 15-minute lockout,
 * identical in shape to rifle-pin-login. Used by login AND by signing, so a
 * signature PIN can't be brute-forced through the sign endpoint either.
 */
export async function checkBoardPin(email: string, pin: string): Promise<PinCheck> {
  const svc = serviceClient();
  const reserve = await svc.rpc("reserve_board_pin_attempt", { p_email: email });
  if (reserve.error) {
    console.error("reserve_board_pin_attempt", reserve.error);
    return { ok: false, status: 500, body: { error: "internal error" } };
  }
  const r = Array.isArray(reserve.data) ? reserve.data[0] : reserve.data;
  if (!r?.allowed) {
    if (r?.locked_until && new Date(r.locked_until) > new Date()) {
      return { ok: false, status: 423, body: { error: "locked", until: lockUntilMinute(r.locked_until) } };
    }
    return { ok: false, status: 401, body: { error: "invalid" } };
  }

  const { data: cred, error } = await svc
    .from("board_credentials").select("pin_hash").eq("email", email).maybeSingle();
  if (error) {
    console.error("board cred lookup", error);
    return { ok: false, status: 500, body: { error: "internal error" } };
  }
  if (!(await verifyPin(pin, cred?.pin_hash ?? null))) {
    if (r.locked_until && new Date(r.locked_until) > new Date()) {
      return { ok: false, status: 423, body: { error: "locked", until: lockUntilMinute(r.locked_until) } };
    }
    return { ok: false, status: 401, body: { error: "invalid", remaining: Math.max(0, MAX_FAILS - (r.fail_count ?? MAX_FAILS)) } };
  }

  await svc.rpc("reset_board_pin_attempts", { p_email: email });
  return { ok: true };
}

// Seals are computed inside board_commit_signature / board_commit_sai_signoff
// so the signed rows and their hashes are committed atomically.
