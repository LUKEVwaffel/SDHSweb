import { useRef, useState } from 'react';
import { P, mono, inter, fs, sp, radius, shadow } from '../../../admin/theme.js';
import RangeGridWidgetContent from './RangeGridWidgetContent.jsx';
import { GRID_WIDGET_LABELS, GRID_WIDGET_FILL_KINDS, STYLE_CAPABLE_KINDS, FONT_FAMILY_OPTIONS } from './gridDefaults.js';

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function tileBackground(kind) {
  if (kind === 'clock' || kind === 'announcements' || kind === 'events') return P.navy;
  if (kind === 'photo') return `repeating-linear-gradient(135deg, ${P.ink}, ${P.ink} 10px, ${P.deep} 10px, ${P.deep} 20px)`;
  return P.deep;
}

const handleStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
  padding: '6px 10px', fontSize: 10, fontWeight: 500, letterSpacing: '0.14em',
  fontFamily: mono, cursor: 'grab', userSelect: 'none',
  background: 'rgba(0,0,0,0.25)', color: P.mute,
  touchAction: 'none', flexShrink: 0, height: 26, minHeight: 26,
};

const handleLabelStyle = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 };

const hideBtnStyle = {
  background: 'none', border: 'none', color: 'inherit', opacity: 0.65, fontSize: 16,
  lineHeight: 1, cursor: 'pointer', padding: '2px 4px', flexShrink: 0,
};

const resizeHandleStyle = {
  position: 'absolute', right: 0, bottom: 0, width: 20, height: 20, cursor: 'nwse-resize', touchAction: 'none',
};

const toolbarFieldStyle = {
  padding: '6px 10px', borderRadius: radius.sm, border: `1px solid ${P.hairStrong}`,
  background: P.deep, color: P.cream, fontFamily: inter, fontSize: 13,
};

/**
 * Freeform positioned widget board — the shared renderer for both the live
 * Range kiosk (editable=false, fullBleed=true) and the admin "Grid Layout"
 * editor's Edit/TV Preview modes (fullBleed=false always, editable toggles
 * the drag/resize/hide chrome, plus tile selection + the style inspector
 * below). `grid` is the resolved (visible-only, raider-gated) array from
 * gridDefaults.js; `onChange` receives the full next grid array on every
 * drag/resize/hide/style edit.
 */
export default function RangeGridBoard({ grid, editable, fullBleed = false, onChange, contentProps }) {
  const canvasRef = useRef(null);
  const zTopRef = useRef(1);
  const [zIndexById, setZIndexById] = useState({});
  const [selectedId, setSelectedId] = useState(null);

  const canvasRect = () => (canvasRef.current ? canvasRef.current.getBoundingClientRect() : { width: 1200, height: 700 });

  function bringToFront(id) {
    zTopRef.current += 1;
    setZIndexById((m) => ({ ...m, [id]: zTopRef.current }));
  }

  function startDrag(w, e) {
    e.preventDefault();
    bringToFront(w.id);
    setSelectedId(w.id);
    const rect = canvasRect();
    const startX = e.clientX, startY = e.clientY;
    const origX = w.x, origY = w.y;
    const onMove = (ev) => {
      const dxPct = (ev.clientX - startX) / rect.width;
      const dyPct = (ev.clientY - startY) / rect.height;
      const newX = clamp(origX + dxPct, 0, 1 - w.w);
      const newY = clamp(origY + dyPct, 0, 1 - w.h);
      onChange(grid.map((x) => (x.id === w.id ? { ...x, x: newX, y: newY } : x)));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function startResize(w, e) {
    e.preventDefault();
    e.stopPropagation();
    bringToFront(w.id);
    setSelectedId(w.id);
    const rect = canvasRect();
    const startX = e.clientX, startY = e.clientY;
    const origW = w.w, origH = w.h;
    const onMove = (ev) => {
      const dwPct = (ev.clientX - startX) / rect.width;
      const dhPct = (ev.clientY - startY) / rect.height;
      const newW = clamp(origW + dwPct, 0.08, 1 - w.x);
      const newH = clamp(origH + dhPct, 0.08, 1 - w.y);
      onChange(grid.map((x) => (x.id === w.id ? { ...x, w: newW, h: newH } : x)));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function hide(id) {
    onChange(grid.map((x) => (x.id === id ? { ...x, visible: false } : x)));
    setSelectedId((s) => (s === id ? null : s));
  }

  function updateTile(id, patch) {
    onChange(grid.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  function patchSelectedStyle(patch) {
    onChange(grid.map((x) => (x.id === selectedId ? { ...x, style: { ...x.style, ...patch } } : x)));
  }

  function resetSelectedStyle() {
    onChange(grid.map((x) => (x.id === selectedId ? { ...x, style: undefined } : x)));
  }

  // fullBleed (the live kiosk) sits in a real height:100vh ancestor chain, so
  // height:100% resolves fine there. The editor's canvas does not — it's
  // embedded in an auto-height admin panel, where a percentage height has no
  // basis and collapses (renders as a thin strip). aspect-ratio sizes the
  // canvas from its own resolved width instead, independent of the parent's
  // height, and doubles as an accurate 16:9 TV preview while editing.
  const canvasStyle = {
    position: 'relative',
    width: fullBleed ? '100%' : 'min(1800px, 100%)',
    height: fullBleed ? '100%' : undefined,
    aspectRatio: fullBleed ? undefined : '16 / 9',
    flexShrink: 0,
    backgroundColor: P.deep,
    backgroundImage: editable
      ? `linear-gradient(${P.hair} 1px, transparent 1px), linear-gradient(90deg, ${P.hair} 1px, transparent 1px)`
      : 'none',
    backgroundSize: '40px 40px',
    padding: editable ? 10 : 0,
    borderRadius: editable ? radius.lg : 0,
    border: editable ? `1px solid ${P.hairStrong}` : 'none',
    overflow: 'hidden',
    minHeight: 0,
  };

  const selectedTile = editable ? grid.find((w) => w.id === selectedId && w.visible) : null;
  const showToolbar = selectedTile && STYLE_CAPABLE_KINDS.has(selectedTile.kind);

  // Explicit height (not auto/stretch) so canvas's own height:100% below
  // still resolves against a definite parent in the fullBleed (live kiosk)
  // case — an auto-height wrapper here would collapse it right back to the
  // strip bug the aspect-ratio fix above exists to prevent.
  return (
    <div style={{ width: '100%', height: fullBleed ? '100%' : 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {showToolbar && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: sp[3], flexWrap: 'wrap',
          padding: `${sp[2]}px ${sp[3]}px`, marginBottom: sp[3], borderRadius: radius.md,
          background: P.navy, border: `1px solid ${P.hairStrong}`, boxShadow: shadow.sm,
        }}>
          <span style={{ fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.16em', whiteSpace: 'nowrap' }}>
            STYLING — {GRID_WIDGET_LABELS[selectedTile.kind] ?? selectedTile.kind}
          </span>
          <select
            value={selectedTile.style?.fontFamily ?? ''}
            onChange={(e) => patchSelectedStyle({ fontFamily: e.target.value || undefined })}
            style={toolbarFieldStyle}
          >
            <option value="">Default font</option>
            {FONT_FAMILY_OPTIONS.map((f) => (
              <option key={f.key} value={f.value}>{f.label}</option>
            ))}
          </select>
          <input
            type="number" min={10} max={72}
            value={selectedTile.style?.fontSize ?? ''}
            placeholder="Size"
            onChange={(e) => patchSelectedStyle({ fontSize: e.target.value ? Number(e.target.value) : undefined })}
            style={{ ...toolbarFieldStyle, width: 64 }}
          />
          <button
            onClick={() => patchSelectedStyle({ bold: !selectedTile.style?.bold })}
            style={{
              ...toolbarFieldStyle, fontWeight: 700, cursor: 'pointer', width: 36, textAlign: 'center',
              background: selectedTile.style?.bold ? P.gold : P.deep,
              color: selectedTile.style?.bold ? P.ink : P.cream,
              borderColor: selectedTile.style?.bold ? P.gold : P.hairStrong,
            }}
          >
            B
          </button>
          <button
            onClick={resetSelectedStyle}
            style={{
              background: 'none', border: 'none', color: P.mute, fontFamily: inter, fontSize: 12,
              cursor: 'pointer', textDecoration: 'underline',
            }}
          >
            Reset style
          </button>
        </div>
      )}

      <div
        ref={canvasRef}
        style={canvasStyle}
        onClick={() => editable && setSelectedId(null)}
      >
        {grid.filter((w) => w.visible).map((w) => {
          const isFill = GRID_WIDGET_FILL_KINDS.has(w.kind);
          const selected = editable && selectedId === w.id;
          return (
            <div
              key={w.id}
              onClick={(e) => { if (editable) { e.stopPropagation(); setSelectedId(w.id); } }}
              style={{
                position: 'absolute',
                left: `${w.x * 100}%`,
                top: `${w.y * 100}%`,
                width: `${w.w * 100}%`,
                height: `${w.h * 100}%`,
                zIndex: zIndexById[w.id] || 1,
                background: tileBackground(w.kind),
                color: P.cream,
                borderRadius: radius.lg,
                border: `${selected ? 2 : 1}px solid ${selected ? P.gold : P.hair}`,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                minWidth: 0,
                minHeight: 0,
                boxShadow: editable ? shadow.md : 'none',
              }}
            >
              {editable && (
                <div onPointerDown={(e) => startDrag(w, e)} style={handleStyle}>
                  <span style={handleLabelStyle}>{GRID_WIDGET_LABELS[w.kind] ?? w.kind}</span>
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); hide(w.id); }}
                    style={hideBtnStyle}
                  >
                    ×
                  </button>
                </div>
              )}

              <div style={{
                flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
                padding: isFill ? 0 : `${sp[4]}px ${sp[4]}px`,
                overflow: isFill ? 'hidden' : 'auto',
              }}>
                <RangeGridWidgetContent
                  kind={w.kind}
                  style={w.style}
                  data={w.data}
                  editable={editable}
                  onUpdateTile={(patch) => updateTile(w.id, patch)}
                  {...contentProps}
                />
              </div>

              {editable && (
                <div onPointerDown={(e) => startResize(w, e)} style={resizeHandleStyle}>
                  <svg width="20" height="20" viewBox="0 0 20 20" style={{ display: 'block' }}>
                    <path d="M18 4 L4 18 M18 10 L10 18 M18 16 L16 18" stroke={P.mute} strokeWidth="1.6" fill="none" />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
