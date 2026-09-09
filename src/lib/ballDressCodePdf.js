// Printable / "Save as PDF" version of the Military Ball dress code — same
// window.open + document.write + print() pattern as eventsPdfPrint.js /
// consentPdfPrint.js. No PDF library; the browser is the PDF engine.
//
// Built for one job: something a parent/cadet can keep open on their phone
// (or on paper) while they are in a dress shop or a suit shop. White paper,
// navy/gold letterhead, every rule spelled out. Content comes from the same
// ballDressCode.js / ballApprovers.js the on-screen <DressCodeDetails /> uses,
// so the two can never drift.
//
// only: 'female' | 'male' | undefined
//   undefined -> both sections (default)
//   'female'  -> women's section + women's approvers only
//   'male'    -> men's section + Weston only
import {
  FEMALE_AVOID, FEMALE_WEAR, MALE_AVOID, MALE_WEAR, DRESS_APPROVAL_RULES,
} from './ballDressCode';
import { DRESS_APPROVERS, WESTON } from './ballApprovers';

const NAVY = '#142847';
const GOLD = '#C9A961';

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function list(items) {
  return `<ul>${items.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>`;
}

function genderBlock(heading, wear, avoid) {
  return `
  <section class="blk">
    <h2>${escapeHtml(heading)}</h2>
    <div class="cols">
      <div class="col wear">
        <h3>WEAR</h3>
        ${list(wear)}
      </div>
      <div class="col avoid">
        <h3>DO NOT WEAR</h3>
        ${list(avoid)}
      </div>
    </div>
  </section>`;
}

const DOC_STYLE = `
  @page { size: letter; margin: 0.6in; }
  * { box-sizing: border-box; }
  html, body { background: #fff; color: #141414; margin: 0; }
  body { font-family: 'Inter', Arial, sans-serif; line-height: 1.5; }
  .sheet { max-width: 7.4in; margin: 0 auto; }

  .note-bar {
    background: #fff8e6; border: 1px solid ${GOLD}; color: #5c4a1e;
    padding: 12px 16px; margin-bottom: 18px; font-size: 12px; line-height: 1.5;
  }
  .note-bar b { color: ${NAVY}; }
  .note-bar button {
    margin-top: 8px; background: ${NAVY}; color: #fff; border: none;
    padding: 9px 18px; font-size: 12px; letter-spacing: 0.06em; cursor: pointer;
  }

  .head { border-bottom: 3px solid ${GOLD}; background: ${NAVY}; color: #F4ECD8; padding: 20px 24px; }
  .head .org { font-family: Arial, Helvetica, sans-serif; font-size: 10px; letter-spacing: 3px; text-transform: uppercase; opacity: 0.85; }
  .head .title { font-family: Georgia, 'Times New Roman', serif; font-weight: 700; font-size: 22px; letter-spacing: 0.02em; margin-top: 4px; }
  .meta-row { display: flex; justify-content: space-between; font-family: 'Courier New', monospace; font-size: 9.5px; color: #666; padding: 9px 24px; border-bottom: 1px solid #ddd; }

  .intro { padding: 16px 24px 4px; font-size: 12.5px; color: #333; }
  .intro strong { color: ${NAVY}; }

  .blk { padding: 8px 24px 4px; page-break-inside: avoid; }
  .blk h2 { font-family: Georgia, serif; font-size: 15px; color: ${NAVY}; letter-spacing: 0.1em; margin: 16px 0 8px; padding-bottom: 4px; border-bottom: 1.5px solid ${NAVY}; }
  .cols { display: flex; gap: 22px; }
  .col { flex: 1; min-width: 0; }
  .col h3 { font-family: 'Courier New', monospace; font-size: 10px; letter-spacing: 0.14em; margin: 4px 0 6px; }
  .col.wear h3 { color: #2e6b3e; }
  .col.avoid h3 { color: #a12b1e; }
  .col ul { margin: 0; padding-left: 18px; }
  .col li { font-size: 11.5px; color: #222; margin-bottom: 4px; line-height: 1.4; }

  .approval { margin: 14px 24px 4px; border: 1px solid ${GOLD}; background: #faf7ef; padding: 14px 16px; page-break-inside: avoid; }
  .approval h3 { font-family: 'Courier New', monospace; font-size: 10px; letter-spacing: 0.14em; color: ${NAVY}; margin: 0 0 8px; }
  .approval ul { margin: 0 0 10px; padding-left: 18px; }
  .approval li { font-size: 11.5px; color: #222; margin-bottom: 4px; }
  .contacts { font-family: 'Courier New', monospace; font-size: 12px; color: #141414; line-height: 1.9; }
  .contacts .who { color: #666; }

  .extra-note { margin: 14px 24px 0; font-size: 11.5px; color: #444; white-space: pre-line; border-left: 3px solid ${GOLD}; padding-left: 12px; }

  .foot { text-align: center; padding: 18px 16px 4px; font-family: 'Courier New', monospace; font-size: 8.5px; color: #aaa; }

  @media print { .no-print { display: none !important; } }
`;

function documentHtml({ bodyHtml, generatedOn, scopeLabel, siteUrl }) {
  return `<!doctype html><html><head><meta charset="utf-8">
<title>Military Ball Dress Code</title>
<style>${DOC_STYLE}</style>
</head>
<body>
  <div class="sheet">
    <div class="note-bar no-print">
      <b>Keep this with you while you shop.</b> This opens your device's print screen &mdash;
      choose <b>Save as PDF</b> (on iPhone: Share &rarr; <b>Save to Files</b>) to keep it on your phone,
      or print it on paper. Every line is a rule, not a suggestion.
      <br /><button type="button" onclick="window.print()">Save as PDF / Print</button>
    </div>

    <div class="head">
      <div class="org">Trojan Battalion JROTC</div>
      <div class="title">Military Ball &mdash; Dress Code${scopeLabel ? ' &middot; ' + escapeHtml(scopeLabel) : ''}</div>
    </div>
    <div class="meta-row"><span>Generated ${escapeHtml(generatedOn)}</span><span>Full form &amp; approval: ${escapeHtml(siteUrl)}</span></div>

    <div class="intro">
      Formal event. Bring this list shopping. If you are unsure about an item, <strong>ask before you buy</strong> &mdash;
      an unapproved outfit means being turned away at the door, even if you already paid.
    </div>

    ${bodyHtml}

    <div class="foot">Trojan Battalion &middot; Soddy Daisy High School AJROTC &nbsp;|&nbsp; the live dress code and the approval form are at ${escapeHtml(siteUrl)}</div>
  </div>
</body></html>`;
}

export function openBallDressCodePdf({ only, note } = {}) {
  const showFemale = only !== 'male';
  const showMale = only !== 'female';

  const win = window.open('', '_blank');
  if (!win) { alert('Allow pop-ups for this site, then tap the button again to save the dress code.'); return; }

  const parts = [];
  if (showFemale) parts.push(genderBlock('WOMEN', FEMALE_WEAR, FEMALE_AVOID));
  if (showMale) parts.push(genderBlock('MEN', MALE_WEAR, MALE_AVOID));

  // Approval box. Women always carry the approval rules + their approvers.
  // Men get a short "questions" line pointing at Weston.
  if (showFemale) {
    parts.push(`
    <div class="approval">
      <h3>DRESS APPROVAL &mdash; REQUIRED FOR EVERY FEMALE ATTENDEE</h3>
      ${list(DRESS_APPROVAL_RULES)}
      <div class="contacts">
        ${DRESS_APPROVERS.map((a) => `<div>${escapeHtml(a.name)} &mdash; ${escapeHtml(a.phone)} <span class="who">(dresses)</span></div>`).join('')}
        ${showMale ? `<div>${escapeHtml(WESTON.name)} &mdash; ${escapeHtml(WESTON.phone)} <span class="who">(suits / Class A)</span></div>` : ''}
      </div>
    </div>`);
  } else if (showMale) {
    parts.push(`
    <div class="approval">
      <h3>QUESTIONS ABOUT A SUIT OR CLASS A</h3>
      <div class="contacts"><div>${escapeHtml(WESTON.name)} &mdash; ${escapeHtml(WESTON.phone)}</div></div>
      <ul><li>Turn in your field trip form when you pay for your tickets.</li></ul>
    </div>`);
  }

  if (note && String(note).trim()) {
    parts.push(`<div class="extra-note">${escapeHtml(String(note).trim())}</div>`);
  }

  const scopeLabel = showFemale && showMale ? '' : showFemale ? 'Women' : 'Men';
  const html = documentHtml({
    bodyHtml: parts.join(''),
    generatedOn: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    scopeLabel,
    siteUrl: `${window.location.origin}/ball`,
  });

  win.document.write(html);
  win.document.close();
  win.focus();
  // Give the new document a beat to lay out before the print dialog opens.
  setTimeout(() => { try { win.print(); } catch { /* user can still use the button */ } }, 400);
}
