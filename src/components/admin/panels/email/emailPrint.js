// Opens a print-ready document for a message and triggers the browser print
// dialog (→ "Save as PDF" or a printer). The sheet carries a wet-signature block
// for the SAI / 1SG / Sgt Kaz.
//
// PRINT PHILOSOPHY: this is a physical document that goes to the SAI/1SG for a
// wet signature and is then filed in the S-6 drawer. It must look like an
// official letter, NOT a printed webpage: white paper, black text, minimal ink,
// an OUTLINE letterhead (no filled navy block). The on-screen branded email is
// deliberately NOT reused — we render the message's plaintext content as a clean
// letter so nothing wastes toner or reads as a website screenshot.
function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Valid signatories for communications release. Printed on the signature line so
// whoever signs is a recognized authority. Keep in sync with SIGNERS in Messages.
const SIGNERS_LABEL = 'SAI · 1SG · SGT KAZ';

function officialLetter(message, dateStr) {
  const bodyText = message.body || message.subject || '';
  const bodyHtml = escapeHtml(bodyText).replace(/\n/g, '<br>');
  return `<!doctype html><html><head><meta charset="utf-8">
<title>${escapeHtml(message.subject)}</title>
<style>
  @page { margin: 1in; }
  html, body { background: #ffffff; color: #111111; }
  body { font-family: Georgia, 'Times New Roman', serif; line-height: 1.5; margin: 0; }
  .sheet { max-width: 6.5in; margin: 0 auto; }
  .letterhead { border-bottom: 1.5px solid #111; padding-bottom: 10px; margin-bottom: 6px; }
  .lh-org { font-family: Arial, Helvetica, sans-serif; font-size: 11px; letter-spacing: 2.5px; text-transform: uppercase; color: #111; }
  .lh-title { font-family: Arial, Helvetica, sans-serif; font-size: 15px; font-weight: bold; color: #111; margin-top: 3px; letter-spacing: 0.5px; }
  .meta { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #444; margin: 8px 0 22px; }
  h1.subject { font-size: 17px; color: #111; margin: 0 0 14px; }
  .body { font-size: 12.5px; color: #111; }
  .sig { margin-top: 40px; border-top: 1px solid #111; padding-top: 8px; }
  .sig-note { font-family: Arial, Helvetica, sans-serif; font-size: 9.5px; color: #555; margin-bottom: 26px; }
  .sig-lines { display: flex; gap: 40px; }
  .sig-line { flex: 1; border-top: 1px solid #111; padding-top: 4px; font-family: Arial, Helvetica, sans-serif; font-size: 9.5px; letter-spacing: 0.5px; color: #333; }
  @media print { .no-print { display: none; } }
</style>
</head>
<body>
  <div class="sheet">
    <div class="letterhead">
      <div class="lh-org">Trojan Battalion · S-6 · Net Control</div>
      <div class="lh-title">Communications Release Authorization</div>
    </div>
    <div class="meta">Generated ${escapeHtml(dateStr)}</div>
    <h1 class="subject">${escapeHtml(message.subject)}</h1>
    <div class="body">${bodyHtml}</div>
    <div class="sig">
      <div class="sig-note">Release authorized by wet signature below. File the signed copy in the S-6 drawer.</div>
      <div class="sig-lines">
        <div class="sig-line">AUTHORIZED SIGNATURE (${SIGNERS_LABEL})</div>
        <div class="sig-line">DATE</div>
      </div>
    </div>
  </div>
</body></html>`;
}

export function printEmailMessage(message) {
  const dateStr = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  const win = window.open('', '_blank', 'width=800,height=1000');
  if (!win) { alert('Popup blocked — allow popups to print the message.'); return; }

  win.document.write(officialLetter(message, dateStr));
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 350);
}
