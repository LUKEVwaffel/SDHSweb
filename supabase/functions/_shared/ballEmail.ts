// Formal HTML email shell for the Military Ball — an engraved-invitation look
// that still reads as SDHSweb (ink / navy / gold / cream). Table-based, fully
// inline styles, web-safe fonts only (Georgia for the display face, so it
// renders as intended everywhere instead of collapsing to bold Arial caps).
// Double-rule inset frame, centered letterhead with a TB monogram, centered
// particulars, left-aligned body copy.
//
// Callers pass already-escaped HTML fragments. This module never escapes.

const C = {
  page: "#050D18",
  frame: "#0A1728", // outer card
  card: "#122238", // inner panel (inside the inset rule)
  gold: "#C9A961",
  goldEdge: "#A9863F", // button border / deeper gold
  goldFilm: "#1C2A41", // faint gold-on-navy wash for callouts
  cream: "#F4ECD8",
  body: "#CBBEA4",
  faint: "#87805F",
  rule: "#33445F", // hairline on card
};

const SERIF = "Georgia, 'Times New Roman', 'Hoefler Text', serif";
const LABEL = "'Courier New', Courier, monospace";
const TEXT = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export interface BallEmailParticular {
  label: string;
  value: string; // pre-escaped
}

export interface BallEmailOptions {
  preheader?: string;
  heading: string; // pre-escaped
  introHtml: string; // one or more <p>…</p>, pre-escaped
  particulars?: BallEmailParticular[];
  listTitle?: string;
  listItems?: string[]; // pre-escaped HTML per item
  noticeHtml?: string; // highlighted callout line, pre-escaped
  closingHtml?: string; // trailing <p>…</p>, pre-escaped
  cta?: { label: string; url: string } | null;
  siteUrl?: string;
}

export function ballEmailShell(o: BallEmailOptions): string {
  const rows = (o.particulars ?? []);
  const particularsBlock = rows.length
    ? `
    <tr><td style="padding:26px 44px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="border-top:1px solid ${C.rule};padding-top:22px;">
          ${rows.map((p, i) => `
          <div style="text-align:center;${i ? "margin-top:16px;" : ""}">
            <div style="font-family:${LABEL};font-size:10px;letter-spacing:3px;color:${C.gold};text-transform:uppercase;">${p.label}</div>
            <div style="font-family:${SERIF};font-size:17px;line-height:1.4;color:${C.cream};margin-top:5px;">${p.value}</div>
          </div>`).join("")}
        </td></tr>
        <tr><td style="border-bottom:1px solid ${C.rule};padding-top:22px;font-size:0;line-height:0;">&nbsp;</td></tr>
      </table>
    </td></tr>`
    : "";

  const listBlock = (o.listItems && o.listItems.length)
    ? `
    <tr><td style="padding:28px 44px 0;">
      ${o.listTitle ? `<div style="font-family:${LABEL};font-size:10px;letter-spacing:3px;color:${C.gold};text-transform:uppercase;margin-bottom:12px;">${o.listTitle}</div>` : ""}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${o.listItems.map((li) => `
        <tr>
          <td width="18" valign="top" style="font-family:${SERIF};font-size:15px;color:${C.gold};padding:6px 0;">&#8226;</td>
          <td style="font-family:${TEXT};font-size:14px;line-height:1.65;color:${C.body};padding:6px 0;">${li}</td>
        </tr>`).join("")}
      </table>
    </td></tr>`
    : "";

  const noticeBlock = o.noticeHtml
    ? `
    <tr><td style="padding:26px 44px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="border:1px solid ${C.gold};background:${C.goldFilm};padding:13px 18px;font-family:${LABEL};font-size:12px;line-height:1.5;letter-spacing:0.5px;color:${C.cream};text-align:center;">${o.noticeHtml}</td></tr>
      </table>
    </td></tr>`
    : "";

  const ctaBlock = o.cta
    ? `
    <tr><td align="center" style="padding:32px 44px 4px;">
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr><td style="background:${C.gold};border:1px solid ${C.goldEdge};">
          <a href="${o.cta.url}" style="display:block;padding:15px 40px;font-family:${SERIF};font-size:14px;letter-spacing:3px;color:${C.page};text-decoration:none;text-transform:uppercase;">${o.cta.label}</a>
        </td></tr>
      </table>
    </td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="dark" />
</head>
<body style="margin:0;padding:0;background:${C.page};">
${o.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${o.preheader}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page};">
  <tr>
    <td align="center" style="padding:44px 16px;">

      <!-- outer frame → inset gold rule → inner card -->
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:${C.frame};">
        <tr><td style="padding:7px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.gold};background:${C.card};">

            <!-- letterhead -->
            <tr><td align="center" style="padding:40px 44px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td width="58" height="58" align="center" valign="middle" style="width:58px;height:58px;border:1px solid ${C.gold};font-family:${SERIF};font-size:20px;letter-spacing:2px;color:${C.gold};">TB</td>
              </tr></table>
              <div style="font-family:${LABEL};font-size:10px;letter-spacing:5px;color:${C.gold};text-transform:uppercase;margin-top:16px;">Trojan Battalion &middot; JROTC</div>
              <h1 style="margin:12px 0 0;font-family:${SERIF};font-weight:normal;font-size:30px;line-height:1.2;color:${C.cream};letter-spacing:0.5px;">${o.heading}</h1>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px auto 0;"><tr><td style="width:44px;height:2px;background:${C.gold};font-size:0;line-height:0;">&nbsp;</td></tr></table>
            </td></tr>

            <!-- intro -->
            <tr><td style="padding:24px 44px 0;font-family:${TEXT};font-size:14px;line-height:1.75;color:${C.body};">${o.introHtml}</td></tr>

            ${particularsBlock}
            ${listBlock}
            ${noticeBlock}
            ${ctaBlock}

            ${o.closingHtml ? `<tr><td style="padding:24px 44px 0;font-family:${TEXT};font-size:13px;line-height:1.7;color:${C.body};">${o.closingHtml}</td></tr>` : ""}

            <!-- footer -->
            <tr><td style="padding:34px 44px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid ${C.rule};padding-top:18px;text-align:center;">
                <div style="font-family:${LABEL};font-size:10px;letter-spacing:2px;color:${C.faint};text-transform:uppercase;">Trojan Battalion &middot; Soddy Daisy High School AJROTC</div>
                ${o.siteUrl ? `<div style="font-family:${LABEL};font-size:10px;letter-spacing:1px;color:${C.faint};margin-top:6px;">${o.siteUrl}</div>` : ""}
              </td></tr></table>
            </td></tr>

          </table>
        </td></tr>
      </table>

    </td>
  </tr>
</table>
</body>
</html>`;
}
