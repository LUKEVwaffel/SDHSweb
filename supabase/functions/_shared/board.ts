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

/** Hex SHA-256 of a string. */
export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Stable JSON (sorted keys) so a seal can be recomputed and compared later. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/** The fields a board signature attests to. */
export const SEALED_FIELDS = [
  "id", "quarter_id", "cadet_id", "cadet_name", "company", "let_level", "grade", "rank_before",
  "score_facing", "score_creed", "score_uniform", "score_jrotc", "score_class", "total",
  "decision", "promote_to", "comment",
] as const;

export function sealPayload(sheet: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(SEALED_FIELDS.map((k) => [k, sheet[k] ?? null]));
}
