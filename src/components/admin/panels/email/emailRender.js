// Branded email renderer — the LOCKED DISPATCH template.
//
// Turns the builder's block array into two outputs:
//   blocksToHtml(blocks, opts) → full branded HTML doc (navy/gold/cream, table
//     layout, inline styles). This is what SENDS and what the signature PDF
//     prints — identical bytes, no drift.
//   blocksToText(blocks)       → plaintext fallback for the email text part.
//
// Email-client reality: web fonts (Oswald/Inter) don't load in Gmail etc., so
// every font-family carries a real fallback (Arial Narrow ~ Oswald's condensed
// feel). Layout is table-based with inline styles — the only thing clients honor.

const C = {
  ink: '#06101F', navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', bright: '#E8C77A', cream: '#F4ECD8',
  mute: '#9a917d', hair: '#2a3b57',
};

const FONT_HEAD = "'Arial Narrow', 'Oswald', Arial, sans-serif";
const FONT_BODY = "Helvetica, 'Inter', Arial, sans-serif";
const FONT_MONO = "'Courier New', monospace";

export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Only allow safe link schemes; anything else becomes '#'.
export function safeUrl(url) {
  const u = String(url ?? '').trim();
  if (!u) return '';
  try {
    const parsed = new URL(u, 'https://x');
    if (['http:', 'https:', 'mailto:'].includes(parsed.protocol)) return u;
  } catch { /* fall through */ }
  return '';
}

function fmtBytes(n) {
  if (!n && n !== 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// ---- per-block HTML ----------------------------------------------------------
function blockHtml(b) {
  switch (b.type) {
    case 'heading': {
      const size = b.level === 2 ? 22 : 30;
      return `<tr><td style="padding:8px 32px 4px;">
        <div style="font-family:${FONT_HEAD};font-size:${size}px;font-weight:bold;letter-spacing:1px;color:${C.cream};line-height:1.15;text-transform:uppercase;">${escapeHtml(b.text)}</div>
      </td></tr>`;
    }
    case 'text': {
      const html = escapeHtml(b.text).replace(/\n/g, '<br>');
      return `<tr><td style="padding:8px 32px;">
        <div style="font-family:${FONT_BODY};font-size:16px;line-height:1.65;color:${C.cream};">${html}</div>
      </td></tr>`;
    }
    case 'image': {
      const src = safeUrl(b.url);
      if (!src) return '';
      const img = `<img src="${escapeHtml(src)}" alt="${escapeHtml(b.alt || '')}" width="536" style="display:block;width:100%;max-width:536px;height:auto;border:0;border-radius:6px;" />`;
      const href = safeUrl(b.href);
      const wrapped = href ? `<a href="${escapeHtml(href)}" target="_blank">${img}</a>` : img;
      return `<tr><td style="padding:12px 32px;">${wrapped}</td></tr>`;
    }
    case 'button': {
      const href = safeUrl(b.href) || '#';
      return `<tr><td style="padding:14px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="background:${C.gold};border-radius:5px;">
            <a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:14px 30px;font-family:${FONT_MONO};font-size:13px;font-weight:bold;letter-spacing:1.5px;color:${C.ink};text-decoration:none;text-transform:uppercase;">${escapeHtml(b.label || 'Learn more')}</a>
          </td>
        </tr></table>
      </td></tr>`;
    }
    case 'divider':
      return `<tr><td style="padding:10px 32px;"><div style="border-top:1px solid ${C.hair};font-size:0;line-height:0;">&nbsp;</div></td></tr>`;
    case 'spacer': {
      const h = b.size === 'lg' ? 40 : b.size === 'sm' ? 12 : 24;
      return `<tr><td style="font-size:0;line-height:0;height:${h}px;">&nbsp;</td></tr>`;
    }
    case 'attachment': {
      // Rendered as a download row; the actual file rides as a real email
      // attachment (edge function reads attachment blocks separately).
      const href = safeUrl(b.url);
      const label = escapeHtml(b.filename || 'attachment');
      const size = b.size ? ` · ${fmtBytes(b.size)}` : '';
      const inner = `<span style="font-family:${FONT_MONO};font-size:13px;color:${C.bright};">📎 ${label}</span><span style="font-family:${FONT_MONO};font-size:11px;color:${C.mute};">${size}</span>`;
      const row = href ? `<a href="${escapeHtml(href)}" target="_blank" style="text-decoration:none;">${inner}</a>` : inner;
      return `<tr><td style="padding:6px 32px;"><div style="background:${C.deep};border:1px solid ${C.hair};border-radius:5px;padding:11px 14px;">${row}</div></td></tr>`;
    }
    default:
      return '';
  }
}

// ---- full document -----------------------------------------------------------
export function blocksToHtml(blocks, opts = {}) {
  const { subject = '', preheader = '' } = opts;
  const body = (blocks || []).map(blockHtml).join('\n');
  const pre = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>`
    : '';

  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:${C.ink};">
${pre}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.ink};padding:24px 0;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:${C.navy};border:1px solid ${C.hair};border-radius:8px;overflow:hidden;">

      <!-- header -->
      <tr><td style="background:${C.deep};padding:22px 32px;border-bottom:2px solid ${C.gold};">
        <div style="font-family:${FONT_HEAD};font-size:26px;font-weight:bold;letter-spacing:5px;color:${C.cream};text-transform:uppercase;">Trojan Battalion</div>
        <div style="font-family:${FONT_MONO};font-size:10px;letter-spacing:3px;color:${C.gold};margin-top:5px;">DISPATCH · S-6 NET CONTROL · SODDY DAISY HS</div>
      </td></tr>

      <!-- spacer -->
      <tr><td style="font-size:0;line-height:0;height:12px;">&nbsp;</td></tr>

      <!-- content blocks -->
      ${body}

      <!-- spacer -->
      <tr><td style="font-size:0;line-height:0;height:16px;">&nbsp;</td></tr>

      <!-- footer -->
      <tr><td style="background:${C.deep};padding:20px 32px;border-top:1px solid ${C.hair};">
        <div style="font-family:${FONT_MONO};font-size:10px;letter-spacing:2px;color:${C.gold};">TROJAN BATTALION · U.S. ARMY JROTC</div>
        <div style="font-family:${FONT_BODY};font-size:12px;color:${C.mute};line-height:1.6;margin-top:6px;">
          Soddy Daisy High School · 618 Sequoyah Access Rd · Soddy Daisy, TN 37379<br>
          You're receiving this because you subscribed to Trojan Battalion updates.
        </div>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}

// ---- plaintext fallback ------------------------------------------------------
export function blocksToText(blocks) {
  const lines = [];
  for (const b of blocks || []) {
    switch (b.type) {
      case 'heading': lines.push((b.text || '').toUpperCase(), ''); break;
      case 'text': lines.push(b.text || '', ''); break;
      case 'button': lines.push(`${b.label || 'Link'}: ${safeUrl(b.href) || ''}`, ''); break;
      case 'image': if (b.alt) lines.push(`[Image: ${b.alt}]`, ''); break;
      case 'divider': lines.push('----------------------------------------', ''); break;
      case 'attachment': lines.push(`[Attachment: ${b.filename || 'file'}] ${safeUrl(b.url) || ''}`, ''); break;
      default: break;
    }
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// Attachment blocks the edge function turns into real Resend attachments.
export function collectAttachments(blocks) {
  return (blocks || [])
    .filter((b) => b.type === 'attachment' && safeUrl(b.url))
    .map((b) => ({ filename: b.filename || 'attachment', url: b.url }));
}
