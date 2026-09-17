// Printable "Guest Not Verified" slip for one Ball signup — same window.open +
// document.write + print() pattern as consentPdfPrint.js / eventsPdfPrint.js.
// Goes to the cadet's company so they can chase the guest down in person.
// Carries the email the invite was actually sent to, plus a blank line staff
// can use to write down the corrected email if the cadet says it was wrong.
const NAVY = '#142847';
const GOLD = '#C9A961';

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const DOC_STYLE = `
  @page { size: letter; margin: 0.6in; }
  * { box-sizing: border-box; }
  html, body { background: #ffffff; color: #111111; margin: 0; }
  body { font-family: 'Inter', Arial, sans-serif; }
  .sheet { max-width: 7.4in; margin: 0 auto; }
  .head { border-bottom: 3px solid ${GOLD}; background: ${NAVY}; color: #F4ECD8; padding: 22px 26px; }
  .head .org { font-family: Arial, Helvetica, sans-serif; font-size: 10px; letter-spacing: 3px; text-transform: uppercase; opacity: 0.85; }
  .head .title { font-family: Georgia, 'Times New Roman', serif; font-weight: 700; font-size: 23px; letter-spacing: 0.02em; margin-top: 4px; }
  .head .company { font-family: 'Courier New', monospace; font-size: 12px; letter-spacing: 0.08em; margin-top: 8px; color: ${GOLD}; }
  .meta-row { display: flex; justify-content: space-between; font-family: 'Courier New', monospace; font-size: 9.5px; color: #666; padding: 9px 26px; border-bottom: 1px solid #ddd; }
  .body { padding: 20px 26px 4px; }
  .field { margin-bottom: 16px; }
  .field .k { font-family: 'Courier New', monospace; font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: #888; margin-bottom: 3px; }
  .field .v { font-family: Georgia, 'Times New Roman', serif; font-size: 18px; color: ${NAVY}; }
  .field .v.email { font-family: 'Courier New', monospace; font-size: 15px; word-break: break-all; }
  .notice { font-family: Inter, Arial, sans-serif; font-size: 10.5px; line-height: 1.55; color: #444; background: #f7f5ef; border-left: 3px solid ${GOLD}; padding: 12px 16px; margin: 10px 0 20px; }
  .correction { border: 1.5px dashed #bbb; border-radius: 6px; padding: 14px 16px 18px; margin-top: 4px; }
  .correction .k { font-family: 'Courier New', monospace; font-size: 9.5px; letter-spacing: 0.08em; text-transform: uppercase; color: #888; margin-bottom: 10px; }
  .correction .line { border-bottom: 1.5px solid #999; height: 30px; margin-bottom: 10px; }
  .correction .sub { font-family: 'Courier New', monospace; font-size: 8.5px; color: #999; display: flex; justify-content: space-between; }
  .foot { text-align: center; padding: 18px; font-family: 'Courier New', monospace; font-size: 8px; color: #aaa; }
  @media print { .no-print { display: none; } }
`;

function documentHtml({ companyLabel, generatedOn, cadetName, letLevel, guestName, sentTo }) {
  return `<!doctype html><html><head><meta charset="utf-8">
<title>Guest Not Verified — ${escapeHtml(cadetName)}</title>
<style>${DOC_STYLE}</style>
</head>
<body>
  <div class="sheet">
    <div class="head">
      <div class="org">Trojan Battalion JROTC · Military Ball</div>
      <div class="title">Guest Not Yet Verified</div>
      <div class="company">${escapeHtml(companyLabel)}</div>
    </div>
    <div class="meta-row"><span>Generated ${escapeHtml(generatedOn)}</span><span>Route to cadet's company</span></div>
    <div class="body">
      <div class="field">
        <div class="k">Cadet</div>
        <div class="v">${escapeHtml(cadetName)}${letLevel ? ` <span style="font-family:'Courier New',monospace;font-size:12px;color:#888;">LET ${escapeHtml(letLevel)}</span>` : ''}</div>
      </div>
      <div class="field">
        <div class="k">Guest</div>
        <div class="v">${escapeHtml(guestName)}</div>
      </div>
      <div class="field">
        <div class="k">Verification email sent to</div>
        <div class="v email">${escapeHtml(sentTo)}</div>
      </div>
      <div class="notice">
        This guest has not clicked their verification link yet. Have the cadet check with their guest that the
        email above is correct and check spam/junk. This sheet is not recorded in DISPATCH — it is only a runner
        to get the cadet's attention.
      </div>
      <div class="correction">
        <div class="k">If the email above is wrong, write the correct one here:</div>
        <div class="line"></div>
        <div class="sub"><span>Corrected by (name)</span><span>Date</span></div>
      </div>
    </div>
    <div class="foot">Hand this back to S-6 / Ball staff so the corrected email can be re-sent in DISPATCH.</div>
  </div>
</body></html>`;
}

// r: a row from ball_signups. guest: its matching ball_guests row (must exist —
// caller only shows the print button when a guest has been invited but has no
// verified_at yet).
export function openBallGuestVerifyPdf(r, guest) {
  const win = window.open('', '_blank');
  if (!win) { alert('Popup blocked, allow popups to print.'); return; }

  const html = documentHtml({
    companyLabel: (r.cadet_company || 'No company on file').toUpperCase(),
    generatedOn: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    cadetName: r.cadet_name || '—',
    letLevel: r.cadet_let_level,
    guestName: guest?.name || '—',
    sentTo: guest?.personal_email || 'no email on file',
  });

  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 350);
}
