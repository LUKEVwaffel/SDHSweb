// Generates the parent/cadet-facing printable events calendar as a print-ready
// HTML document, then hands off to the browser's Print (Save as PDF) dialog —
// same window.open + document.write + print() pattern already used for AAR
// exports. No PDF library dependency; the browser IS the PDF engine.
//
// Deliberately white-paper base with navy/gold accents (not the full dark
// on-screen theme) — this gets printed and kept in a binder/fridge, so it
// should look like an official letterhead document, not a website screenshot,
// and shouldn't burn a page of navy ink per sheet.
import { categoryColor, teamLabel, formatEventTime, MON3, MONTHS } from './calendar';

const NAVY = '#142847';
const GOLD = '#C9A961';

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function flagSvg() {
  const stripeH = 20 / 13;
  const stripes = Array.from({ length: 13 }, (_, i) => i)
    .map((i) => `<rect x="0" y="${i * stripeH}" width="30" height="${stripeH}" fill="${i % 2 === 0 ? '#B22234' : '#fff'}" />`)
    .join('');
  return `<svg width="42" height="28" viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="United States flag" style="flex-shrink:0">
    ${stripes}
    <rect x="0" y="0" width="13" height="${stripeH * 7}" fill="${NAVY}" />
  </svg>`;
}

async function qrDataUrl(url) {
  const { toDataURL } = await import('qrcode');
  return toDataURL(url, { margin: 1, width: 130, color: { dark: NAVY, light: '#ffffff' } });
}

function eventCardHtml(ev, qrImgTag) {
  const time = formatEventTime(ev.event_time);
  const d = new Date(`${ev.date}T00:00:00`);
  const day = String(d.getDate()).padStart(2, '0');
  const endDay = ev.end_date ? String(new Date(`${ev.end_date}T00:00:00`).getDate()).padStart(2, '0') : null;
  const hasFlags = ev.uniform_required || ev.transportation_required || ev.permission_slip_required;

  return `
  <div class="ev">
    <div class="ev-date">
      <div class="ev-d">${endDay ? `${day}-${endDay}` : day}</div>
      <div class="ev-mon">${MON3[d.getMonth()]}</div>
    </div>
    <div class="ev-body">
      <div class="ev-head">
        <span class="dot" style="background:${categoryColor(ev.category)}"></span>
        <span class="ev-title">${escapeHtml(ev.title)}</span>
        <span class="ev-team">${escapeHtml(teamLabel(ev.team).toUpperCase())}</span>
      </div>
      <div class="ev-meta">${escapeHtml((ev.category || 'EVENT').replace('_', ' '))}${time ? ' · ' + escapeHtml(time) : ''}${ev.location ? ' · ' + escapeHtml(ev.location) : ''}</div>
      ${hasFlags ? `<div class="ev-flags">
        ${ev.uniform_required ? `<span class="flag">UNIFORM: ${escapeHtml(ev.uniform || '')}</span>` : ''}
        ${ev.transportation_required ? `<span class="flag">TRANSPORT: ${escapeHtml(ev.transportation || '')}</span>` : ''}
        ${ev.permission_slip_required ? `<span class="flag slip">PERMISSION SLIP REQUIRED · see DISPATCH/website${qrImgTag ? ' or scan QR' : ''}</span>` : ''}
      </div>` : ''}
      ${ev.permission_slip_required && qrImgTag ? `<div class="ev-qr">${qrImgTag}<span>Scan for<br/>permission slip</span></div>` : ''}
      ${ev.description ? `<div class="ev-desc">${escapeHtml(ev.description)}</div>` : ''}
    </div>
  </div>`;
}

const DOC_STYLE = `
  @page { size: letter; margin: 0.55in; }
  * { box-sizing: border-box; }
  html, body { background: #ffffff; color: #111111; margin: 0; }
  body { font-family: 'Inter', Arial, sans-serif; }
  .sheet { max-width: 7.4in; margin: 0 auto; }
  .head { border-bottom: 3px solid ${GOLD}; background: ${NAVY}; color: #F4ECD8; padding: 20px 24px; display: flex; align-items: center; gap: 16px; }
  .head .org { font-family: Arial, Helvetica, sans-serif; font-size: 10px; letter-spacing: 3px; text-transform: uppercase; opacity: 0.85; }
  .head .title { font-family: Georgia, 'Times New Roman', serif; font-weight: 700; font-size: 21px; letter-spacing: 0.02em; margin-top: 4px; }
  .meta-row { display: flex; justify-content: space-between; font-family: 'Courier New', monospace; font-size: 9.5px; color: #666; padding: 9px 24px; border-bottom: 1px solid #ddd; }
  .month { font-family: Georgia, serif; font-weight: 700; font-size: 15px; color: ${NAVY}; letter-spacing: 0.08em; margin: 20px 24px 6px; padding-bottom: 4px; border-bottom: 1.5px solid ${NAVY}; page-break-after: avoid; }
  .ev { display: flex; gap: 14px; padding: 10px 24px; border-bottom: 1px solid #eee; page-break-inside: avoid; }
  .ev-date { width: 42px; flex-shrink: 0; text-align: center; border-left: 3px solid ${GOLD}; padding-left: 8px; }
  .ev-d { font-family: Georgia, serif; font-weight: 700; font-size: 16px; color: ${NAVY}; line-height: 1; }
  .ev-mon { font-family: 'Courier New', monospace; font-size: 8px; color: #888; letter-spacing: 0.1em; margin-top: 2px; }
  .ev-body { flex: 1; min-width: 0; }
  .ev-head { display: flex; align-items: center; gap: 8px; }
  .dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .ev-title { font-weight: 700; font-size: 12.5px; color: #111; }
  .ev-team { margin-left: auto; font-family: 'Courier New', monospace; font-size: 8px; letter-spacing: 0.12em; color: #999; }
  .ev-meta { font-family: 'Courier New', monospace; font-size: 9px; color: #666; margin-top: 3px; }
  .ev-flags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
  .flag { font-family: 'Courier New', monospace; font-size: 8px; letter-spacing: 0.02em; background: #f4f1ea; border: 1px solid ${GOLD}; color: #6b5a2e; padding: 2px 7px; }
  .flag.slip { border-color: ${NAVY}; color: ${NAVY}; background: #eef1f6; }
  .ev-qr { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
  .ev-qr img { width: 52px; height: 52px; }
  .ev-qr span { font-family: 'Courier New', monospace; font-size: 7.5px; color: #999; line-height: 1.3; }
  .ev-desc { font-family: Inter, Arial, sans-serif; font-size: 10.5px; color: #555; margin-top: 6px; line-height: 1.4; }
  .foot { text-align: center; padding: 16px; font-family: 'Courier New', monospace; font-size: 8px; color: #aaa; }
  @media print { .no-print { display: none; } }
`;

function documentHtml({ monthSections, generatedOn, scopeLabel }) {
  return `<!doctype html><html><head><meta charset="utf-8">
<title>Trojan Battalion Events Calendar</title>
<style>${DOC_STYLE}</style>
</head>
<body>
  <div class="sheet">
    <div class="head">
      ${flagSvg()}
      <div>
        <div class="org">Trojan Battalion JROTC</div>
        <div class="title">Events Calendar${scopeLabel ? ' · ' + escapeHtml(scopeLabel) : ''}</div>
      </div>
    </div>
    <div class="meta-row"><span>Generated ${escapeHtml(generatedOn)}</span><span>DISPATCH calendar export</span></div>
    ${monthSections}
    <div class="foot">Permission slips and the latest schedule are always available at the Events page on the battalion website.</div>
  </div>
</body></html>`;
}

// events = full posted rows from `events` (not the trimmed toCalendarItem
// shape — the PDF needs uniform/transportation/permission-slip fields the
// light calendar-item shape drops). team: undefined/'all' = everything,
// 'battalion' = team IS NULL, or a specific team id.
export async function openEventsCalendarPdf(events, { team } = {}) {
  const win = window.open('', '_blank');
  if (!win) { alert('Popup blocked, allow popups to export the PDF.'); return; }

  const scoped = !team || team === 'all'
    ? events
    : team === 'battalion'
      ? events.filter((e) => !e.team)
      : events.filter((e) => e.team === team);
  const sorted = [...scoped].filter((e) => e.date).sort((a, b) => a.date.localeCompare(b.date));

  const groups = [];
  let current = null;
  for (const ev of sorted) {
    const d = new Date(`${ev.date}T00:00:00`);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!current || current.key !== key) {
      current = { key, y: d.getFullYear(), m: d.getMonth(), rows: [] };
      groups.push(current);
    }
    current.rows.push(ev);
  }

  const monthSections = (await Promise.all(groups.map(async (g) => {
    const cards = await Promise.all(g.rows.map(async (ev) => {
      let qrImg = '';
      if (ev.permission_slip_required && ev.permission_slip_url) {
        const dataUrl = await qrDataUrl(ev.permission_slip_url);
        qrImg = `<img src="${dataUrl}" alt="QR code linking to the permission slip PDF" />`;
      }
      return eventCardHtml(ev, qrImg);
    }));
    return `<div class="month">${MONTHS[g.m]} ${g.y}</div>${cards.join('')}`;
  }))).join('');

  const scopeLabel = !team || team === 'all' ? '' : team === 'battalion' ? 'Battalion' : teamLabel(team);
  const html = documentHtml({
    monthSections: monthSections || '<div style="padding:40px 24px;font-family:\'Courier New\',monospace;font-size:11px;color:#999;text-align:center">NO POSTED EVENTS IN THIS SCOPE</div>',
    generatedOn: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    scopeLabel,
  });

  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 350);
}
