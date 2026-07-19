// Opens a print-ready document for a message and triggers the browser print
// dialog (→ "Save as PDF" or send straight to a printer). The printed sheet
// carries a wet-signature block for the SAI / 1SG. No external PDF dependency —
// the real-world need is a physical printout to sign, which print() serves best.
function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function printEmailMessage(message) {
  const dateStr = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  const bodyHtml = escapeHtml(message.body).replace(/\n/g, '<br>');
  const win = window.open('', '_blank', 'width=800,height=1000');
  if (!win) { alert('Popup blocked — allow popups to print the message.'); return; }

  win.document.write(`<!doctype html><html><head><meta charset="utf-8">
<title>${escapeHtml(message.subject)}</title>
<style>
  @page { margin: 1in; }
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #111; line-height: 1.5; margin: 0; }
  .hd { border-bottom: 3px double #142847; padding-bottom: 12px; margin-bottom: 24px; }
  .unit { font-family: Arial, sans-serif; font-size: 11px; letter-spacing: 3px; color: #C9A961; text-transform: uppercase; }
  .org { font-size: 20px; font-weight: bold; color: #142847; margin-top: 2px; }
  .meta { font-family: Arial, sans-serif; font-size: 11px; color: #555; margin-top: 6px; }
  h1 { font-size: 18px; color: #142847; margin: 0 0 16px; }
  .body { font-size: 13px; white-space: normal; }
  .sig { margin-top: 64px; border-top: 1px solid #999; padding-top: 12px; }
  .sig-row { display: flex; gap: 48px; margin-top: 40px; }
  .sig-line { flex: 1; border-top: 1px solid #111; padding-top: 4px; font-family: Arial, sans-serif; font-size: 10px; color: #555; letter-spacing: 1px; }
  .note { font-family: Arial, sans-serif; font-size: 10px; color: #777; margin-top: 8px; }
</style></head><body>
  <div class="hd">
    <div class="unit">Trojan Battalion · S-6 · Net Control</div>
    <div class="org">Communications Release Authorization</div>
    <div class="meta">Generated ${escapeHtml(dateStr)} · Status: PENDING SIGNATURE</div>
  </div>
  <h1>${escapeHtml(message.subject)}</h1>
  <div class="body">${bodyHtml}</div>
  <div class="sig">
    <div class="note">This message may not be transmitted until physically signed below and marked "signed" in DISPATCH. File the signed copy in the S-6 drawer.</div>
    <div class="sig-row">
      <div class="sig-line">SAI / 1SG SIGNATURE</div>
      <div class="sig-line">DATE</div>
    </div>
  </div>
</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}
