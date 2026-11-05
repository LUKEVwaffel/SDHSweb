import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

import { normalizeVipRole, VIP_ROLES } from './ballVipRoles.js';
export { normalizeVipRole } from './ballVipRoles.js';

export function vipIdentityError(
  name: string,
  role: string,
  homeSchool: string,
): string | null {
  if (!name) return "Your full name is required.";
  if (!VIP_ROLES.includes(role)) {
    return "Select visiting JROTC leadership or past Ball King / Queen.";
  }
  if (!homeSchool) return "Your school / JROTC unit is required.";
  return null;
}
export async function insertVipSignup(
  svc: SupabaseClient,
  values: Record<string, unknown>,
) {
  const row = { ...values, role: normalizeVipRole(values.role) };
  const result = await svc.from("ball_vip_signups").insert(row).select("id")
    .single();
  // Support the already-live legacy CHECK without requiring an emergency SQL
  // change. PostgreSQL rejected this insert, so the retry cannot duplicate it.
  // Do not retry other constraints, network failures, or successful inserts.
  if (
    row.role === "visiting_leadership" && result.error?.code === "23514" &&
    result.error.message.includes("ball_vip_signups_role_check")
  ) {
    return svc.from("ball_vip_signups").insert({
      ...row,
      role: "visiting_xo_bc",
    }).select("id").single();
  }
  return result;
}
