import { useState } from 'react';
import { P, mono, oswald, inter } from '../admin/theme.js';
import { fmtTime } from '../../lib/raiderTv.js';
import { configFrom } from './videoTvPlaylist.js';

// Full-screen overlay for choosing what this TV loops and in what order.
// Edits a local draft; SAVE writes it to this TV's localStorage via onSave.

export default function VideoTvLoopEditor({ rows: initialRows, onSave, onReset, onClose, onPlayNow }) {
  const [rows, setRows] = useState(initialRows);

  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    setRows(next);
  };
  const toggle = (i) => setRows(rows.map((r, k) => (k === i ? { ...r, included: !r.included } : r)));
  const setAll = (included) => setRows(rows.map((r) => ({ ...r, included })));

  const inLoop = rows.filter((r) => r.included);
  const loopSec = inLoop.reduce((n, r) => n + (r.film.duration_sec || 0), 0);

  return (
    <div role="dialog" aria-modal="true" aria-label="Edit TV loop" style={backdrop}>
      <div style={panel}>
        <div style={head}>
          <div>
            <div style={kicker}>THIS TV&apos;S LOOP</div>
            <div style={title}>Edit Loop</div>
            <div style={meta}>{inLoop.length} of {rows.length} films · {fmtTime(loopSec)} + trophy case between each</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button type="button" style={ghostBtn} onClick={() => setAll(true)}>ALL ON</button>
            <button type="button" style={ghostBtn} onClick={() => setAll(false)}>ALL OFF</button>
            <button type="button" style={ghostBtn} onClick={onReset}>RESET</button>
            <button type="button" style={ghostBtn} onClick={onClose}>CANCEL</button>
            <button type="button" style={goldBtn} onClick={() => onSave(configFrom(rows))}>SAVE</button>
          </div>
        </div>

        <ol style={list}>
          {rows.map((r, i) => (
            <li key={r.film.key} style={{ ...row, opacity: r.included ? 1 : 0.45 }}>
              <span style={num}>{String(i + 1).padStart(2, '0')}</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, cursor: 'pointer' }}>
                <input type="checkbox" checked={r.included} onChange={() => toggle(i)} style={{ width: 20, height: 20, accentColor: P.gold }} />
                <span style={{ minWidth: 0 }}>
                  <span style={filmTitle}>{r.film.title}</span>
                  <span style={filmMeta}>
                    {r.film.category.label} · {fmtTime(r.film.duration_sec)}
                    {r.film.parts.length > 1 ? ` · ${r.film.parts.length} parts` : ''}
                  </span>
                </span>
              </label>
              <button type="button" style={iconBtn} aria-label={`Move ${r.film.title} up`} disabled={i === 0} onClick={() => move(i, -1)}>▲</button>
              <button type="button" style={iconBtn} aria-label={`Move ${r.film.title} down`} disabled={i === rows.length - 1} onClick={() => move(i, 1)}>▼</button>
              <button type="button" style={ghostBtn} onClick={() => onPlayNow(r.film.key)}>PLAY NOW</button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

const backdrop = {
  position: 'fixed', inset: 0, zIndex: 20, background: 'rgba(4,10,20,0.9)', backdropFilter: 'blur(6px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3vh 3vw',
};
const panel = {
  width: '100%', maxWidth: 1100, maxHeight: '100%', display: 'flex', flexDirection: 'column',
  background: P.deep, border: `1px solid ${P.hairStrong}`,
};
const head = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap',
  padding: '20px 24px', borderBottom: `1px solid ${P.hair}`,
};
const kicker = { fontFamily: mono, fontSize: 11, color: P.gold, letterSpacing: '0.3em' };
const title = { fontFamily: oswald, fontWeight: 700, fontSize: 30, color: P.cream, marginTop: 4 };
const meta = { fontFamily: mono, fontSize: 11, color: P.mute, letterSpacing: '0.08em', marginTop: 6 };
const list = { listStyle: 'none', margin: 0, padding: '8px 12px 16px', overflowY: 'auto' };
const row = {
  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
  borderBottom: `1px solid ${P.hair}`,
};
const num = { fontFamily: mono, fontSize: 12, color: P.faint, width: 24 };
const filmTitle = { display: 'block', fontFamily: inter, fontWeight: 600, fontSize: 16, color: P.cream, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const filmMeta = { display: 'block', fontFamily: mono, fontSize: 11, color: P.faint, letterSpacing: '0.06em', marginTop: 2 };
const btnBase = { fontFamily: mono, fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', padding: '9px 14px', cursor: 'pointer' };
const ghostBtn = { ...btnBase, background: 'transparent', color: P.mute, border: `1px solid ${P.hair}` };
const goldBtn = { ...btnBase, background: P.gold, color: P.ink, border: `1px solid ${P.gold}` };
const iconBtn = { ...ghostBtn, padding: '9px 11px' };
