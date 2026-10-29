import { json, preflight, escapeHtml, siteOrigin } from "../_shared/http.ts";
import { getCaller, serviceClient } from "../_shared/supabase.ts";
import { ballEmailShell } from "../_shared/ballEmail.ts";
import { BALL_NOTIFY_BCC } from "../_shared/ballNotify.ts";

import { reservationChangeMessages } from "../_shared/ballReservationNotice.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  try {
    const caller = await getCaller(req);
    if (!caller || caller.role !== "s6" || caller.mustChangePassword) return json({ error: "S-6 required" }, 403);
    const svc = serviceClient();
    const body = await req.json();
    if (body.mode === "prepare") {
      const newGuest=body.action==='add_guest';
      const adding = body.action === "add_date";
      const restoring = body.action === "restore_date";
      const { data, error } = await svc.rpc(newGuest ? "prepare_ball_guest_addition" : restoring ? "prepare_ball_date_restoration" : adding ? "prepare_ball_date_addition" : "prepare_ball_reservation_change", {
        ...(newGuest ? {p_guest:body.guest} : restoring ? {p_removal:body.removal_id} : adding ? {p_source_signup:body.source_signup_id,p_confirm_payment_merge:body.confirm_payment_merge === true} : {p_action:body.action,p_host_payment:body.host_payment ?? null}),
        p_admin: caller.email, p_signup: body.signup_id,
      });
      return error ? json({ error: error.message }, 400) : json({ proposal: data });
    }
    const { data: change, error: lookupError } = await svc.from("ball_reservation_changes")
      .select("*").eq("id", body.change_id).eq("admin_email", caller.email).maybeSingle();
    if (lookupError || !change) return json({ error: "Change not found" }, 404);
    if (body.mode === "cancel") {
      const { data:cancelled,error } = await svc.from("ball_reservation_changes").update({ status: "cancelled" }).eq("id", change.id).eq("status", "pending").select("id").maybeSingle();
      if(!error&&!cancelled)return json({error:"This proposal is no longer pending. Refresh its status before cancelling."},409);
      return error ? json({ error: error.message }, 400) : json({ ok: true });
    }
    if (body.mode !== "apply") return json({ error: "Invalid mode" }, 400);
    // Only the explicit UI action invokes this endpoint. The model has no
    // execution tool. Retry uses the same proposal and provider idempotency keys.
    if (!Deno.env.get("RESEND_API_KEY")) return json({ error: "Email is not configured. No change was applied." }, 503);
    if(change.action==='add_guest'&&!siteOrigin())return json({error:'Guest invitation origin is not configured. No change was applied.'},503);
    const { data: result, error } = await svc.rpc(change.action === 'add_guest' ? 'apply_ball_guest_addition' : change.action === "restore_date" ? "apply_ball_date_restoration" : change.action === "add_date" ? "apply_ball_date_addition" : "apply_ball_reservation_change", { p_admin: caller.email, p_change: change.id });
    if (error) return json({ error: error.message }, 409);
    const emailState = { ...change.email_state };
    const messages = reservationChangeMessages(result);
    for (const message of messages) {
      if (emailState[message.key]?.sent) continue;
      const lines = message.lines;
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json", "Idempotency-Key": `ball-change/${change.id}/${message.key}` },
          body: JSON.stringify({ from: Deno.env.get("FROM_EMAIL") ?? "Trojan Battalion <onboarding@resend.dev>",
            to: [message.email], bcc: BALL_NOTIFY_BCC, subject: "Military Ball reservation and balance update",
            text: `${message.name},\n\n${lines.join("\n\n")}`,
            html: ballEmailShell({ heading: "Reservation Update", introHtml: `<p>${escapeHtml(message.name)},</p>${lines.map(line => `<p>${escapeHtml(line)}</p>`).join("")}` }),
          }),
        });
        const payload = await response.json().catch(() => ({}));
        emailState[message.key] = response.ok ? { sent: true, provider_id: payload.id } : { sent: false, error: "Email provider rejected the notification" };
      } catch {
        emailState[message.key] = { sent: false, error: "Email delivery request failed" };
      }
      // Persist each recipient immediately, so a retry doesn't resend successes.
      const { error: saveError } = await svc.from("ball_reservation_changes").update({ email_state: emailState }).eq("id", change.id);
      if (saveError) return json({ result, emails: emailState, error: "Reservation updated; notification status could not be saved. Retry this same change." }, 500);
    }
    if(change.action==='add_guest'&&!emailState.date?.sent){
      try{
        const response=await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ball-resend-guest-invite`,{
          method:'POST',headers:{Authorization:req.headers.get('Authorization')!,apikey:Deno.env.get('SUPABASE_ANON_KEY')!,'Content-Type':'application/json'},
          body:JSON.stringify({signup_id:change.signup_id,change_id:change.id}),
        });
        const sent=await response.json().catch(()=>({}));
        emailState.date=response.ok&&sent.ok?{sent:true,provider_id:sent.provider_id}:{sent:false,error:sent.error||'Guest invitation was not accepted. Retry this same change.'};
      }catch{emailState.date={sent:false,error:'Guest invitation request failed. Retry this same change.'};}
      const saved=await svc.from('ball_reservation_changes').update({email_state:emailState}).eq('id',change.id);
      if(saved.error)return json({result,emails:emailState,error:'Reservation updated; invitation status could not be saved. Retry this same change.'},500);
    }
    return json({ result, emails: emailState, notified: messages.every(m => emailState[m.key]?.sent)&&(change.action!=='add_guest'||emailState.date?.sent===true) });
  } catch (error) {
    console.error("ball-reservation-change", error);
    return json({ error: "Could not process reservation change" }, 500);
  }
});
