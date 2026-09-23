// Printable "Allergy Follow-Up" slip for one Ball signup — same window.open +
// document.write + print() pattern as ballGuestVerifyPdf.js / consentPdfPrint.js.
// Handed to a cadet who flagged a food allergy but hasn't responded to S-5's
// contact attempts. Lets the cadet either uncheck the flag (it was a mistake)
// or write in the allergy and confirm a phone number, on paper.
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
  .flag-note { border-left: 5px solid #000000; padding: 10px 16px; margin: 16px 0 22px; }
  .flag-note .k { font-family: Arial, Helvetica, sans-serif; font-weight: 700; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #000000; margin-bottom: 6px; }
  .flag-note .msg { font-family: Inter, Arial, sans-serif; font-weight: 600; font-size: 13.5px; line-height: 1.6; color: #000000; }
  .section { margin: 22px 0; }
  .section .k { font-family: Arial, Helvetica, sans-serif; font-weight: 700; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: #000000; border-bottom: 1.5px solid #000000; padding-bottom: 6px; margin-bottom: 12px; }
  .option { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 8px; }
  .option .box { flex: none; width: 18px; height: 18px; border: 2px solid #000000; margin-top: 2px; }
  .option .txt { font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 600; line-height: 1.5; color: #000000; }
  .lines { margin-top: 10px; }
  .lines .line { border-bottom: 1.5px solid #000000; height: 30px; }
  .phone-onfile { font-family: 'Courier New', monospace; font-weight: 700; font-size: 15px; color: #000000; margin-bottom: 10px; }
  .phone-confirm { display: flex; align-items: baseline; gap: 10px; }
  .phone-confirm .lbl { font-family: Inter, Arial, sans-serif; font-size: 12px; color: #000000; white-space: nowrap; }
  .phone-confirm .line { flex: 1; border-bottom: 1.5px solid #000000; height: 26px; }
  .sign-row { display: flex; gap: 32px; margin-top: 30px; }
  .sign-field { flex: 1; }
  .sign-field .line { border-bottom: 1.5px solid #000000; height: 30px; margin-bottom: 6px; }
  .sign-field .cap { font-family: 'Courier New', monospace; font-weight: 700; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: #000000; }
  .foot { text-align: center; padding: 18px 16px; font-family: Arial, Helvetica, sans-serif; font-weight: 700; font-size: 13px; color: #000000; border: 2px solid #000000; margin-top: 22px; }
  @media print {
    .no-print { display: none; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`;

function documentHtml({ companyLabel, generatedOn, cadetName, letLevel, phoneOnFile }) {
  return `<!doctype html><html><head><meta charset="utf-8">
<title>Allergy Follow-Up — ${escapeHtml(cadetName)}</title>
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
      <div class="title">Food Allergy Follow-Up</div>
    </div>
    <div class="meta-row"><span>Generated ${escapeHtml(generatedOn)}</span><span>Return completed sheet to S-6</span></div>

    <div class="directive">
      <div class="k">To the company commander</div>
      <div class="msg">Deliver this paper directly to <b>${escapeHtml(cadetName)}</b>${letLevel ? ` <b>(LET ${escapeHtml(letLevel)})</b>` : ''} in <b>${escapeHtml(companyLabel)}</b> company.</div>
    </div>

    <div class="flag-note">
      <div class="k">To the cadet</div>
      <div class="msg">When you signed up for the Military Ball, you flagged that you have a food allergy. We tried to reach you to get the details but haven't heard back yet. We want your time at the Ball to be the best it can be — please fill out one of the two options below.</div>
    </div>

    <div class="section">
      <div class="k">Option 1 — It was a mistake</div>
      <div class="option">
        <div class="box"></div>
        <div class="txt">Uncheck food allergy — I do not actually have a food allergy, please remove this flag from my signup.</div>
      </div>
    </div>

    <div class="section">
      <div class="k">Option 2 — It's correct</div>
      <div class="option">
        <div class="box"></div>
        <div class="txt">Please specify your allergy below so we can plan food options with the caterer.</div>
      </div>
      <div class="lines">
        <div class="line"></div>
        <div class="line" style="margin-top:10px;"></div>
      </div>
    </div>

    <div class="section">
      <div class="k">Confirm your phone number</div>
      <div class="txt" style="font-weight:600; font-size:13px; margin-bottom:10px;">We may have more questions about your allergy and want to be able to reach you.</div>
      <div class="phone-onfile">On file: ${escapeHtml(phoneOnFile)}</div>
      <div class="phone-confirm">
        <span class="lbl">Correct number, if different:</span>
        <div class="line"></div>
      </div>
    </div>

    <div class="sign-row">
      <div class="sign-field"><div class="line"></div><div class="cap">Signature</div></div>
      <div class="sign-field"><div class="line"></div><div class="cap">Date</div></div>
    </div>

    <div class="foot">Once complete, return this sheet to the S-6 desk.</div>
  </div>
</body></html>`;
}

// r: a row from ball_allergy_list() — id, cadet_name, cadet_let_level, cadet_company,
// cadet_phone, cadet_allergy_email, submitted_at, allergy_status, allergy_contacted_at.
export function openBallAllergyFollowUpPdf(r) {
  const win = window.open('', '_blank');
  if (!win) { alert('Popup blocked, allow popups to print.'); return; }

  const phone = (r.cadet_phone || '').trim();
  const html = documentHtml({
    companyLabel: (r.cadet_company || 'No company on file').toUpperCase(),
    generatedOn: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    cadetName: r.cadet_name || '—',
    letLevel: r.cadet_let_level,
    phoneOnFile: phone || 'no phone on file',
  });

  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 350);
}
