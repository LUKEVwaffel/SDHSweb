// Printable "Form Status" checklist for a company — same window.open +
// document.write + print() pattern as eventsPdfPrint.js. Lists every cadet in
// the company still missing at least one of the 3 tracked forms (photo
// consent, DD 3203, JROTC datasheet — one packet), with a checkbox per form
// so staff can physically mark them off while chasing down paperwork.
const NAVY = '#142847';
const GOLD = '#C9A961';

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const DOC_STYLE = `
  @page { size: letter; margin: 0.55in; }
  * { box-sizing: border-box; }
  html, body { background: #ffffff; color: #111111; margin: 0; }
  body { font-family: 'Inter', Arial, sans-serif; }
  .sheet { max-width: 7.4in; margin: 0 auto; }
  .head { border-bottom: 3px solid ${GOLD}; background: ${NAVY}; color: #F4ECD8; padding: 20px 24px; }
  .head .org { font-family: Arial, Helvetica, sans-serif; font-size: 10px; letter-spacing: 3px; text-transform: uppercase; opacity: 0.85; }
  .head .title { font-family: Georgia, 'Times New Roman', serif; font-weight: 700; font-size: 21px; letter-spacing: 0.02em; margin-top: 4px; }
  .meta-row { display: flex; justify-content: space-between; font-family: 'Courier New', monospace; font-size: 9.5px; color: #666; padding: 9px 24px; border-bottom: 1px solid #ddd; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  thead th { text-align: left; font-family: 'Courier New', monospace; font-size: 8.5px; letter-spacing: 0.08em; color: #666; border-bottom: 1.5px solid ${NAVY}; padding: 8px 6px; }
  thead th.chk { text-align: center; width: 78px; }
  tbody td { font-family: Inter, Arial, sans-serif; font-size: 11px; color: #111; border-bottom: 1px solid #eee; padding: 8px 6px; vertical-align: middle; page-break-inside: avoid; }
  tbody td.chk { text-align: center; }
  tbody td.grade { font-family: 'Courier New', monospace; font-size: 9px; color: #666; white-space: nowrap; }
  .box { display: inline-block; width: 13px; height: 13px; border: 1.5px solid #999; vertical-align: middle; }
  .box.done { background: #eee; border-color: #bbb; position: relative; }
  .box.done::after { content: '\\2713'; position: absolute; inset: 0; text-align: center; line-height: 13px; font-size: 10px; color: #888; }
  .foot { text-align: center; padding: 16px; font-family: 'Courier New', monospace; font-size: 8px; color: #aaa; }
  .empty { padding: 40px 24px; font-family: 'Courier New', monospace; font-size: 11px; color: #999; text-align: center; }
  @media print { .no-print { display: none; } }
`;

function rowHtml(r, forms) {
  const gradeBits = [r.grade ? `${r.grade}TH` : '', r.let_level ? `LET ${r.let_level}` : ''].filter(Boolean).join(' · ');
  const cells = forms.map((f) => {
    const done = r[f.statusCol] === 'collected';
    return `<td class="chk"><span class="box${done ? ' done' : ''}"></span></td>`;
  }).join('');
  return `<tr><td>${escapeHtml(r.name)}</td><td class="grade">${escapeHtml(gradeBits)}</td>${cells}</tr>`;
}

function documentHtml({ companyLabel, generatedOn, missingCount, totalCount, tableRows, forms }) {
  return `<!doctype html><html><head><meta charset="utf-8">
<title>Form Status For ${escapeHtml(companyLabel)}</title>
<style>${DOC_STYLE}</style>
</head>
<body>
  <div class="sheet">
    <div class="head">
      <div class="org">Trojan Battalion JROTC</div>
      <div class="title">Form Status For ${escapeHtml(companyLabel)}</div>
    </div>
    <div class="meta-row"><span>Generated ${escapeHtml(generatedOn)}</span><span>${missingCount} of ${totalCount} cadets missing a form</span></div>
    ${tableRows ? `<table>
      <thead><tr><th>NAME</th><th>GRADE</th>${forms.map((f) => `<th class="chk">${escapeHtml(f.label)}</th>`).join('')}</tr></thead>
      <tbody>${tableRows}</tbody>
    </table>` : `<div class="empty">EVERY CADET IN ${escapeHtml(companyLabel.toUpperCase())} HAS ALL FORMS ON FILE</div>`}
    <div class="foot">Checked box = form collected. Empty box = still needed. All 3 forms are one packet per cadet.</div>
  </div>
</body></html>`;
}

// rows: cadet_consent rows already scoped to one company (sorted as displayed
// on screen). forms: the FORMS array from ConsentSection ({statusCol,label}).
export function openConsentStatusPdf(rows, forms, companyLabel) {
  const win = window.open('', '_blank');
  if (!win) { alert('Popup blocked, allow popups to export the PDF.'); return; }

  const missing = rows.filter((r) => forms.some((f) => r[f.statusCol] !== 'collected'));
  const tableRows = missing.map((r) => rowHtml(r, forms)).join('');

  const html = documentHtml({
    companyLabel,
    generatedOn: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    missingCount: missing.length,
    totalCount: rows.length,
    tableRows,
    forms,
  });

  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 350);
}
