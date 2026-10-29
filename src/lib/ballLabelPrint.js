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

const LABEL_W_IN = 2.625;
const LABEL_H_IN = 1;
const COL_PITCH_IN = 2.75; // label width + 0.125in horizontal gap
const LEFT_MARGIN_IN = 0.1875;
const TOP_MARGIN_IN = 0.5;

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
