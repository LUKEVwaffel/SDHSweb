import { useState, useEffect, useRef } from 'react';
import { P, mono, inter, fs, sp, radius, ease } from '../../admin/theme.js';
import { useNowTicker } from '../../../hooks/useNowTicker.js';
import { useTvNotices } from '../../../hooks/useTvNotices.js';
import { useTvUpcomingEvents } from '../../../hooks/useTvUpcomingEvents.js';
import RangeGridBoard from '../range/rangeGrid/RangeGridBoard.jsx';
import { DEFAULT_ROTATION_GRID, GRID_WIDGET_LABELS, resolveRotationGrid } from '../range/rangeGrid/gridDefaults.js';

// Merges a board update (which only ever sees the raider-gated, visible-only
// resolved grid) back into the full stored grid — so a widget the raider
// gate is currently hiding keeps its last saved position/size untouched
// instead of getting dropped from the config the moment the toggle is off.
function mergeGrid(storedGrid, nextResolved) {
  const byId = new Map(nextResolved.map((w) => [w.id, w]));
  return storedGrid.map((w) => byId.get(w.id) ?? w);
}

const toggleBtnBase = {
  fontFamily: inter, fontSize: 13, fontWeight: 600, padding: '8px 18px',
  borderRadius: radius.sm, border: 'none', cursor: 'pointer', transition: `all 150ms ${ease}`,
};

const chromeBtnBase = {
  background: 'none', border: `1px solid ${P.hairStrong}`, color: P.mute,
  fontFamily: inter, fontSize: 13, fontWeight: 600, padding: '8px 16px',
  borderRadius: radius.sm, cursor: 'pointer',
};

/**
 * Range's "Grid Layout" control-center tab — drag/resize/show/hide widgets
 * on the freeform board that TvRangeRotationLayout.jsx renders live. Same
 * RangeGridBoard component drives both Edit (drag chrome on) and TV Preview
 * (drag chrome off, same read-only renderer the real kiosk uses) so what's
 * previewed here is exactly what airs. Nothing here writes to the DB —
 * onChange feeds TvRemotePanel's draft; Fullscreen requests the Fullscreen
 * API on just this board (not the whole panel), which escapes the admin
 * panel's ~940px column width entirely — the point of it, since a bounded
 * embedded editor is too cramped to place tiles precisely. `onSave` is
 * wired through so a save doesn't require exiting fullscreen first.
 */
export default function StepRangeLayout({ config, settings, onChange, onSave, saving, flash, saveError }) {
  const [mode, setMode] = useState('edit');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const wrapRef = useRef(null);
  const now = useNowTicker();
  const { notices } = useTvNotices('range');
  const events = useTvUpcomingEvents(6);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(document.fullscreenElement === wrapRef.current);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  async function toggleFullscreen() {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await wrapRef.current?.requestFullscreen();
    }
  }

  const storedGrid = config.rotationGrid?.length ? config.rotationGrid : DEFAULT_ROTATION_GRID;
  const resolvedGrid = resolveRotationGrid(storedGrid, !!config.showRaiderPractice);
  const hiddenTiles = resolvedGrid.filter((w) => !w.visible);

  function handleBoardChange(nextResolved) {
    onChange({ rotationGrid: mergeGrid(storedGrid, nextResolved) });
  }

  function showTile(id) {
    onChange({ rotationGrid: storedGrid.map((w) => (w.id === id ? { ...w, visible: true } : w)) });
  }

  function resetLayout() {
    onChange({ rotationGrid: DEFAULT_ROTATION_GRID.map((w) => ({ ...w })) });
  }

  const contentProps = {
    settings, now, config,
    announcements: notices.filter((n) => n.category === 'announcement'),
    staffNotes: notices.filter((n) => n.category === 'staff_note'),
    events,
  };

  return (
    <div>
      <div style={{ fontFamily: mono, fontSize: 10, color: P.gold, letterSpacing: '0.24em', marginBottom: sp[2] }}>
        ROTATION SCREEN — GRID LAYOUT
      </div>
      <div style={{ fontFamily: inter, fontSize: 13, color: P.mute, marginBottom: sp[5], lineHeight: 1.5 }}>
        Drag a tile anywhere on the board, drag the corner to resize, × removes it to the tray below.
        Go fullscreen for room to work — Save stays available without leaving it.
      </div>

      <div
        ref={wrapRef}
        style={isFullscreen ? {
          background: P.ink, minHeight: '100vh', width: '100%', boxSizing: 'border-box',
          display: 'flex', flexDirection: 'column', padding: sp[8], overflowY: 'auto',
        } : undefined}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: sp[3], marginBottom: sp[4], flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: P.navy, borderRadius: radius.md, padding: 3, gap: 2 }}>
            <button
              onClick={() => setMode('edit')}
              style={{ ...toggleBtnBase, background: mode === 'edit' ? P.gold : 'transparent', color: mode === 'edit' ? P.ink : P.mute }}
            >
              Edit
            </button>
            <button
              onClick={() => setMode('preview')}
              style={{ ...toggleBtnBase, background: mode === 'preview' ? P.gold : 'transparent', color: mode === 'preview' ? P.ink : P.mute }}
            >
              TV Preview
            </button>
          </div>
          <div style={{ display: 'flex', gap: sp[2] }}>
            <button onClick={resetLayout} style={chromeBtnBase}>Reset layout</button>
            <button
              onClick={toggleFullscreen}
              style={{ ...chromeBtnBase, border: `1px solid ${P.gold}`, color: P.bright }}
            >
              {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            </button>
          </div>
        </div>

        <div style={{
          display: 'flex', justifyContent: 'center', padding: mode === 'edit' ? sp[3] : 0,
          background: P.ink, borderRadius: radius.lg, border: `1px solid ${P.hair}`, overflow: 'auto',
        }}>
          <RangeGridBoard
            grid={resolvedGrid}
            editable={mode === 'edit'}
            onChange={handleBoardChange}
            contentProps={contentProps}
          />
        </div>

        {hiddenTiles.length > 0 && (
          <div style={{ marginTop: sp[5] }}>
            <div style={{ fontFamily: mono, fontSize: fs.micro, letterSpacing: '0.2em', color: P.faint, marginBottom: sp[2] }}>
              HIDDEN WIDGETS
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: sp[2] }}>
              {hiddenTiles.map((w) => (
                <button
                  key={w.id}
                  onClick={() => showTile(w.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: sp[2],
                    background: P.deep, border: `1px solid ${P.hair}`, color: P.mute,
                    fontFamily: inter, fontSize: 13, fontWeight: 600, padding: '8px 14px',
                    borderRadius: radius.pill, cursor: 'pointer',
                  }}
                >
                  <span>{GRID_WIDGET_LABELS[w.kind] ?? w.kind}</span>
                  <span style={{ color: P.gold, fontSize: 16, lineHeight: 1 }}>+</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {isFullscreen && (
          <div style={{ display: 'flex', alignItems: 'center', gap: sp[4], marginTop: sp[6] }}>
            <button
              onClick={onSave}
              disabled={saving}
              style={{
                background: P.gold, border: 'none', color: P.ink, fontFamily: inter,
                fontSize: 15, fontWeight: 700, padding: '12px 28px', borderRadius: radius.md,
                cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'SAVING…' : 'SAVE — PUSH TO RANGE'}
            </button>
            {flash && <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.green }}>{flash}</div>}
            {saveError && <div style={{ fontFamily: inter, fontSize: 13, color: P.red }}>{saveError}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
