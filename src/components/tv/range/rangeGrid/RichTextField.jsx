import { useRef, useEffect, useState, useCallback } from 'react';
import { P, mono, radius } from '../../../admin/theme.js';
import { domToRuns, stringToRuns, runsToPlainText, truncateRuns } from './richText.jsx';

const SWATCHES = [
  { label: 'Cream', value: P.cream },
  { label: 'Gold', value: P.gold },
  { label: 'Bright', value: P.bright },
  { label: 'Mute', value: P.mute },
  { label: 'Red', value: P.red },
  { label: 'Green', value: P.green },
  { label: 'Blue', value: P.blue },
];

// Builds the field's initial DOM straight from the run model via DOM APIs
// (createElement/appendChild) — never an HTML string, so there's no
// dangerouslySetInnerHTML and nothing to sanitize.
function buildDom(container, runs) {
  container.textContent = '';
  stringToRuns(runs).forEach((r) => {
    if (r.text === '\n') { container.appendChild(document.createElement('br')); return; }
    let node = document.createTextNode(r.text);
    if (r.bold) { const b = document.createElement('b'); b.appendChild(node); node = b; }
    if (r.italic) { const i = document.createElement('i'); i.appendChild(node); node = i; }
    if (r.underline) { const u = document.createElement('u'); u.appendChild(node); node = u; }
    if (r.color) { const span = document.createElement('span'); span.style.color = r.color; span.appendChild(node); node = span; }
    container.appendChild(node);
  });
}

function ToolbarBtn({ onClick, label, active }) {
  return (
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      style={{
        width: 22, height: 22, borderRadius: 4, border: `1px solid ${active ? P.gold : P.hairStrong}`,
        background: active ? P.goldWash : P.deep, color: active ? P.bright : P.cream,
        fontFamily: mono, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0,
      }}
    >
      {label}
    </button>
  );
}

function PlaceholderStyle() {
  return <style>{`.rg-richtext:empty:before { content: attr(data-placeholder); color: ${P.faint}; pointer-events: none; }`}</style>;
}

/**
 * Per-substring rich text control — select text inside it, a floating
 * mini-toolbar (bold/italic/underline/color) appears above the selection.
 * Deliberately uncontrolled between renders (DOM only rebuilt when the
 * `value` prop actually changes from outside, tracked via
 * `mountedRunsRef`) — a controlled contentEditable that re-syncs innerHTML
 * on every keystroke is the classic way to break the caret position.
 * Serializes to the run model (richText.js) on blur and after every
 * formatting command, not per keystroke.
 */
export default function RichTextField({ value, onChange, placeholder, multiline = false, maxLength, baseStyle }) {
  const ref = useRef(null);
  const mountedRunsRef = useRef(null);
  const [toolbar, setToolbar] = useState(null);

  useEffect(() => {
    if (!ref.current) return;
    const runs = stringToRuns(value);
    if (JSON.stringify(mountedRunsRef.current) === JSON.stringify(runs)) return;
    buildDom(ref.current, runs);
    mountedRunsRef.current = runs;
  }, [value]);

  const commit = useCallback(() => {
    if (!ref.current) return;
    let runs = domToRuns(ref.current);
    if (maxLength && runsToPlainText(runs).length > maxLength) {
      runs = truncateRuns(runs, maxLength);
      buildDom(ref.current, runs); // clip the visible DOM too, not just what's saved
    }
    mountedRunsRef.current = runs;
    onChange(runs);
  }, [onChange, maxLength]);

  function updateToolbarFromSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !ref.current || !sel.anchorNode || !ref.current.contains(sel.anchorNode)) {
      setToolbar(null);
      return;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    setToolbar({ top: rect.top, left: rect.left + rect.width / 2 });
  }

  function exec(cmd, arg) {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    commit();
    updateToolbarFromSelection();
  }

  function handleKeyDown(e) {
    if (!multiline && e.key === 'Enter') { e.preventDefault(); ref.current?.blur(); }
  }

  return (
    <div style={{ position: 'relative' }}>
      <PlaceholderStyle />
      <div
        ref={ref}
        className="rg-richtext"
        contentEditable
        suppressContentEditableWarning
        onBlur={() => { commit(); setToolbar(null); }}
        onKeyDown={handleKeyDown}
        onMouseUp={updateToolbarFromSelection}
        onKeyUp={updateToolbarFromSelection}
        data-placeholder={placeholder}
        style={{
          minHeight: '1.4em', outline: 'none',
          whiteSpace: multiline ? 'pre-wrap' : 'nowrap',
          overflow: multiline ? 'visible' : 'hidden',
          textOverflow: multiline ? undefined : 'ellipsis',
          ...baseStyle,
        }}
      />
      {toolbar && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: 'fixed', top: toolbar.top - 38, left: toolbar.left, transform: 'translateX(-50%)',
            display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px', borderRadius: radius.sm,
            background: P.ink, border: `1px solid ${P.hairStrong}`, boxShadow: '0 8px 20px rgba(0,0,0,0.5)',
            zIndex: 1000,
          }}
        >
          <ToolbarBtn onClick={() => exec('bold')} label="B" />
          <ToolbarBtn onClick={() => exec('italic')} label="I" />
          <ToolbarBtn onClick={() => exec('underline')} label="U" />
          <div style={{ width: 1, alignSelf: 'stretch', background: P.hairStrong, margin: '0 2px' }} />
          {SWATCHES.map((s) => (
            <button
              key={s.value}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec('foreColor', s.value)}
              title={s.label}
              style={{
                width: 16, height: 16, borderRadius: '50%', background: s.value,
                border: `1px solid ${P.hairStrong}`, cursor: 'pointer', padding: 0,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
