// Printable "Reservation Conflict" slip for a Ball signup that ended up with
// more than one reservation on file (duplicate signup, or a cadet wants to add
// a third person onto a couple reservation — the system only supports a solo
// or a 1+1 couple reservation, never 3 under one). Same window.open +
// document.write + print() pattern as ballAllergyFollowUpPdf.js.
//
// Hands the cadet three mutually-exclusive options and a signature line so
// S-6 has a paper record of which one they picked before touching the DB.
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
  .section { margin: 22px 0; page-break-inside: avoid; }
  .section .k { font-family: Arial, Helvetica, sans-serif; font-weight: 700; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: #000000; border-bottom: 1.5px solid #000000; padding-bottom: 6px; margin-bottom: 12px; }
  .option { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 10px; }
  .option .box { flex: none; width: 20px; height: 20px; border: 2px solid #000000; margin-top: 2px; }
  .option .body { min-width: 0; }
  .option .txt { font-family: Inter, Arial, sans-serif; font-size: 14px; font-weight: 700; line-height: 1.5; color: #000000; }
  .option .sub { font-family: Inter, Arial, sans-serif; font-size: 12.5px; font-weight: 400; line-height: 1.55; color: #000000; margin-top: 4px; }
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

function documentHtml({ companyLabel, generatedOn, cadetName, letLevel, options }) {
  return `<!doctype html><html><head><meta charset="utf-8">
<title>Reservation Choice — ${escapeHtml(cadetName)}</title>
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
      <div class="title">Reservation Choice — Pick One</div>
    </div>
    <div class="meta-row"><span>Generated ${escapeHtml(generatedOn)}</span><span>Return completed sheet to S-6</span></div>

    <div class="directive">
      <div class="k">To the company commander</div>
      <div class="msg">Deliver this paper directly to <b>${escapeHtml(cadetName)}</b>${letLevel ? ` <b>(LET ${escapeHtml(letLevel)})</b>` : ''} in <b>${escapeHtml(companyLabel)}</b> company.</div>
    </div>

    <div class="flag-note">
      <div class="k">To the cadet</div>
      <div class="msg">You have more than one Ball reservation on file. Our sign-up system can only hold <b>one or two people per reservation — never three.</b> Check exactly <b>one</b> box below for how you want to move forward, sign it, and return it to S-6. We'll fix the reservations to match once we have your answer.</div>
    </div>

    <div class="section">
      <div class="k">Choose one</div>
      ${options.map((opt, i) => `
      <div class="option">
        <div class="box"></div>
        <div class="body">
          <div class="txt">Option ${i + 1} — ${escapeHtml(opt.title)}</div>
          <div class="sub">${escapeHtml(opt.body)}</div>
        </div>
      </div>`).join('')}
    </div>

    <div class="sign-row">
      <div class="sign-field"><div class="line"></div><div class="cap">Signature</div></div>
      <div class="sign-field"><div class="line"></div><div class="cap">Date</div></div>
    </div>

    <div class="foot">Once complete, return this sheet to the S-6 desk.</div>
  </div>
</body></html>`;
}

// r: a row from the Ball Overview tab (cadet_name, cadet_let_level,
// cadet_company). guestName / thirdName / soloPrice describe the specific
// conflict in plain language — this sheet doesn't touch the database, it's
// just the paper S-6 hands the cadet to get a decision in writing. Nobody's
// gender/relationship is assumed here — names only, no pronouns — since
// that's cadet-specific context this sheet has no business guessing at.
export function openBallReservationChoicePdf(r, { guestName, thirdName, soloPrice }) {
  const win = window.open('', '_blank');
  if (!win) { alert('Popup blocked, allow popups to print.'); return; }

  const options = [
    {
      title: 'Go alone',
      body: `Drop ${guestName} and ${thirdName} from your reservation. You attend solo and pay the full solo price (${soloPrice}) yourself.`,
    },
    {
      title: `Split into separate reservations — bring ${thirdName}`,
      body: `${guestName} gets a separate solo reservation and pays ${soloPrice} on it. You and ${thirdName} each pay ${soloPrice} too — ` +
        `nobody gets the couple discount in this option, all three of you pay the full solo price.`,
    },
    {
      title: `Keep the original couple reservation with ${guestName}`,
      body: `${thirdName} does not come to the Ball. Nothing changes — you and ${guestName} stay on the couple reservation you already have, at the discounted price already on file.`,
    },
  ];

  const html = documentHtml({
    companyLabel: (r.cadet_company || 'No company on file').toUpperCase(),
    generatedOn: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    cadetName: r.cadet_name || '—',
    letLevel: r.cadet_let_level,
    options,
  });

  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 350);
}
