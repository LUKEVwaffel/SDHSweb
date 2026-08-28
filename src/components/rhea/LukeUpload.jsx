import { useState, useRef, useCallback, useEffect } from 'react';
import AdminGate, { GATE_P as P, GATE_MONO as mono, GATE_INTER as inter } from './AdminGate';
import {
  uploadRheaPhoto, isAllowedImage, ACCEPT_ATTR, RHEA_EVENT_TITLE,
} from '../../lib/rheaComp';

const oswald = 'Oswald, sans-serif';

// ── /lukeupload — the fastest possible SD-card dump off Luke's laptop ──────
// One drop zone. No event picker, no tagging, no team selector, no nav. Every
// file lands as source='luke', visibility='staged'; all tagging happens later
// in /lukepwa. Once the batch summary says "N/N uploaded", Luke is done here.
export default function LukeUploadRoute() {
  return (
    <AdminGate label="SD CARD DUMP">
      <LukeUpload />
    </AdminGate>
  );
}

let uid = 0;
const nextId = () => `f${Date.now()}_${uid++}`;

function LukeUpload() {
  const [items, setItems] = useState([]); // {id,file,previewUrl,status:pending|uploading|done|failed,error}
  const [rejected, setRejected] = useState([]);
  const [running, setRunning] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [batchDone, setBatchDone] = useState(false);
  const inputRef = useRef(null);

  // Mirror of `items` so the async upload loop reads fresh File objects
  // without re-closing over stale state.
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);

  useEffect(() => () => { itemsRef.current.forEach((it) => URL.revokeObjectURL(it.previewUrl)); }, []); // eslint-disable-line

  const addFiles = useCallback((fileList) => {
    const files = Array.from(fileList || []);
    const ok = files.filter(isAllowedImage);
    const bad = files.filter((f) => !isAllowedImage(f));
    if (bad.length) setRejected((r) => [...r, ...bad.map((f) => f.name)]);
    if (ok.length) {
      setBatchDone(false);
      setItems((q) => [
        ...q,
        ...ok.map((file) => ({
          id: nextId(), file, previewUrl: URL.createObjectURL(file),
          status: 'pending', error: null,
        })),
      ]);
    }
  }, []);

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    if (!running) addFiles(e.dataTransfer.files);
  }

  async function runUpload(targetIds) {
    setRunning(true);
    setBatchDone(false);
    // Sequential — a laptop on event wifi should not open 50 parallel PUTs.
    for (const id of targetIds) {
      setItems((q) => q.map((it) => (it.id === id ? { ...it, status: 'uploading', error: null } : it)));
      const item = itemsRef.current.find((it) => it.id === id);
      if (!item) continue;
      try {
        await uploadRheaPhoto(item.file, { source: 'luke' });
        setItems((q) => q.map((it) => (it.id === id ? { ...it, status: 'done' } : it)));
      } catch (err) {
        setItems((q) => q.map((it) => (
          it.id === id ? { ...it, status: 'failed', error: err?.message || String(err) } : it
        )));
      }
    }
    setRunning(false);
    setBatchDone(true);
  }

  const pending = items.filter((it) => it.status === 'pending');
  const failed = items.filter((it) => it.status === 'failed');
  const done = items.filter((it) => it.status === 'done');

  function startAll() { runUpload(pending.map((it) => it.id)); }
  function retryFailed() { runUpload(failed.map((it) => it.id)); }
  function clearAll() {
    items.forEach((it) => URL.revokeObjectURL(it.previewUrl));
    setItems([]); setRejected([]); setBatchDone(false);
  }

  return (
    <div style={{ minHeight: '100vh', background: P.ink, color: P.cream, fontFamily: inter }}>
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '40px 20px 80px' }}>
        <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: '0.3em', color: P.gold }}>
          DISPATCH · OPTIC
        </div>
        <h1 style={{ fontFamily: oswald, fontSize: 30, letterSpacing: '0.05em', margin: '6px 0 2px', color: P.cream }}>
          SD CARD DUMP
        </h1>
        <div style={{ fontFamily: inter, fontSize: 13, color: P.mute }}>
          {RHEA_EVENT_TITLE} · photos land staged, tag them later in the phone app.
        </div>

        {/* Drop zone */}
        <input ref={inputRef} type="file" accept={ACCEPT_ATTR} multiple style={{ display: 'none' }}
          onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
        <div
          onClick={() => !running && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); if (!running) setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          style={{
            marginTop: 22, border: `1px dashed ${dragOver ? P.gold : P.hair}`,
            background: dragOver ? 'rgba(201,169,97,0.06)' : P.deep,
            padding: '44px 20px', textAlign: 'center', cursor: running ? 'not-allowed' : 'pointer',
            transition: 'all .15s',
          }}>
          <div style={{ fontSize: 30, color: P.gold, opacity: 0.7 }}>⤢</div>
          <div style={{ fontFamily: oswald, fontSize: 17, letterSpacing: '0.06em', marginTop: 8 }}>
            DROP THE WHOLE BATCH OR TAP TO CHOOSE
          </div>
          <div style={{ fontFamily: mono, fontSize: 9, color: P.mute, letterSpacing: '0.14em', marginTop: 8 }}>
            JPG / PNG ONLY · SELECT AS MANY AS YOU WANT
          </div>
        </div>

        {rejected.length > 0 && (
          <div style={{
            marginTop: 12, border: `1px solid ${P.red}`, background: 'rgba(192,57,43,0.08)',
            padding: '10px 12px', fontFamily: mono, fontSize: 10, color: '#E8A79E', lineHeight: 1.5,
          }}>
            SKIPPED {rejected.length} FILE{rejected.length === 1 ? '' : 'S'} — NOT JPG/PNG:
            <div style={{ color: P.mute, marginTop: 4, wordBreak: 'break-all' }}>{rejected.join(', ')}</div>
          </div>
        )}

        {/* Action bar */}
        {items.length > 0 && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 18 }}>
            {pending.length > 0 && !running && (
              <button onClick={startAll} style={goldBtn}>
                UPLOAD {pending.length} PHOTO{pending.length === 1 ? '' : 'S'}
              </button>
            )}
            {running && <span style={{ fontFamily: mono, fontSize: 10, color: P.gold, letterSpacing: '0.16em' }}>
              UPLOADING… {done.length + failed.length} / {items.length}
            </span>}
            {!running && failed.length > 0 && (
              <button onClick={retryFailed} style={goldBtn}>RETRY {failed.length} FAILED</button>
            )}
            {!running && <button onClick={clearAll} style={ghostBtn}>CLEAR</button>}
          </div>
        )}

        {/* Batch summary */}
        {batchDone && !running && items.length > 0 && (
          <div style={{
            marginTop: 16, border: `1px solid ${failed.length ? P.red : P.gold}`,
            background: failed.length ? 'rgba(192,57,43,0.08)' : 'rgba(201,169,97,0.08)',
            padding: '12px 14px', fontFamily: mono, fontSize: 12, letterSpacing: '0.08em',
            color: failed.length ? '#E8A79E' : P.bright,
          }}>
            {failed.length
              ? `${done.length}/${items.length} UPLOADED · ${failed.length} FAILED — RETRY ABOVE`
              : `${done.length}/${items.length} UPLOADED SUCCESSFULLY — DONE ON THIS LAPTOP`}
          </div>
        )}

        {/* Per-file grid */}
        {items.length > 0 && (
          <div style={{
            marginTop: 18, display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10,
          }}>
            {items.map((it) => (
              <div key={it.id} style={{ border: `1px solid ${statusColor(it.status)}`, background: P.deep }}>
                <div style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', overflow: 'hidden' }}>
                  <img src={it.previewUrl} alt="" style={{
                    width: '100%', height: '100%', objectFit: 'cover',
                    opacity: it.status === 'failed' ? 0.4 : 1,
                  }} />
                  {it.status === 'uploading' && (
                    <div style={badge}>UP…</div>
                  )}
                  {it.status === 'done' && <div style={{ ...badge, color: P.bright }}>✓</div>}
                  {it.status === 'failed' && <div style={{ ...badge, color: '#E8A79E' }}>✕</div>}
                </div>
                <div style={{
                  fontFamily: mono, fontSize: 8, color: P.mute, padding: '5px 6px',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }} title={it.error || it.file.name}>
                  {it.status === 'failed' ? (it.error || 'failed') : it.file.name}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function statusColor(s) {
  return s === 'done' ? P.gold : s === 'failed' ? P.red : s === 'uploading' ? P.bright : P.hair;
}
const badge = {
  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(6,16,31,0.55)', fontFamily: mono, fontSize: 13, letterSpacing: '0.1em', color: P.gold,
};
const goldBtn = {
  background: P.gold, color: P.ink, border: 'none', cursor: 'pointer',
  fontFamily: mono, fontSize: 10, letterSpacing: '0.16em', fontWeight: 600, padding: '11px 16px',
};
const ghostBtn = {
  background: 'transparent', border: `1px solid ${P.hair}`, color: P.mute, cursor: 'pointer',
  fontFamily: mono, fontSize: 10, letterSpacing: '0.16em', padding: '11px 16px',
};
