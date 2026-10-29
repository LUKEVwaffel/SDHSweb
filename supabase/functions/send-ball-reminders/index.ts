import {getBallPaymentFacts,isBallHostFormRequired,isBallGuestFormRequired} from '../_shared/ballTicketEligibility.js';
// Edge function: send-ball-reminders
// S-6 ONLY, manual trigger — the "Send Reminders" button on the Ball
// Overview tab (BallOverviewTab.jsx). NOT automated, NOT on a schedule.
// Finds every fully_verified signup still missing cash and/or a field-trip
// form (host cash_received, a self_pays friend's own friend_cash_received, or
// field_trip_form_received) and emails that cadet a personalized "what's
// still needed" notice, reusing the same SDHSweb ball email shell +
// S-6-editable ball_email_templates row ('payment_reminder') as every other
// ball email. Also appends a fixed note about the dress-approval deadline
// (ball_config.dress_deadline) — informational for every recipient, not
// conditioned on that cadet's own dress status.
//
// Pass { dry_run: true } to get the candidate count without sending anything
// — used by the confirm step in the UI before the real blast.
//
// Deploy WITH jwt verification (default):
//   supabase functions deploy send-ball-reminders
import { json, preflight, escapeHtml, siteOrigin } from "../_shared/http.ts";
import { BALL_NOTIFY_BCC } from "../_shared/ballNotify.ts";
import { serviceClient, getCaller } from "../_shared/supabase.ts";
import { ballEmailShell } from "../_shared/ballEmail.ts";
import type { BallEmailParticular } from "../_shared/ballEmail.ts";
import { loadBallTemplate, isDisabled, pick, paras } from "../_shared/ballTemplate.ts";

function money(n: number | null): string | null {
  return n == null ? null : `$${Number(n).toFixed(Number.isInteger(Number(n)) ? 0 : 2)}`;
}

function fmtLongDate(d: string): string {
  return new Date(`${d}T00:00:00`).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

interface SignupRow {
  id: string;
  cadet_name: string;
  notification_email: string | null;
  amount_due: number | null;
  amount_paid: number | null;
  cash_received: boolean;
  field_trip_form_required: boolean;
  field_trip_form_received: boolean;
}

interface GuestRow {
  signup_id: string;
  name: string | null;
  guest_type: string | null;
  friend_payment_method: string | null;
  friend_amount_due: number | null;
  friend_cash_received: boolean | null;
  field_trip_form_required: boolean | null;
  field_trip_form_received: boolean | null;
}

function fieldTripAttachment(url: string | null): Array<{ filename: string; path: string }> {
  return url ? [{ filename: "field-trip-permission-form.pdf", path: url }] : [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const caller = await getCaller(req);
    if (!caller || caller.role !== "s6" || caller.mustChangePassword) {
      return json({ error: "not authorized" }, 403);
    }

    const { dry_run } = await req.json().catch(() => ({}));

    const svc = serviceClient();
    const [{data:snapshot,error:snapshotError},{data:cfg}]=await Promise.all([
      svc.rpc('ball_ticket_snapshot',{p_policy_version:2}),
      svc.from('ball_config').select('payment_deadline,dress_deadline,field_trip_form_pdf_url').maybeSingle(),
    ]);
    if(snapshotError||!snapshot?.version)return json({error:'Could not verify the live Ball ledger. No reminders were sent.'},503);
    const contactById=new Map();
    for(let offset=0;;offset+=500){
      const {data:contacts,error}=await svc.from('ball_signups').select('id,notification_email').order('id').range(offset,offset+499);
      if(error)return json({error:'Could not verify notification contacts. No reminders were sent.'},503);
      for(const contact of contacts||[])contactById.set(contact.id,contact.notification_email);
      if(!contacts||contacts.length<500)break;
    }
    const signups=snapshot.hosts.filter((row:{status:string})=>row.status==='fully_verified').map((row:{id:string})=>({...row,notification_email:contactById.get(row.id)}));
    const guests=snapshot.guests;
    const guestBySignup = new Map<string, GuestRow>();
    (guests || []).forEach((g: GuestRow) => guestBySignup.set(g.signup_id, g));

    const deadlinePretty = cfg?.payment_deadline ? fmtLongDate(cfg.payment_deadline) : null;
    const dressDeadlinePretty = cfg?.dress_deadline ? fmtLongDate(cfg.dress_deadline) : null;

    type Candidate = { row: SignupRow; guest: GuestRow | undefined; todo: string[]; needsForm: boolean };
    const candidates: Candidate[] = [];
    for (const row of (signups || []) as SignupRow[]) {
      if (!row.notification_email) continue;
      const guest = guestBySignup.get(row.id);
      const todo: string[] = [];
      let needsForm = false;
      const payment=getBallPaymentFacts(row,guest);
      if (payment.hostBalance!==0) {
        const amt = money(payment.hostBalance);
        todo.push(amt ? `Render payment of <strong>${amt}</strong> in full, by cash or check, to <strong>Kaz and Chief ONLY</strong>.` : "Render payment <strong>in full</strong>, by cash or check, to <strong>Kaz and Chief ONLY</strong>.");
      }
      if (isBallHostFormRequired(row) && row.field_trip_form_received!==true) {
        const attachedNote = cfg?.field_trip_form_pdf_url ? ", attached to this email" : "";
        todo.push(`Submit your <strong>signed field trip permission form</strong> (physical signature only${attachedNote}) to <strong>Kaz and Chief ONLY</strong>.`);
        needsForm = true;
      }
      if (guest?.guest_type === "friend" && payment.friendBalance!==0) {
        const fa = money(payment.friendBalance);
        todo.push(`Your friend <strong>${escapeHtml(guest.name || "")}</strong> still owes${fa ? ` <strong>${fa}</strong>` : ""} of their own, which they pay or deliver themselves to <strong>Kaz and Chief ONLY</strong>.`);
      }
      // Guest's own field-trip form need is tracked on the guest row itself
      // (whether THEY are an SDHS student), independent of the host's own
      // field_trip_form_required — see ball_guest_form_required_split.sql.
      if (isBallGuestFormRequired(guest) && guest?.field_trip_form_received!==true) {
        const attachedNote = cfg?.field_trip_form_pdf_url ? " (attached to this email)" : "";
        todo.push(`<strong>${escapeHtml(guest?.name || "Your guest")}</strong>'s own field trip permission form is also still needed${attachedNote} — hand it to <strong>Kaz and Chief ONLY</strong>.`);
        needsForm = true;
      }
      if (todo.length) candidates.push({ row, guest, todo, needsForm });
    }

    if (dry_run) return json({ ok: true, dry_run: true, candidates: candidates.length });
    if (!candidates.length) return json({ ok: true, sent: 0, failed: 0, total: 0 });

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM = Deno.env.get("FROM_EMAIL") ?? "Trojan Battalion <onboarding@resend.dev>";
    if (!RESEND_API_KEY) return json({ error: "RESEND_API_KEY not configured" }, 500);

    const t = await loadBallTemplate(svc, "payment_reminder");
    if (isDisabled(t)) return json({ ok: true, sent: 0, failed: 0, total: candidates.length, skipped: true });

    const dressNote = dressDeadlinePretty
      ? `Separately: any cadet or guest whose dress has not yet been approved will receive an email on <strong>${escapeHtml(dressDeadlinePretty)}</strong> about their unapproved status.`
      : "";

    let sent = 0, failed = 0;
    for (const { row, todo, needsForm } of candidates) {
      const live=await svc.rpc('ball_ticket_snapshot',{p_policy_version:2});
      if(live.error||live.data?.version!==snapshot.version)return json({ok:false,sent,failed,total:candidates.length,error:'The Ball ledger changed. Remaining reminders were stopped; refresh and review before trying again.'},409);
      const formAttach = needsForm ? fieldTripAttachment(cfg?.field_trip_form_pdf_url ?? null) : [];
      const vars: Record<string, string> = {
        cadet_name: escapeHtml(row.cadet_name),
        what: todo.map((li) => li.replace(/<[^>]+>/g, "")).join("; "),
        deadline: deadlinePretty ?? "",
        dress_note: dressNote,
      };
      const noticeRendered = pick(
        t, "notice_html",
        deadlinePretty ? "Please turn this in by <strong>{{deadline}}</strong>." : "",
        vars,
      );
      const closingRendered = paras(pick(t, "closing_html", "{{dress_note}}", vars));
      const particulars: BallEmailParticular[] = deadlinePretty
        ? [{ label: "Deadline", value: escapeHtml(deadlinePretty) }]
        : [];

      const html = ballEmailShell({
        preheader: "A few things are still needed for your Military Ball registration.",
        heading: pick(t, "heading", "A Few Things Still Needed", vars),
        introHtml: paras(pick(t, "intro_html", "{{cadet_name}},\n\nYour Military Ball registration is still missing the following:", vars)),
        particulars,
        listTitle: "Still Outstanding",
        listItems: todo,
        noticeHtml: noticeRendered || undefined,
        closingHtml: closingRendered || undefined,
        siteUrl: siteOrigin() ? `${siteOrigin()}/ball` : undefined,
      });

      const text = `${row.cadet_name},

Your Military Ball registration is still missing:
${todo.map((li) => `- ${li.replace(/<[^>]+>/g, "")}`).join("\n")}
${deadlinePretty ? `\nPlease turn this in by ${deadlinePretty}.` : ""}
${dressDeadlinePretty ? `\nSeparately: any cadet or guest whose dress has not yet been approved will receive an email on ${dressDeadlinePretty} about their unapproved status.` : ""}`;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM,
          bcc: BALL_NOTIFY_BCC,
          to: [row.notification_email],
          subject: pick(t, "subject", "Military Ball: payment / form reminder", vars),
          html,
          ...(formAttach.length ? { attachments: formAttach } : {}),
          text,
        }),
      });
      if (res.ok) sent += 1; else failed += 1;
    }

    return json({ ok: true, sent, failed, total: candidates.length });
  } catch (e) {
    console.error("send-ball-reminders", e);
    return json({ error: "internal error" }, 500);
  }
});
