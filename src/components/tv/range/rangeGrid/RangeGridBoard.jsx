import { useRef, useState } from 'react';
import { P, mono, sp, radius, shadow } from '../../../admin/theme.js';
import RangeGridWidgetContent from './RangeGridWidgetContent.jsx';
import { GRID_WIDGET_LABELS, GRID_WIDGET_FILL_KINDS } from './gridDefaults.js';

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

/**
 * Freeform positioned widget board — the shared renderer for both the live
 * Range kiosk (editable=false, fullBleed=true) and the admin "Grid Layout"
 * editor's Edit/TV Preview modes (fullBleed=false always, editable toggles
 * the drag/resize/hide chrome). `grid` is the resolved (visible-only,
 * raider-gated) array from gridDefaults.js; `onChange` receives the full
 * next grid array on every drag/resize/hide.
 */
export default function RangeGridBoard({ grid, editable, fullBleed = false, onChange, contentProps }) {
  const canvasRef = useRef(null);
  const zTopRef = useRef(1);
  const [zIndexById, setZIndexById] = useState({});

  const canvasRect = () => (canvasRef.current ? canvasRef.current.getBoundingClientRect() : { width: 1200, height: 700 });

  function bringToFront(id) {
    zTopRef.current += 1;
    setZIndexById((m) => ({ ...m, [id]: zTopRef.current }));
  }

  function startDrag(w, e) {
    e.preventDefault();
    bringToFront(w.id);
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

  return (
    <div ref={canvasRef} style={canvasStyle}>
      {grid.filter((w) => w.visible).map((w) => {
        const isFill = GRID_WIDGET_FILL_KINDS.has(w.kind);
        return (
          <div
            key={w.id}
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
              border: `1px solid ${P.hair}`,
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
                  onClick={() => hide(w.id)}
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
              <RangeGridWidgetContent kind={w.kind} {...contentProps} />
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
  );
}
