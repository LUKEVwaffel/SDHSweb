import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
export async function completeBallGuestVerification(
  svc: SupabaseClient,
  token: string,
  values: { phone: string; allergies: string | null },
) {
  const lookup = () =>
    svc.from("ball_guests").select("id, signup_id, verified_at, name").eq(
      "verification_token",
      token,
    ).maybeSingle();
  let { data: guest, error } = await lookup();
  if (error) throw error;
  if (!guest) {
    throw new Error(
      "Invitation not found. It may have been removed or replaced.",
    );
  }
  let alreadyVerified = !!guest.verified_at;
  if (!alreadyVerified) {
    const now = new Date().toISOString();
    const saved = await svc.from("ball_guests").update({
      allergies: values.allergies,
      guest_phone: values.phone,
      dress_code_accepted_at: now,
      verified_at: now,
    }).eq("id", guest.id).is("verified_at", null).select(
      "id, signup_id, verified_at, name",
    ).maybeSingle();
    if (saved.error) throw saved.error;
    if (saved.data) guest = saved.data;
    else {
      const latest = await lookup();
      if (latest.error) throw latest.error;
      if (!latest.data?.verified_at) {
        throw new Error(
          "This invitation changed. Refresh before trying again.",
        );
      }
      guest = latest.data;
      alreadyVerified = true;
    }
  }
  // Always reconcile the parent. A previous request may have saved the guest
  // but lost the connection before updating the reservation. Returning early
  // for verified_at used to leave those reservations stuck forever.
  const signup = await svc.from("ball_signups").update({
    status: "fully_verified",
  }).eq("id", guest.signup_id).select("cadet_name, notification_email")
    .single();
  if (signup.error) throw signup.error;
  if (!signup.data) {
    throw new Error("The reservation could not be confirmed. Please retry.");
  }
  return { guest, signup: signup.data, alreadyVerified };
}
