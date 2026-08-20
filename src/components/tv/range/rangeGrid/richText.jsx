// Per-substring rich text for slide-owned strings (announcementSingle's
// title/message) — NOT the whole-slide font/size/bold override
// (fontOptions.js, applied via each slide's `style` prop), which still
// applies uniformly to externally-sourced content (announcements/staff
// notes/etc).
//
// A run is `{ text, bold?, italic?, underline?, color?, fontSize? }`. Rendered as plain
// React <span> elements (RenderRuns) — never dangerouslySetInnerHTML, so
// there's no HTML-injection surface to sanitize against.

export function stringToRuns(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value) return [{ text: value }];
  return [];
}

export function runsToPlainText(runs) {
  return stringToRuns(runs).map((r) => r.text).join('');
}

// Trims a run list to a total plain-text length, cutting the run that
// crosses the boundary rather than dropping it whole.
export function truncateRuns(runs, maxLength) {
  const out = [];
  let used = 0;
  for (const r of stringToRuns(runs)) {
    if (used >= maxLength) break;
    const remaining = maxLength - used;
    const text = r.text.length > remaining ? r.text.slice(0, remaining) : r.text;
    out.push({ ...r, text });
    used += text.length;
  }
  return out;
}

// tv_notices.title/message are plain `text` columns (supabase/tv_notices.sql)
// — no schema change needed to carry rich formatting, since a `text` column
// happily holds a JSON-encoded string. storageStringToRuns falls back to
// treating the value as plain text whenever it isn't valid run JSON, so
// every notice written before this feature shipped keeps rendering exactly
// as it did.
const RUNS_MARKER = 'rgruns:';

export function runsToStorageString(runs) {
  return RUNS_MARKER + JSON.stringify(stringToRuns(runs));
}

export function storageStringToRuns(value) {
  if (typeof value !== 'string' || !value.startsWith(RUNS_MARKER)) return stringToRuns(value);
  try {
    const parsed = JSON.parse(value.slice(RUNS_MARKER.length));
    return Array.isArray(parsed) ? parsed : stringToRuns(value);
  } catch {
    return stringToRuns(value);
  }
}

function sameFormat(a, b) {
  return a.bold === b.bold && a.italic === b.italic && a.underline === b.underline
    && a.color === b.color && a.fontSize === b.fontSize;
}

function mergeRuns(runs) {
  const merged = [];
  for (const r of runs) {
    const last = merged[merged.length - 1];
    if (last && sameFormat(last, r)) {
      last.text += r.text;
    } else {
      merged.push({ ...r });
    }
  }
  return merged.filter((r) => r.text.length > 0);
}

function walk(node, ctx, runs) {
  if (node.nodeType === Node.TEXT_NODE) {
    if (node.textContent) runs.push({ text: node.textContent, ...ctx });
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const tag = node.tagName.toLowerCase();
  if (tag === 'br') {
    runs.push({ text: '\n', ...ctx });
    return;
  }
  const next = { ...ctx };
  if (tag === 'b' || tag === 'strong') next.bold = true;
  if (tag === 'i' || tag === 'em') next.italic = true;
  if (tag === 'u') next.underline = true;
  if (node.style?.color) next.color = node.style.color;
  if (node.style?.fontSize) next.fontSize = parseInt(node.style.fontSize, 10) || undefined;
  node.childNodes.forEach((child) => walk(child, next, runs));
}

// Walks a contentEditable element's DOM after an edit (execCommand output —
// <b>/<strong>, <i>/<em>, <u>, inline color spans) into the run model above.
export function domToRuns(el) {
  const runs = [];
  el.childNodes.forEach((child) => walk(child, {}, runs));
  return mergeRuns(runs);
}

export function RenderRuns({ runs }) {
  const list = stringToRuns(runs);
  if (!list.length) return null;
  return list.map((r, i) => {
    if (r.text === '\n') return <br key={i} />;
    return (
      <span
        key={i}
        style={{
          fontWeight: r.bold ? 700 : undefined,
          fontStyle: r.italic ? 'italic' : undefined,
          textDecoration: r.underline ? 'underline' : undefined,
          color: r.color || undefined,
          fontSize: r.fontSize ? `${r.fontSize}px` : undefined,
        }}
      >
        {r.text}
      </span>
    );
  });
}
