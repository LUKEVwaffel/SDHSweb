// Envelope sticker printing on an Avery 5160 sheet (3 cols x 10 rows, 30
// labels — 2.625in x 1in each, 0.1875in side margins, 0.5in top/bottom
// margin, no vertical gap between rows). Same window.open + document.write +
// print() pattern as ballGuestVerifyPdf.js / consentPdfPrint.js.
//
// Only ONE label on the sheet is ever printed at a time (position picked by
// the caller), because these are hand-fed partially-used Avery sheets — the
// other 29 cells must render as nothing, not as blank boxes, so ink isn't
// wasted and alignment on an already-printed sheet stays clean.
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

function documentHtml({ hostLine, guestLine, index }) {
  const { left, top } = cellOffset(index);
  return `<!doctype html><html><head><meta charset="utf-8">
<title>Ball Envelope Label</title>
<style>
  @page { size: letter; margin: 0; }
  * { box-sizing: border-box; }
  html, body { background: #ffffff; margin: 0; padding: 0; }
  .label {
    position: absolute;
    left: ${left}in; top: ${top}in;
    width: ${LABEL_W_IN}in; height: ${LABEL_H_IN}in;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 0.06in 0.14in;
    text-align: center;
    overflow: hidden;
  }
  .label .host {
    font-family: Georgia, 'Times New Roman', serif; font-weight: 700;
    font-size: 15px; line-height: 1.25; color: #000000;
    max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .label .guest {
    font-family: Arial, Helvetica, sans-serif; font-weight: 500;
    font-size: 11px; letter-spacing: 0.02em; color: #000000; margin-top: 3px;
    max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  @media print { * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
  <div class="label">
    <div class="host">${escapeHtml(hostLine)}</div>
    ${guestLine ? `<div class="guest">${escapeHtml(guestLine)}</div>` : ''}
  </div>
</body></html>`;
}

// hostLine / guestLine: the two printed lines (guestLine may be empty for a
// solo cadet). index: 0-29, which cell on the Avery 5160 sheet to print into.
export function printBallEnvelopeLabel({ hostLine, guestLine, index }) {
  if (index < 0 || index >= AVERY_5160.count) { alert('Pick a label position on the sheet first.'); return; }
  const win = window.open('', '_blank');
  if (!win) { alert('Popup blocked, allow popups to print.'); return; }

  win.document.write(documentHtml({ hostLine, guestLine, index }));
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 350);
}
