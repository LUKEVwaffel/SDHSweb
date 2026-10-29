import {
  PDFDocument,
  type PDFFont,
  rgb,
  StandardFonts,
} from "https://esm.sh/pdf-lib@1.17.1";
import * as fontkit from "https://esm.sh/@pdf-lib/fontkit@1.1.1";
import { FONT_BASE64 } from "./font.ts";
import { guestVerificationSlip } from "./guestVerificationSlip.js";
import { type PdfArtifact, type PdfPlan, wrapText } from "./render.ts";
export type GuestSlipData = {
  companyLabel: string;
  cadetName: string;
  guestName: string;
  letLevel?: string;
  sentTo: string;
};

// Recreates the established Ball email-correction slip as actual PDF pages.
// Black ink, the company banner, serif headings and handwritten correction box
// intentionally match src/lib/ballGuestVerifyPdf.js, rather than the report layout.
export async function renderGuestVerificationSlips(
  plan: PdfPlan,
): Promise<PdfArtifact> {
  const slips = plan.guest_verification_slips;
  if (!slips?.length || slips.length > 200) {
    throw new Error("Select 1 to 200 unverified guest slips");
  }
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
  }).format(new Date(generatedAt));
  doc.setTitle(plan.title);
  doc.setAuthor("Trojan Battalion JROTC");
  doc.setCreationDate(new Date(generatedAt));
  for (const [index, data] of slips.entries()) {
    const s = guestVerificationSlip(data);
    const page = doc.addPage([612, 792]);
    const x = 43.2, w = 525.6;
    let y = 748.8;
    const choose = (text: string, font: PDFFont) => {
      try {
        font.encodeText(text);
        return font;
      } catch {
        const chars = new Set(unicode.getCharacterSet());
        if ([...text].some((c) => !chars.has(c.codePointAt(0)!))) {
          throw new Error(
            "An unverified guest slip contains a name or address unsupported by the font. No incomplete packet was generated.",
          );
        }
        return unicode;
      }
    };
    const draw = (
      text: string,
      left: number,
      top: number,
      size: number,
      font = sans,
    ) => {
      const selected = choose(text, font);
      page.drawText(text, {
        x: left,
        y: top - size,
        font: selected,
        size,
        color: black,
      });
    };
    const wrapped = (
      text: string,
      size: number,
      font: PDFFont,
      width: number,
    ) => wrapText(text, choose(text, font), size, width);
    const centered = (text: string, top: number, size: number, font = sans) => {
      const selected = choose(text, font);
      draw(
        text,
        x + (w - selected.widthOfTextAtSize(text, size)) / 2,
        top,
        size,
        selected,
      );
    };
    const box = (
      top: number,
      height: number,
      width = w,
      left = x,
      borderWidth = 1.5,
    ) =>
      page.drawRectangle({
        x: left,
        y: top - height,
        width,
        height,
        borderWidth,
        borderColor: black,
      });
    const rule = (top: number, left = x, width = w, thickness = 1) =>
      page.drawLine({
        start: { x: left, y: top },
        end: { x: left + width, y: top },
        color: black,
        thickness,
      });
    const companyLines = wrapped(s.companyLabel, 24, serif, w - 24);
    const bannerHeight = 30 + companyLines.length * 27;
    box(y, bannerHeight, w, x, 2.25);
    centered("COMPANY", y - 8, 8);
    companyLines.forEach((t, i) => centered(t, y - 22 - i * 27, 24, serif));
    y -= bannerHeight + 13;
    draw(s.organization.toUpperCase(), x, y, 9);
    y -= 17;
    draw(s.title, x, y, 20, serif);
    y -= 32;
    rule(y, x, w, 3);
    y -= 10;
    draw(`Generated ${date}`, x, y, 8, mono);
    const rtWidth = mono.widthOfTextAtSize(s.returnTo, 8);
    draw(s.returnTo, x + w - rtWidth, y, 8, mono);
    y -= 19;
    rule(y);
    y -= 13;
    const commander = wrapped(s.commanderInstruction, 10.5, sans, w - 24),
      commanderHeight = 31 + commander.length * 15;
    box(y, commanderHeight);
    draw(s.commanderLabel.toUpperCase(), x + 12, y - 10, 8);
    commander.forEach((t, i) => draw(t, x + 12, y - 26 - i * 15, 10.5));
    y -= commanderHeight + 14;
    const cadet = wrapped(s.cadetInstruction, 10, sans, w - 24),
      cadetHeight = 24 + cadet.length * 14;
    page.drawLine({
      start: { x: x + 2, y },
      end: { x: x + 2, y: y - cadetHeight },
      thickness: 3.75,
      color: black,
    });
    draw(s.cadetLabel.toUpperCase(), x + 14, y - 2, 8);
    cadet.forEach((t, i) => draw(t, x + 14, y - 19 - i * 14, 10));
    y -= cadetHeight + 14;
    const field = (label: string, text: string, size = 15, font = serif) => {
      draw(label.toUpperCase(), x, y, 8);
      y -= 14;
      for (const t of wrapped(text, size, font, w)) {
        draw(t, x, y, size, font);
        y -= size + 3;
      }
      y -= 11;
    };
    field(
      "Cadet",
      `${s.cadetName}${s.letLevel ? `  (LET ${s.letLevel})` : ""}`,
    );
    field("Guest", s.guestName);
    field(s.emailLabel, s.sentTo, 12, mono);
    const correctionLines = wrapped(
        s.correction.toUpperCase(),
        8,
        sans,
        w - 24,
      ),
      correctionHeight = 75 + (correctionLines.length - 1) * 11;
    // Preserve a useful writing area and a full page per cadet; fail instead of clipping.
    if (y - correctionHeight - 57 < 43.2) {
      throw new Error(
        "A guest slip contains unusually long details that will not fit one page. Generate a smaller, customized document for that reservation.",
      );
    }
    box(y, correctionHeight);
    correctionLines.forEach((t, i) => draw(t, x + 12, y - 11 - i * 11, 8));
    const writingTop = y - 29 - (correctionLines.length - 1) * 11;
    rule(writingTop - 18, x + 12, w - 24, 1.1);
    draw(s.correctedBy, x + 12, writingTop - 27, 7.5, mono);
    draw(s.date, x + w - 65, writingTop - 27, 7.5, mono);
    y -= correctionHeight + 14;
    box(y, 35);
    centered(s.footer, y - 11, 9.5);
    draw(`${index + 1} / ${slips.length}`, x + w - 35, 31, 7, mono);
  }
  const pdf = await doc.save();
  if (pdf.length > 4_000_000) {
    throw new Error("Guest packet exceeds 4 MB; filter by company");
  }
  let binary = "";
  for (let i = 0; i < pdf.length; i += 8192) {
    binary += String.fromCharCode(...pdf.subarray(i, i + 8192));
  }
  return {
    id: crypto.randomUUID(),
    title: plan.title,
    filename: "unverified-guest-forms.pdf",
    mime_type: "application/pdf",
    base64: btoa(binary),
    page_count: slips.length,
    record_count: slips.length,
    byte_size: pdf.length,
    generated_at: generatedAt,
    source: plan.source,
  };
}
