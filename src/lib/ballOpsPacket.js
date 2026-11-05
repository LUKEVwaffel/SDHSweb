import {
  FEMALE_AVOID,
  FEMALE_WEAR,
  MALE_AVOID,
  MALE_WEAR,
} from "./ballDressCode.js";
import { DRESS_APPROVERS, WESTON } from "./ballApprovers.js";
import {
  getBallPaymentFacts,
  isBallGuestFormRequired,
  isBallHostFormRequired,
} from "../../supabase/functions/_shared/ballTicketEligibility.js";
import { ballBalance } from "./ballBalance.js";
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]),
  );
const money = (v) =>
  v == null || !Number.isFinite(Number(v))
    ? "Unknown"
    : `$${Number(v).toFixed(2)}`;
function guestUrl(config, fallback, token) {
  if (!token) {
    throw new Error(
      "The guest invitation link is missing. Refresh before printing.",
    );
  }
  const url = new URL(config.site_origin || fallback);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  ) {
    throw new Error(
      "The public website address is missing. Configure the backend website origin before printing a guest invitation.",
    );
  }
  return `${url.origin}/ball/guest/${encodeURIComponent(token)}`;
}
export function ballOpsPacketHtml(
  { signup: s, guest: g, config: c = {} },
  origin,
) {
  const b = ballBalance(s);
  const payment = getBallPaymentFacts(s, g);
  const link = g && !g.verified_at
    ? guestUrl(c, origin, g.verification_token)
    : "";
  const page = (title, body) =>
    `<section><h1>Trojan Battalion Military Ball</h1><h2>${
      esc(title)
    }</h2>${body}</section>`;
  const instructions = (name, gender, form, received, isGuest) => {
    const female = gender === "female";
    const known = gender === "male" || female;
    const contacts = female ? DRESS_APPROVERS : known ? [WESTON] : [];
    return page(
      `Instructions · ${name}`,
      `<p>${esc(c.ball_date)} · ${esc(c.event_time_text)}<br>${
        esc(c.venue_address)
      }</p><p>Reservation: ${esc(s.cadet_name)}${
        g ? ` + ${esc(g.name)}` : ""
      }</p>
  <h3>Paperwork and next steps</h3><p>${
        form
          ? (received
            ? "Signed field trip form received."
            : "Return your physically signed field trip form to Chief.")
          : "No field trip form required."
      }</p>
  ${
        isGuest && !g.verified_at
          ? `<p>Confirm your attendance, food allergies, and dress-code acknowledgment:</p><p class="url">${
            esc(link)
          }</p><p>Give Chief any missing contact and school information. If you cannot complete this online, take this packet to Chief to complete your paperwork in person. Printing this packet does not complete registration.</p>`
          : ""
      }
  <h3>Dress code · ${
        esc(gender || "confirm with Chief")
      }</h3><h4>Wear</h4><ul>${
        (female
          ? FEMALE_WEAR
          : known
          ? MALE_WEAR
          : ["Confirm attire requirements with Chief before attending."]).map(
            (x) => `<li>${esc(x)}</li>`,
          ).join("")
      }</ul><h4>Avoid</h4><ul>${
        (female ? FEMALE_AVOID : known ? MALE_AVOID : []).map((x) =>
          `<li>${esc(x)}</li>`
        ).join("")
      }</ul>
  <p>${
        female
          ? "Dress approval is required before entry. Text photos of the front and back while wearing the dress."
          : known
          ? "Contact Weston for attire questions and male guest approval."
          : "Confirm the correct attire contact with Chief."
      }</p><p>${
        contacts.map((x) => `${esc(x.name)}: ${esc(x.phone)}`).join("<br>")
      }</p><p>Attendee signature: ________________________ Date: ______________</p>`,
    );
  };
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Ball packet · ${
    esc(s.cadet_name)
  }</title><style>@page{size:letter;margin:.6in}body{font:11px/1.4 Arial;color:#000}section{break-after:page}section:last-child{break-after:auto}h1{font: bold 24px Georgia;border-bottom:2px solid;padding-bottom:12px}h2{font-size:20px}h3{margin-top:20px}li{margin:3px 0}.url{overflow-wrap:anywhere;font-family:monospace}button{padding:12px}@media print{button{display:none}}</style></head><body><button onclick="window.print()">Print / Save as PDF</button>${
    page(
      "Payment receipt",
      `<p>Reservation: ${esc(s.cadet_name)}${
        g ? ` + ${esc(g.name)}` : ""
      }<br>Reference: ${esc(s.id)}<br>Printed: ${
        esc(
          new Date().toLocaleString("en-US", {
            timeZone: "America/New_York",
            timeZoneName: "short",
          }),
        )
      }</p><p>Host ticket total: ${
        money(payment.total)
      }<br>Host payment recorded: ${money(payment.paid)}<br>Host balance: ${
        money(payment.hostBalance)
      }<br>Credit for staff review: ${money(b.credit)}</p>${
        g?.guest_type === "friend"
          ? `<p>Friend ticket: ${
            money(g.friend_amount_due)
          }<br>Friend payment: ${
            g.friend_cash_received ||
              (g.friend_payment_method === "host_delivers" && s.cash_received)
              ? "Received"
              : "Not received"
          }</p>`
          : ""
      }<p>This receipt records payments currently on file. Credits require staff review; no refund is issued automatically. This is not an admission ticket.</p><p>Attendee signature: ________________________ Date: ______________</p>`,
    )
  }${
    instructions(
      s.cadet_name,
      s.cadet_gender,
      isBallHostFormRequired(s),
      s.field_trip_form_received,
      false,
    )
  }${
    g
      ? instructions(
        g.name,
        g.gender,
        isBallGuestFormRequired(g),
        g.field_trip_form_received,
        true,
      )
      : ""
  }</body></html>`;
}
export function openBallOpsPacket(packet, existingWindow) {
  const win = existingWindow || window.open("", "_blank");
  if (!win) throw new Error("Allow popups to print the reservation packet.");
  win.document.open();
  win.document.write(ballOpsPacketHtml(packet, window.location.origin));
  win.document.close();
  win.focus();
}
