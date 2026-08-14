// Per-substring rich text for tile-owned strings (countdown/photoSingle
// titles, the `text` custom widget) — NOT the whole-tile font/size/bold
// override in gridDefaults.js/RangeGridBoard.jsx, which still applies
// uniformly to externally-sourced content (announcements/events/etc).
//
// A run is `{ text, bold?, italic?, underline?, color? }`. Rendered as plain
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

function sameFormat(a, b) {
  return a.bold === b.bold && a.italic === b.italic && a.underline === b.underline && a.color === b.color;
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
  return list.map((r, i) => (
    <span
      key={i}
      style={{
        fontWeight: r.bold ? 700 : undefined,
        fontStyle: r.italic ? 'italic' : undefined,
        textDecoration: r.underline ? 'underline' : undefined,
        color: r.color || undefined,
      }}
    >
      {r.text}
    </span>
  ));
}
