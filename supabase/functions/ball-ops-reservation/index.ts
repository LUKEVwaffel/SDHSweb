import { ballOpsTicketsFromSnapshot } from "../_shared/ballOpsTickets.ts";
import { ballOpsPayload } from "../_shared/ballOpsPayload.ts";
import { json, preflight, siteOrigin } from "../_shared/http.ts";
import { getReviewer, serviceClient } from "../_shared/supabase.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const reviewer = await getReviewer(req);
    if (!reviewer?.canBallOps || reviewer.mustChangePassword) {
      return json({ error: "Ball Ops access required" }, 403);
    }
    const body = await req.json();
    const svc = serviceClient();
    if (body.action === "tickets") {
      const { data, error } = await svc.rpc("ball_ops_ticket_status", {
        p_actor: reviewer.email,
      });
      if (error?.code === "PGRST202") {
        const snapshot = await svc.rpc("ball_ticket_snapshot", {
          p_policy_version: 2,
        });
        if (snapshot.error) throw snapshot.error;
        return json(ballOpsTicketsFromSnapshot(snapshot.data));
      }
      if (error) throw error;
      return json({ ...data, tracking_available: true });
    }
    if (body.action === "receive_tickets") {
      if (
        typeof body.signup_id !== "string" ||
        typeof body.expected_version !== "string"
      ) {
        return json({
          error: "Review a reservation before recording ticket receipt.",
        }, 400);
      }
      const { data, error } = await svc.rpc("ball_ops_receive_tickets", {
        p_actor: reviewer.email,
        p_signup: body.signup_id,
        p_expected_version: body.expected_version,
      });
      if (error?.code === "PGRST202") {
        return json({
          error:
            "Ticket recording needs the BALL_OPS_TICKETS SQL update. Existing reservation tools still work.",
        }, 503);
      }
      if (error) throw error;
      return json(data);
    }
    if (body.action === "pricing") {
      const { data: readiness, error: setupError } = await svc.rpc(
        "ball_ops_reservation",
        { p_actor: reviewer.email, p_action: "health", p_data: {} },
      );
      if (
        setupError?.code === "PGRST202" || (!setupError && !readiness?.ready)
      ) {
        return json({
          error:
            "The database update is not installed yet. S-6 must run BALL_OPS_RESERVATIONS.sql in Supabase before creating or changing reservations.",
        }, 503);
      }
      if (setupError) throw setupError;
      const { data, error } = await svc.from("ball_config").select(
        "price_cadet,price_couple",
      ).eq("id", true).single();
      if (error) throw error;
      return json(data);
    }
    if (body.action === "search") {
      const term = String(body.query || "").trim();
      if (term.length < 2) return json({ cadets: [] });
      const { data, error } = await svc.from("cadet_consent").select(
        "id,name,let_level,company",
      ).ilike("name", `%${term.replace(/[%_\\]/g, "")}%`).order("name").limit(
        20,
      );
      if (error) throw error;
      return json({ cadets: data });
    }
    if (
      !["create", "remove_guest", "complete_guest", "packet"].includes(
        body.action,
      )
    ) return json({ error: "Invalid action" }, 400);
    const { data, error } = await svc.rpc("ball_ops_reservation", {
      p_actor: reviewer.email,
      p_action: body.action,
      p_data: body,
    });
    if (error?.code === "PGRST202") {
      return json({
        error:
          "The database update is not installed yet. S-6 must run BALL_OPS_RESERVATIONS.sql in Supabase before creating or changing reservations.",
      }, 503);
    }
    if (error) throw error;
    return json({
      ...ballOpsPayload(data),
      config: { ...data.config, site_origin: siteOrigin() },
    });
  } catch (e) {
    return json({
      error: e instanceof Error
        ? e.message
        : (e as any)?.message || "Could not save reservation",
    }, 400);
  }
});
