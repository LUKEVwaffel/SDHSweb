import { json, preflight } from "../_shared/http.ts";
import { getCaller, serviceClient } from "../_shared/supabase.ts";
import { checkinTag, newCheckinPin } from "../_shared/checkinPin.ts";

Deno.serve(async req => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const caller = await getCaller(req);
    if (!caller || caller.role !== "s6" || caller.mustChangePassword) return json({ error: "S-6 access required." }, 403);
    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const name = String(body.name ?? "").trim();
    if (!name || name.length > 120 || email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.endsWith("@ball-checkin.invalid")) {
      return json({ error: "Enter a staff name and valid email address." }, 400);
    }

    const svc = serviceClient();
    const { data: existing, error: lookupError } = await svc.from("ball_checkin_pin_credentials")
      .select("auth_email").eq("staff_email", email).maybeSingle();
    if (lookupError) return json({ error: "Could not read check-in credentials." }, 503);

    const authEmail = existing?.auth_email ?? `checkin-${crypto.randomUUID()}@ball-checkin.invalid`;
    let createdId: string | undefined;
    if (!existing) {
      const { data, error } = await svc.auth.admin.createUser({
        email: authEmail, email_confirm: true, password: crypto.randomUUID() + crypto.randomUUID(),
        app_metadata: { ball_checkin_operator: email, ball_checkin_name: name },
      });
      if (error || !data.user) return json({ error: "Could not create the desk-only login." }, 503);
      createdId = data.user.id;
    }

    for (let attempt = 0; attempt < 8; attempt++) {
      const pin = newCheckinPin();
      const { data: expires_at, error } = await svc.rpc("ball_issue_checkin_pin", {
        p_staff: email, p_name: name, p_auth_email: authEmail, p_tag: await checkinTag("pin", pin),
      });
      if (!error) return json({ pin, expires_at });
      if (error.code !== "23505") break;
    }
    // Only delete an account created for this request after confirming that
    // no credential points at it. An ambiguous network failure may have committed.
    if (createdId) {
      const { data, error } = await svc.from("ball_checkin_pin_credentials").select("auth_email").eq("auth_email", authEmail).maybeSingle();
      if (!error && !data) await svc.auth.admin.deleteUser(createdId);
    }
    return json({ error: "Could not save the PIN. Try again." }, 503);
  } catch {
    return json({ error: "Could not issue a check-in PIN." }, 503);
  }
});
