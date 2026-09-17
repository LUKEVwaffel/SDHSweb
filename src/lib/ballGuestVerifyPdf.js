// Printable "Guest Not Verified" slip for one Ball signup — same window.open +
// document.write + print() pattern as consentPdfPrint.js / eventsPdfPrint.js.
// Goes to the cadet's company so they can chase the guest down in person.
// Carries the email the invite was actually sent to, plus a blank line staff
// can use to write down the corrected email if the cadet says it was wrong.
//
// Printed on office B&W printers with no color/toner and often with
// "background graphics" OFF in the print dialog — so nothing here may rely on
// a colored background to carry contrast. Every line of text is solid black
// ink; hierarchy comes from size/weight/borders only, never from color alone.
function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const DOC_STYLE = `
  @page { size: letter; margin: 0.6in; }
  * { box-sizing: border-box; }
  html, body { background: #ffffff; color: #000000; margin: 0; }
  body { font-family: 'Inter', Arial, sans-serif; }
  .sheet { max-width: 7.4in; margin: 0 auto; }
  .company-banner { border: 3px solid #000000; padding: 10px 16px; text-align: center; margin-bottom: 14px; }
  .company-banner .lbl { font-family: Arial, Helvetica, sans-serif; font-weight: 700; font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #000000; }
  .company-banner .name { font-family: Georgia, 'Times New Roman', serif; font-weight: 700; font-size: 32px; letter-spacing: 0.02em; color: #000000; margin-top: 2px; }
  .head { border-bottom: 4px solid #000000; padding: 0 0 16px; }
  .head .org { font-family: Arial, Helvetica, sans-serif; font-weight: 700; font-size: 12px; letter-spacing: 3px; text-transform: uppercase; color: #000000; }
  .head .title { font-family: Georgia, 'Times New Roman', serif; font-weight: 700; font-size: 26px; letter-spacing: 0.01em; margin-top: 6px; color: #000000; }
  .meta-row { display: flex; justify-content: space-between; font-family: 'Courier New', monospace; font-weight: 700; font-size: 11px; color: #000000; padding: 10px 0; border-bottom: 1.5px solid #000000; }
  .directive { border: 2px solid #000000; padding: 14px 16px; margin: 16px 0; }
  .directive .k { font-family: Arial, Helvetica, sans-serif; font-weight: 700; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #000000; margin-bottom: 6px; }
  .directive .msg { font-family: Inter, Arial, sans-serif; font-weight: 600; font-size: 14px; line-height: 1.6; color: #000000; }
  .cadet-msg { border-left: 5px solid #000000; padding: 10px 16px; margin: 16px 0 22px; }
  .cadet-msg .k { font-family: Arial, Helvetica, sans-serif; font-weight: 700; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #000000; margin-bottom: 6px; }
  .cadet-msg .msg { font-family: Inter, Arial, sans-serif; font-weight: 600; font-size: 13.5px; line-height: 1.6; color: #000000; }
  .body { padding: 4px 0 4px; }
  .field { margin-bottom: 18px; }
  .field .k { font-family: Arial, Helvetica, sans-serif; font-weight: 700; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #000000; margin-bottom: 4px; }
  .field .v { font-family: Georgia, 'Times New Roman', serif; font-weight: 700; font-size: 20px; color: #000000; }
  .field .v.email { font-family: 'Courier New', monospace; font-size: 16px; word-break: break-all; }
  .field .v .let { font-family: 'Courier New', monospace; font-weight: 700; font-size: 13px; color: #000000; }
  .correction { border: 2px solid #000000; border-radius: 6px; padding: 14px 16px 18px; margin-top: 4px; }
  .correction .k { font-family: Arial, Helvetica, sans-serif; font-weight: 700; font-size: 11px; letter-spacing: 0.05em; text-transform: uppercase; color: #000000; margin-bottom: 12px; }
  .correction .line { border-bottom: 1.5px solid #000000; height: 32px; margin-bottom: 10px; }
  .correction .sub { font-family: 'Courier New', monospace; font-weight: 700; font-size: 10px; color: #000000; display: flex; justify-content: space-between; }
  .foot { text-align: center; padding: 18px 16px; font-family: Arial, Helvetica, sans-serif; font-weight: 700; font-size: 13px; color: #000000; border: 2px solid #000000; margin-top: 18px; }
  @media print {
    .no-print { display: none; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`;

function documentHtml({ companyLabel, generatedOn, cadetName, letLevel, guestName, sentTo }) {
  return `<!doctype html><html><head><meta charset="utf-8">
<title>Guest Not Verified — ${escapeHtml(cadetName)}</title>
<style>${DOC_STYLE}</style>
</head>
<body>
  <div class="sheet">
    <div class="company-banner">
      <div class="lbl">Company</div>
      <div class="name">${escapeHtml(companyLabel)}</div>
    </div>
    <div class="head">
      <div class="org">Trojan Battalion JROTC · Military Ball</div>
      <div class="title">Guest Not Yet Verified</div>
    </div>
    <div class="meta-row"><span>Generated ${escapeHtml(generatedOn)}</span><span>Return completed sheet to S-6</span></div>

    <div class="directive">
      <div class="k">To the company commander</div>
      <div class="msg">Deliver this paper directly to <b>${escapeHtml(cadetName)}</b> in <b>${escapeHtml(companyLabel)}</b> company.</div>
    </div>

    <div class="cadet-msg">
      <div class="k">To the cadet</div>
      <div class="msg">Your guest, <b>${escapeHtml(guestName)}</b>, has not verified yet. Please check with your guest that the email below is correct, and have them check their spam/junk folder for the verification email.</div>
    </div>

    <div class="body">
      <div class="field">
        <div class="k">Cadet</div>
        <div class="v">${escapeHtml(cadetName)}${letLevel ? ` <span class="let">LET ${escapeHtml(letLevel)}</span>` : ''}</div>
      </div>
      <div class="field">
        <div class="k">Guest</div>
        <div class="v">${escapeHtml(guestName)}</div>
      </div>
      <div class="field">
        <div class="k">Verification email sent to</div>
        <div class="v email">${escapeHtml(sentTo)}</div>
      </div>
      <div class="correction">
        <div class="k">If the email above is wrong, write the correct one here:</div>
        <div class="line"></div>
        <div class="sub"><span>Corrected by (name)</span><span>Date</span></div>
      </div>
    </div>

    <div class="foot">Once complete, return this sheet to the S-6 desk.</div>
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
