import {
  PDFDocument,
  type PDFFont,
  rgb,
  StandardFonts,
} from "https://esm.sh/pdf-lib@1.17.1";
import * as fontkit from "https://esm.sh/@pdf-lib/fontkit@1.1.1";
import { FONT_BASE64 } from "./font.ts";
import { guestFormRequired, hostFormRequired, reservationStatus, type Row } from "../ballIntelligence.ts";
import { type PdfArtifact, type PdfPlan, wrapText } from "./render.ts";
import { isBallLabelEligible,isBallGuestSchoolUnknown } from "../ballTicketEligibility.js";
export function buildBallReceipt(host: Row, guest?: Row) {
  const status = reservationStatus(host, guest);
  const standardUniform = String(host.cadet_gender || "").trim().toLowerCase() === "male" &&
    host.standalone_guest !== true;
  const hostDressRequired = !standardUniform || host.door_attire_denied === true;
  const hostNeedsForm = hostFormRequired(host);
  const guestNeedsForm = guestFormRequired(guest);
  const hostForm = !hostNeedsForm
    ? "Not required"
    : host.field_trip_form_received === true
    ? "Received"
    : host.standalone_guest === true && host.field_trip_form_required !== true
    ? "REQUIREMENT UNKNOWN"
    : "OUTSTANDING";
  const guestForm = !guest
    ? "No guest"
    : !guestNeedsForm
    ? "Not required"
    : guest.field_trip_form_received === true
    ? "Received"
    : guest.field_trip_form_required === true || guest.is_sdhs_jrotc === true || /\bsoddy[\s-]*daisy\b|\bsdhs\b/i.test(String(guest.school_attended || ""))
    ? "OUTSTANDING"
    : "REQUIREMENT UNKNOWN";
  const formSatisfied = (status: string) => status === "Received" || status === "Not required" || status === "No guest";
  const cashDone = status.payment.balance === 0 &&
    status.payment.paid != null &&
    (!status.friend_payment ||
      status.friend_payment.balance === 0 &&
        status.friend_payment.paid != null);
  const verified = host.status === "fully_verified" &&
    (!guest || !!guest.verified_at);
  const add = (a: number | null, b: number | null) =>
    a == null || b == null ? null : Math.round((a + b) * 100) / 100;
  const total = add(
    status.payment.total,
    status.friend_payment?.total ?? (guest?.guest_type === "friend" ? null : 0),
  );
  const paid = add(
    status.payment.paid,
    status.friend_payment?.paid ?? (guest?.guest_type === "friend" ? null : 0),
  );
  const balance = add(
    status.payment.balance,
    status.friend_payment?.balance ??
      (guest?.guest_type === "friend" ? null : 0),
  );
  const credit = add(
    status.payment.credit,
    status.friend_payment?.credit ??
      (guest?.guest_type === "friend" ? null : 0),
  );
  const complete = isBallLabelEligible(host, guest);
  const guestVerificationPending = guest ? !guest.verified_at : host.status === "guest_pending";
  return {
    id: String(host.id),
    name: String(host.cadet_name || "Not on file"),
    company: String(host.cadet_company || "No company on file").toUpperCase(),
    let_level: String(host.cadet_let_level || "").replace(/^LET\s*/i, ""),
    guest: guest ? String(guest.name || "Not on file") : null,
    guest_type: guest ? String(guest.guest_type || "guest") : null,
    requirements: [
      ...(isBallGuestSchoolUnknown(guest)?[{label:"Guest school status",checked:false,detail:"Confirm whether the guest currently attends SDHS before ticket delivery. SDHS students need their own signed permission form."}]:[]),
      {
        label: "Cadet field-trip form",
        checked: formSatisfied(hostForm),
        detail: hostForm,
      },
      ...(guest
        ? [{
          label: "Guest field-trip form",
          checked: formSatisfied(guestForm),
          detail: guestForm,
        }]
        : []),
      {
        label: "Cash / payment received in full",
        checked: cashDone,
        detail: cashDone
          ? "All ticket charges are recorded as paid."
          : "See the recorded payments and outstanding balance below.",
      },
      {
        label: "Cadet dress / attire",
        checked: !hostDressRequired || host.dress_approved === true,
        detail: hostDressRequired
          ? (host.dress_approved === true ? "Approved" : host.dress_approved === false ? "NOT APPROVED - contact staff before attending." : "Approval not recorded. Aubry or Kylie can review attire on site.")
          : "Approval not required (standard uniform)",
      },
      ...(guest
        ? [{
          label: "Guest dress / attire",
          checked: guest.dress_approved === true,
          detail: guest.dress_approved === true ? "Approved" : guest.dress_approved === false ? "NOT APPROVED - contact staff before attending." : "Approval not recorded. Aubry or Kylie can review attire on site.",
        }]
        : []),
    ],
    verification_complete: verified,
    guest_verification_pending: guestVerificationPending,
    complete,
    paperwork_payment_complete: formSatisfied(hostForm) && formSatisfied(guestForm) && cashDone && verified && !isBallGuestSchoolUnknown(guest),
    total,
    paid,
    balance,
    credit,
    host_payment: status.payment,
    friend_payment: status.friend_payment,
    ticket_note: complete
      ? "Your tickets will be delivered to you in the coming weeks through your company commander."
      : "",
  };
}
export type BallReceipt = ReturnType<typeof buildBallReceipt>;
const dollars = (n: number | null) =>
  n == null ? "Unknown" : `$${n.toFixed(2)}`;
export async function renderBallReceipts(plan: PdfPlan): Promise<PdfArtifact> {
  const receipts = plan.ball_receipts;
  if (!receipts?.length || receipts.length > 1000) {
    throw new Error("Select 1 to 1,000 eligible Ball receipts; no partial packet was generated");
  }
  if (receipts.some(receipt => receipt.complete)) throw new Error("Complete Ticket Delivery reservations do not receive receipts.");
  const doc = await PDFDocument.create();
  doc.registerFontkit(
    (fontkit as unknown as { default: typeof fontkit }).default ?? fontkit,
  );
  const unicode = await doc.embedFont(
    Uint8Array.from(atob(FONT_BASE64), (c) => c.charCodeAt(0)),
    { subset: true },
  );
  const sans = await doc.embedFont(StandardFonts.HelveticaBold),
    serif = await doc.embedFont(StandardFonts.TimesRomanBold),
    mono = await doc.embedFont(StandardFonts.CourierBold);
  const black = rgb(0, 0, 0),
    generatedAt = plan.generated_at || new Date().toISOString();
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric", minute: "2-digit", second: "2-digit", timeZoneName: "short",
  }).format(new Date(generatedAt));
  doc.setTitle(plan.title);
  doc.setAuthor("Trojan Battalion JROTC");
  doc.setCreationDate(new Date(generatedAt));
  for (const [index, r] of receipts.entries()) {
    const page = doc.addPage([612, 792]), x = 43.2, w = 525.6;
    let y = 748.8;
    const choose = (text: string, font: PDFFont) => {
      try {
        font.encodeText(text);
        return font;
      } catch {
        const chars = new Set(unicode.getCharacterSet());
        if ([...text].some((c) => !chars.has(c.codePointAt(0)!))) {
          throw new Error(
            "A receipt contains unsupported characters; no incomplete packet was generated.",
          );
        }
        return unicode;
      }
    };
    const draw = (
      text: string,
      left: number,
      top: number,
      size = 10,
      font = sans,
    ) =>
      page.drawText(text, {
        x: left,
        y: top - size,
        font: choose(text, font),
        size,
        color: black,
      });
    const lines = (text: string, size: number, font: PDFFont, width = w) =>
      wrapText(text, choose(text, font), size, width);
    const center = (text: string, top: number, size: number, font = sans) =>
      draw(
        text,
        x + (w - choose(text, font).widthOfTextAtSize(text, size)) / 2,
        top,
        size,
        font,
      );
    const rule = (top: number, thickness = 1) =>
      page.drawLine({
        start: { x, y: top },
        end: { x: x + w, y: top },
        color: black,
        thickness,
      });
    const box = (top: number, height: number, thickness = 1.5) =>
      page.drawRectangle({
        x,
        y: top - height,
        width: w,
        height,
        borderColor: black,
        borderWidth: thickness,
      });
    const company = lines(r.company, 24, serif, w - 24),
      banner = 30 + company.length * 27;
    box(y, banner, 2.25);
    center("COMPANY", y - 8, 8);
    company.forEach((t, i) => center(t, y - 22 - i * 27, 24, serif));
    y -= banner + 14;
    draw("TROJAN BATTALION JROTC · MILITARY BALL", x, y, 9);
    y -= 18;
    draw("Reservation Receipt", x, y, 22, serif);
    y -= 33;
    rule(y, 3);
    y -= 11;
    draw(`Generated ${date}`, x, y, 8, mono);
    y -= 16;
    draw(
      `Reservation ${r.id.slice(0, 8).toUpperCase()}  /  ${
        r.complete ? "REQUIREMENTS COMPLETE" : r.paperwork_payment_complete ? "PAID / FORMS RECEIVED - ATTIRE REVIEW REMAINS" : "ACTION STILL REQUIRED"
      }`,
      x,
      y,
      8,
      mono,
    );
    y -= 23;
    for (
      const t of lines(
        `${r.name}${r.let_level ? `  (LET ${r.let_level})` : ""}`,
        17,
        serif,
      )
    ) {
      draw(t, x, y, 17, serif);
      y -= 21;
    }
    for (
      const t of lines(
        r.guest
          ? `Guest: ${r.guest} (${r.guest_type})`
          : r.guest_verification_pending ? "Guest verification pending - guest details not on file" : "Solo reservation - no guest",
        10,
        sans,
      )
    ) {
      draw(t, x, y, 10);
      y -= 14;
    }
    y -= 14;
    if (r.guest_verification_pending) {
      const warning = lines("The guest has NOT completed verification. Ask them to complete their emailed invitation. Check inbox and spam; contact S-6 if the invitation needs to be resent.", 9, sans, w - 24);
      const height = 32 + warning.length * 12;
      box(y, height, 2);
      draw("GUEST NOT VERIFIED - ACTION REQUIRED", x + 12, y - 8, 11);
      warning.forEach((line, index) => draw(line, x + 12, y - 27 - index * 12, 9));
      y -= height + 14;
    }
    draw("ATTENDANCE REQUIREMENTS", x, y, 9);
    y -= 20;
    for (const requirement of r.requirements) {
      page.drawRectangle({
        x,
        y: y - 11,
        width: 11,
        height: 11,
        borderColor: black,
        borderWidth: 1,
      });
      if (requirement.checked) {
        page.drawLine({
          start: { x: x + 2, y: y - 6 },
          end: { x: x + 5, y: y - 9 },
          color: black,
          thickness: 1.7,
        });
        page.drawLine({
          start: { x: x + 5, y: y - 9 },
          end: { x: x + 10, y: y - 2 },
          color: black,
          thickness: 1.7,
        });
      }
      draw(requirement.label, x + 21, y, 11);
      y -= 17;
      for (const t of lines(requirement.detail, 9, sans, w - 21)) {
        draw(t, x + 21, y, 9);
        y -= 12;
      }
      y -= 9;
    }
    if (!r.verification_complete && !r.guest_verification_pending) {
      draw("Reservation / guest verification is still outstanding.", x, y, 9);
      y -= 19;
    }
    rule(y, 1.5);
    y -= 15;
    draw("RESERVATION TOTAL & RECORDED PAYMENT", x, y, 9);
    y -= 20;
    const amounts: [string, number | null][] = [["Ticket total", r.total], [
      "Payment recorded",
      r.paid,
    ], ["Balance remaining", r.balance]];
    if (r.credit != null && r.credit > 0) {
      amounts.push(["Credit for staff review", r.credit]);
    }
    if (r.friend_payment) {
      draw(
        `Host ticket: ${
          dollars(r.host_payment.total)
        }  /  Separate friend ticket: ${dollars(r.friend_payment.total)}`,
        x,
        y,
        9,
      );
      y -= 18;
    }
    for (const [label, amount] of amounts) {
      draw(label, x, y, 11);
      const text = dollars(amount);
      draw(text, x + w - mono.widthOfTextAtSize(text, 11), y, 11, mono);
      y -= 20;
    }
    draw(
      "Payment recorded as of the date above. Keep this receipt for your records.",
      x,
      y,
      8,
    );
    y -= 22;
    if (r.credit != null && r.credit > 0) {
      draw(
        "Any credit requires staff review; this receipt does not confirm a refund.",
        x,
        y,
        8,
      );
      y -= 18;
    }
    if (y < 43.2) throw new Error("Receipt details do not fit a single page.");
    if (r.complete && r.ticket_note) {
      const noteLines = lines(r.ticket_note, 10, sans, w - 24);
      const noteHeight = 26 + noteLines.length * 14;
      if (y - noteHeight < 43.2) {
        throw new Error("Receipt details do not fit a single page.");
      }
      box(y, noteHeight);
      noteLines.forEach((t, i) => draw(t, x + 12, y - 12 - i * 14, 10));
    }
    draw(`${index + 1} / ${receipts.length}`, x + w - 35, 31, 7, mono);
  }
  const bytes = await doc.save();
  if (bytes.length > 4_000_000) {
    throw new Error("Receipt packet exceeds 4 MB; filter by company");
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return {
    id: crypto.randomUUID(),
    title: plan.title,
    filename: "military-ball-receipts.pdf",
    mime_type: "application/pdf",
    base64: btoa(binary),
    page_count: receipts.length,
    record_count: receipts.length,
    byte_size: bytes.length,
    generated_at: generatedAt,
    ball_snapshot_version: plan.ball_snapshot_version,
    receipt_filters: plan.receipt_filters,
    source: plan.source,
  };
}
