// Envelope sticker printing on an Avery 5160 sheet (3 cols x 10 rows, 30
// labels — 2.625in x 1in each, 0.1875in side margins, 0.5in top/bottom
// margin, no vertical gap between rows). Same window.open + document.write +
// print() pattern as ballGuestVerifyPdf.js / consentPdfPrint.js.
//
// Single-label and batch printing share the same stock and label design.
// Batch jobs start at the chosen open cell, then continue on fresh sheets.
// Unused cells stay blank.
function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export const AVERY_5160 = { cols: 3, rows: 10, count: 30 };

export const AVERY_5160_GEOMETRY = {labelWidth:2.625,labelHeight:1,columnPitch:2.75,leftMargin:0.1875,topMargin:0.5,pageWidth:8.5,pageHeight:11};
const LABEL_W_IN = AVERY_5160_GEOMETRY.labelWidth;
const LABEL_H_IN = AVERY_5160_GEOMETRY.labelHeight;
const COL_PITCH_IN = AVERY_5160_GEOMETRY.columnPitch; // label width + 0.125in horizontal gap
const LEFT_MARGIN_IN = AVERY_5160_GEOMETRY.leftMargin;
const TOP_MARGIN_IN = AVERY_5160_GEOMETRY.topMargin;

// index: 0-based, numbered left-to-right then top-to-bottom (position 1 on
// the physical sheet = index 0), matching how Avery itself numbers 5160.
function cellOffset(index) {
  const col = index % AVERY_5160.cols;
  const row = Math.floor(index / AVERY_5160.cols);
  return {
    left: LEFT_MARGIN_IN + col * COL_PITCH_IN,
    top: TOP_MARGIN_IN + row * LABEL_H_IN,
  };
}

function metaLine(letLevel, company) {
  return [letLevel ? `LET ${letLevel}` : null, company ? company.toUpperCase() : null]
    .filter(Boolean).join(' · ');
}

function labelHtml({ cadetName, letLevel, company, guestName }, index) {
  const { left, top } = cellOffset(index);
  const meta = metaLine(letLevel, company);
  return `<div class="label" style="left:${left}in;top:${top}in">
    <div class="brand">Trojan Battalion &middot; Military Ball</div>
    <div class="body">
      <div class="name">${escapeHtml(cadetName)}</div>
      ${meta ? `<div class="meta">${escapeHtml(meta)}</div>` : ''}
      ${guestName ? `<div class="guest">+ ${escapeHtml(guestName)}</div>` : ''}
    </div>
  </div>`;
}

export function ballLabelBatchLayout(labels, startIndex = 0) {
  if (!Number.isInteger(startIndex) || startIndex < 0 || startIndex >= AVERY_5160.count) throw new Error('Pick a label position on the sheet first.');
  if (!Array.isArray(labels) || !labels.length || labels.some(label => !label?.cadetName)) throw new Error('Select available tags to print.');
  const sheets = [];
  labels.forEach((label, i) => {
    const position = startIndex + i;
    const sheet = Math.floor(position / AVERY_5160.count);
    (sheets[sheet] ||= []).push({ label, index: position % AVERY_5160.count });
  });
  return { sheets, nextIndex: (startIndex + labels.length) % AVERY_5160.count };
}

export function ballLabelDocumentHtml(labels, startIndex = 0) {
  const { sheets } = ballLabelBatchLayout(labels, startIndex);
  return `<!doctype html><html><head><meta charset="utf-8">
<title>Ball Envelope Labels (${labels.length})</title>
<style>
  @page { size: letter; margin: 0; }
  * { box-sizing: border-box; }
  html, body { background: #ffffff; margin: 0; padding: 0; }
  .sheet { position: relative; width: 8.5in; height: 11in; break-after: page; page-break-after: always; overflow: hidden; }
  .sheet:last-child { break-after: auto; page-break-after: auto; }
  .label {
    position: absolute;
    width: ${LABEL_W_IN}in; height: ${LABEL_H_IN}in;
    display: flex; flex-direction: column; align-items: center;
    padding: 0.05in 0.16in 0.07in;
    overflow: hidden;
  }
  .label .brand {
    font-family: Arial, Helvetica, sans-serif; font-weight: 700;
    font-size: 6.5px; letter-spacing: 0.16em; text-transform: uppercase; color: #000000;
    width: 100%; text-align: center; padding-bottom: 3px; margin-bottom: 3px;
    border-bottom: 0.75pt solid #000000;
  }
  .label .body {
    flex: 1; width: 100%; display: flex; flex-direction: column;
    align-items: center; justify-content: center; text-align: center; min-height: 0;
  }
  .label .name {
    font-family: Georgia, 'Times New Roman', serif; font-weight: 700;
    font-size: 16px; line-height: 1.15; color: #000000;
    max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .label .meta {
    font-family: 'Courier New', monospace; font-weight: 700;
    font-size: 8.5px; letter-spacing: 0.07em; text-transform: uppercase; color: #000000;
    margin-top: 2px; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .label .guest {
    font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-weight: 600;
    font-size: 11px; color: #000000; margin-top: 3px;
    max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  @media print { * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
  ${sheets.map(sheet => `<div class="sheet">${sheet.map(({label,index}) => labelHtml(label,index)).join('')}</div>`).join('')}
</body></html>`;
}

// cadetName/letLevel/company/guestName come straight off the approved
// ball_signups/ball_guests row — never freehand, so the sticker always
// matches what was actually verified. index: 0-29, which cell on the sheet.
export function printBallEnvelopeLabels(batch, startIndex = 0, printWindow = null) {
  if(batch?.policy_version!==2||!batch?.snapshot_version||!batch.checked_at||!Array.isArray(batch.labels)||!batch.labels.every(label=>label.signupId))throw new Error('Labels require a current database-verified batch. Nothing was printed.');
  const labels=batch.labels;
  let html;
  try { html = ballLabelDocumentHtml(labels, startIndex); }
  catch (error) { alert(error.message); return false; }
  const win = printWindow || window.open('', '_blank');
  if (!win) { alert('Popup blocked, allow popups to print.'); return false; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 350);
  return true;
}

// Raw names cannot bypass the live completion check.
export function printBallEnvelopeLabel(){throw new Error('Select the reservation in Ticket Delivery to verify it before printing.');}

// Generic decorative seals carry no attendee names or completion claims.
export function ballSealDocumentHtml(count=30,startIndex=0){
 if(!Number.isInteger(count)||count<1||count>300)throw new Error('Choose 1 to 300 envelope seals.');
 const {sheets}=ballLabelBatchLayout(Array.from({length:count},()=>({cadetName:'Envelope seal'})),startIndex);
 const star='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 0 12 8 20 10 12 12 10 20 8 12 0 10 8 8Z" fill="black"/></svg>';
 return `<!doctype html><html><head><meta charset="utf-8"><title>Military Ball Envelope Seals (${count})</title><style>
 @page{size:letter;margin:0}*{box-sizing:border-box}html,body{margin:0;background:white;color:black}
 .sheet{position:relative;width:8.5in;height:11in;break-after:page;overflow:hidden}.sheet:last-child{break-after:auto}
 .seal{position:absolute;width:${LABEL_W_IN}in;height:${LABEL_H_IN}in;display:grid;place-items:center}
 .seal-border{position:relative;width:2.38in;height:.82in;border:1px solid black;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px}
 .seal-border:after{content:"";position:absolute;inset:3px;border:0.5px solid black;border-radius:50%;pointer-events:none}
 .school{font:700 8px Arial,sans-serif;letter-spacing:2.2px}.title{font:italic 700 21px Georgia,serif;line-height:1.1}.theme{font:700 7.5px Arial,sans-serif;letter-spacing:1.25px}
 .star{position:absolute;top:calc(50% - 7px);width:14px;height:14px}.star.left{left:12px}.star.right{right:12px}.star svg{display:block;width:100%;height:100%}
 @media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
 </style></head><body>${sheets.map(sheet=>`<div class="sheet">${sheet.map(({index})=>{const p=cellOffset(index);return `<div class="seal" style="left:${p.left}in;top:${p.top}in"><div class="seal-border"><span class="star left">${star}</span><div class="school">SDHS AJROTC</div><div class="title">Military Ball</div><div class="theme">2026 · CELESTIAL NIGHTS</div><span class="star right">${star}</span></div></div>`;}).join('')}</div>`).join('')}</body></html>`;
}
export function printBallEnvelopeSeals(count=30,startIndex=0){
 const html=ballSealDocumentHtml(count,startIndex);
 const win=window.open('','_blank');
 if(!win){alert('Allow popups to print envelope seals.');return false;}
 win.document.write(html);win.document.close();win.focus();setTimeout(()=>win.print(),350);return true;
}
