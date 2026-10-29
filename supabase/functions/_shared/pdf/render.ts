import {
  PDFDocument,
  type PDFFont,
  type PDFPage,
  rgb,
} from "https://esm.sh/pdf-lib@1.17.1";
import * as fontkit from "https://esm.sh/@pdf-lib/fontkit@1.1.1";
import { FONT_BASE64 } from "./font.ts";

import {
  type GuestSlipData,
  renderGuestVerificationSlips,
} from "./guestVerification.ts";

import { type BallReceipt, renderBallReceipts } from "./ballReceipts.ts";

export type PdfSection = {
  heading?: string;
  text?: string;
  columns?: string[];
  rows?: string[][];
  widths?: number[];
  page_break?: boolean;
  checklist?: string[];
  writing_lines?: number;
  writing_label?: string;
};
export type PdfPlan = {
  title: string;
  subtitle?: string;
  source: string;
  sections: PdfSection[];
  orientation?: "portrait" | "landscape";
  record_count?: number;
  generated_at?: string;
  guest_verification_slips?: GuestSlipData[];
  ball_receipts?: BallReceipt[];
  ball_snapshot_version?: string;
  receipt_filters?: Record<string, unknown>;
};
export type PdfArtifact = {
  ball_snapshot_version?: string;
  receipt_filters?: Record<string, unknown>;
  id: string;
  title: string;
  filename: string;
  mime_type: "application/pdf";
  base64: string;
  page_count: number;
  record_count?: number;
  byte_size: number;
  generated_at: string;
  source: string;
};
const ink = rgb(.07, .09, .12),
  mute = rgb(.30, .32, .35),
  line = rgb(.72, .73, .75),
  wash = rgb(.96, .96, .96);
const clean = (s: unknown) =>
  String(s ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\t/g, "    ");
const safeName = (s: string) =>
  s.normalize("NFKD").replace(/[^a-zA-Z0-9 -]/g, "").trim().replace(/\s+/g, "-")
    .toLowerCase().slice(0, 85) || "dispatch-document";
export function wrapText(
  value: string,
  font: PDFFont,
  size: number,
  width: number,
): string[] {
  if (width < 12) throw new Error("Column is too narrow");
  const lines: string[] = [];
  for (const paragraph of clean(value).split("\n")) {
    if (!paragraph) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of paragraph.split(/\s+/)) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) {
        current = candidate;
        continue;
      }
      if (current) {
        lines.push(current);
        current = "";
      }
      for (const char of word) {
        if (font.widthOfTextAtSize(current + char, size) > width && current) {
          lines.push(current);
          current = "";
        }
        current += char;
      }
    }
    lines.push(current);
  }
  return lines;
}
export async function renderPdf(plan: PdfPlan): Promise<PdfArtifact> {
  if (!plan.title?.trim() || plan.title.length > 180) {
    throw new Error("PDF title must be 1 to 180 characters");
  }
  if (plan.ball_receipts) return renderBallReceipts(plan);
  if (plan.guest_verification_slips) return renderGuestVerificationSlips(plan);
  if (!plan.sections?.length || plan.sections.length > 600) {
    throw new Error("PDF needs 1 to 600 sections");
  }
  const totalText = JSON.stringify(plan);
  if (totalText.length > 1_500_000) {
    throw new Error("Document is too large; narrow the selection");
  }
  const doc = await PDFDocument.create();
  doc.registerFontkit(
    (fontkit as unknown as { default: typeof fontkit }).default ?? fontkit,
  );
  const bytes = Uint8Array.from(atob(FONT_BASE64), (c) => c.charCodeAt(0));
  const font = await doc.embedFont(bytes, { subset: true });
  // Fail explicitly rather than silently replacing a person's name with missing-glyph boxes.
  const supported = new Set(font.getCharacterSet());
  for (const char of clean(totalText)) {
    if (!supported.has(char.codePointAt(0)!) && !["\n", "\r"].includes(char)) {
      throw new Error(
        `The PDF font does not support ${
          JSON.stringify(char)
        }. Use plain text for decorative symbols; do not change people's names.`,
      );
    }
  }
  const date = plan.generated_at || new Date().toISOString();
  const generated = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
  doc.setTitle(plan.title);
  doc.setAuthor("Trojan Battalion · Dispatch");
  doc.setCreator("Dispatch document generator");
  doc.setCreationDate(new Date(date));
  const [w, h] = plan.orientation === "landscape" ? [792, 612] : [612, 792];
  const margin = 42, bottom = 55, usable = w - margin * 2;
  let page!: PDFPage;
  let y = 0, bodyTop = 0;
  const draw = (text: string, x: number, top: number, size = 10, color = ink) =>
    page.drawText(clean(text), { x, y: top - size, font, size, color });
  const rule = (top: number, color = line) =>
    page.drawLine({
      start: { x: margin, y: top },
      end: { x: w - margin, y: top },
      thickness: .65,
      color,
    });
  const newPage = () => {
    if (doc.getPageCount() >= 250) {
      throw new Error("PDF exceeds 250 pages; narrow the selection");
    }
    page = doc.addPage([w, h]);
    draw("TROJAN BATTALION  /  DISPATCH", margin, h - 30, 8, mute);
    const titleLines = wrapText(plan.title, font, 20, usable);
    let top = h - 52;
    for (const text of titleLines) {
      draw(text, margin, top, 20);
      top -= 25;
    }
    if (plan.subtitle) {
      for (const text of wrapText(plan.subtitle, font, 10, usable)) {
        draw(text, margin, top - 4, 10, mute);
        top -= 14;
      }
    }
    rule(top - 12, ink);
    y = top - 28;
    bodyTop = y;
    if (y < bottom + 100) throw new Error("Document heading is too long");
  };
  const ensure = (height: number) => {
    if (y - height < bottom) newPage();
  };
  const paragraph = (value: string, size = 10.5) => {
    for (const text of wrapText(value, font, size, usable)) {
      ensure(size * 1.5);
      draw(text, margin, y, size);
      y -= size * 1.5;
    }
    y -= 8;
  };
  newPage();
  for (const section of plan.sections) {
    if (section.page_break && y < bodyTop - .1) newPage();
    if (section.heading) {
      ensure(60);
      for (const text of wrapText(section.heading, font, 13, usable)) {
        draw(text, margin, y, 13);
        y -= 18;
      }
      y -= 6;
    }
    if (section.text) paragraph(section.text);
    if (section.columns?.length) {
      const cols = section.columns;
      if (cols.length > 8 || cols.length < 1) {
        throw new Error("Use 1 to 8 table columns");
      }
      const weights = section.widths || cols.map(() => 1);
      if (
        weights.length !== cols.length ||
        weights.some((n) => !Number.isFinite(n) || n <= 0)
      ) throw new Error("Invalid column widths");
      const sum = weights.reduce((a, b) => a + b, 0),
        widths = weights.map((n) => n / sum * usable);
      const size = cols.length > 5 ? 8.5 : 9.5,
        padding = 7,
        leading = size * 1.4;
      const linesFor = (row: string[]) =>
        row.map((cell, i) =>
          wrapText(cell, font, size, widths[i] - padding * 2)
        );
      const headers = linesFor(cols),
        headerHeight = Math.max(...headers.map((l) => l.length)) * leading +
          padding * 2;
      if (headerHeight > 100) throw new Error("Table headings are too long");
      const drawCells = (
        cells: string[][],
        height: number,
        background: boolean,
      ) => {
        if (background) {
          page.drawRectangle({
            x: margin,
            y: y - height,
            width: usable,
            height,
            color: wash,
          });
        }
        let x = margin;
        cells.forEach((lines, i) => {
          lines.forEach((t, j) =>
            draw(t, x + padding, y - padding - j * leading, size)
          );
          x += widths[i];
        });
        rule(y - height);
        y -= height;
      };
      ensure(headerHeight + 35);
      drawCells(headers, headerHeight, true);
      let tableTop = y;
      let rowNumber = 0;
      for (const row of section.rows || []) {
        if (!Array.isArray(row) || row.length !== cols.length) {
          throw new Error("Each table row must match the columns");
        }
        const cells = linesFor(row),
          maxLines = Math.max(1, ...cells.map((c) => c.length));
        let offset = 0;
        while (offset < maxLines) {
          if (y - bottom < padding * 2 + leading) {
            newPage();
            drawCells(headers, headerHeight, true);
            tableTop = y;
          }
          const fit = Math.floor((y - bottom - padding * 2) / leading),
            remaining = maxLines - offset;
          // Keep normal rows together; split exceptionally tall cells over continued table pages.
          if (offset === 0 && remaining > fit && y < tableTop - .1) {
            newPage();
            drawCells(headers, headerHeight, true);
            tableTop = y;
            continue;
          }
          const count = Math.min(
            remaining,
            Math.max(1, Math.floor((y - bottom - padding * 2) / leading)),
          );
          drawCells(
            cells.map((c) => c.slice(offset, offset + count)),
            count * leading + padding * 2,
            rowNumber % 2 === 1,
          );
          offset += count;
          if (offset < maxLines) {
            newPage();
            drawCells(headers, headerHeight, true);
            tableTop = y;
          }
        }
        rowNumber++;
      }
      y -= 18;
    }
    if (section.checklist) {
      for (const item of section.checklist) {
        const lines = wrapText(item, font, 10, usable - 22);
        for (let i = 0; i < lines.length; i++) {
          ensure(16);
          if (i === 0) {
            page.drawRectangle({
              x: margin,
              y: y - 11,
              width: 9,
              height: 9,
              borderColor: ink,
              borderWidth: .7,
            });
          }
          draw(lines[i], margin + 20, y, 10);
          y -= 16;
        }
        y -= 5;
      }
    }
    if (section.writing_lines) {
      paragraph(
        section.writing_label || "Notes / corrections / staff follow-up",
        9,
      );
      if (section.writing_lines > 20) {
        throw new Error("Too many writing lines in one section");
      }
      for (let i = 0; i < section.writing_lines; i++) {
        ensure(28);
        y -= 26;
        rule(y);
      }
    }
  }
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    page = p;
    rule(43);
    draw(`Generated ${generated} ET`, margin, 34, 8, mute);
    const number = `${i + 1} / ${pages.length}`;
    draw(number, w - margin - font.widthOfTextAtSize(number, 8), 34, 8, mute);
  });
  const pdf = await doc.save();
  if (pdf.length > 4_000_000) {
    throw new Error(
      "PDF exceeds the 4 MB chat attachment limit; narrow the selection",
    );
  }
  let binary = "";
  for (let i = 0; i < pdf.length; i += 8192) {
    binary += String.fromCharCode(...pdf.subarray(i, i + 8192));
  }
  return {
    id: crypto.randomUUID(),
    title: plan.title,
    filename: `${safeName(plan.title)}.pdf`,
    mime_type: "application/pdf",
    base64: btoa(binary),
    page_count: pages.length,
    record_count: plan.record_count,
    byte_size: pdf.length,
    generated_at: date,
    source: plan.source,
  };
}
