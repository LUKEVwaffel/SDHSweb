import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase as SB } from '../../lib/supabaseClient';
import { P, mono, fraunces, inter, fs, sp } from '../admin/theme.js';
import { useRaiderTvState } from '../../hooks/useRaiderTvState.js';
import { useRaiderVideos } from '../../hooks/useRaiderVideos.js';
import {
  SPEED_PRESETS, FRAME_SEC, SKIP_SMALL, SKIP_LARGE,
  normalizeCode, CODE_LEN, fmtTime, clamp, estPosition, isConnected, sendRemoteIntent,
} from '../../lib/raiderTv.js';

// /raiderremote — the phone control surface. Enter the pair code shown on
// /raidertv, then drive playback. This screen holds no <video>; it only
// writes the session row's intent columns and reads the TV's reported
// position back. Self-contained full-screen anon route (App.jsx bypass).

const LS_KEY = 'raiderRemoteSession';
const DRAG_SEND_MS = 150;

function loadSaved() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export default function RaiderRemote() {
  const [sess, setSess] = useState(loadSaved); // { id, code }
  const { session, missing } = useRaiderTvState(sess?.id);
  const { videos, loading: videosLoading } = useRaiderVideos();

  // Drop back to the code screen if the session was swept out from under us.
  useEffect(() => {
    if (sess && missing) {
      localStorage.removeItem(LS_KEY);
      setSess(null);
    }
  }, [sess, missing]);

  const onPaired = useCallback((row) => {
    const next = { id: row.id, code: row.code };
    localStorage.setItem(LS_KEY, JSON.stringify(next));
    setSess(next);
  }, []);

  const onUnpair = useCallback(() => {
    localStorage.removeItem(LS_KEY);
    setSess(null);
  }, []);

  if (!sess) return <CodeScreen onPaired={onPaired} />;

  return (
    <ControlScreen
      sess={sess}
      session={session}
      videos={videos}
      videosLoading={videosLoading}
      onUnpair={onUnpair}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function CodeScreen({ onPaired }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = useCallback(async (raw) => {
    const c = normalizeCode(raw);
    if (c.length !== CODE_LEN) { setError(`Enter all ${CODE_LEN} characters.`); return; }
    setBusy(true);
    setError('');
    const { data } = await SB.from('raider_tv_sessions').select('id, code').eq('code', c).maybeSingle();
    setBusy(false);
    if (data) onPaired(data);
    else setError('No TV with that code. Check the screen and try again.');
  }, [onPaired]);

  // Auto-join when arriving from the QR link (/raiderremote?code=XXXXXX).
  useEffect(() => {
    const q = normalizeCode(new URLSearchParams(window.location.search).get('code') || '');
    if (q.length === CODE_LEN) { setCode(q); submit(q); }
  }, [submit]);

  return (
    <div style={shell}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: sp[3], marginTop: '14vh' }}>
        <div style={{ fontFamily: mono, fontSize: fs.tiny, letterSpacing: '0.3em', color: P.gold, textTransform: 'uppercase' }}>
          Raider Film Review
        </div>
        <h1 style={{ margin: 0, fontFamily: fraunces, fontWeight: 700, fontStyle: 'italic', color: P.cream, fontSize: 40 }}>
          Remote
        </h1>
      </div>

      <div style={{ marginTop: sp[10], width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: sp[4] }}>
        <label style={{ fontFamily: mono, fontSize: fs.tiny, letterSpacing: '0.2em', color: P.mute, textTransform: 'uppercase' }}>
          Pair code from the TV
        </label>
        <input
          value={code}
          onChange={(e) => { setCode(normalizeCode(e.target.value)); setError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(code); }}
          inputMode="text"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          placeholder="XXXXXX"
          maxLength={CODE_LEN}
          style={{
            width: '100%', background: P.deep, border: `1px solid ${error ? P.red : P.hairStrong}`, color: P.cream,
            fontFamily: mono, fontSize: 34, letterSpacing: '0.4em', textAlign: 'center', textTransform: 'uppercase',
            padding: `${sp[4]}px ${sp[3]}px`, borderRadius: 12, outline: 'none', boxSizing: 'border-box',
          }}
        />
        {error && <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.red }}>{error}</div>}
        <button onClick={() => submit(code)} disabled={busy} style={{ ...bigBtn(true), opacity: busy ? 0.5 : 1 }}>
          {busy ? 'CONNECTING…' : 'CONNECT'}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function ControlScreen({ sess, session, videos, videosLoading, onUnpair }) {
  const [drag, setDrag] = useState(null); // number while scrubbing, else null
  const lastDragSend = useRef(0);
  const dragClearTimer = useRef(null);

  const tvOnline = isConnected(session, 'tv');
  const activeId = session?.video_id || null;
  const dur = Number(session?.tv_duration_sec) || 0;
  const livePos = estPosition(session);
  const shownPos = drag != null ? drag : livePos;
  const canControl = !!activeId && tvOnline;
  const rate = Number(session?.rate) || 1;

  useEffect(() => () => clearTimeout(dragClearTimer.current), []);

  const intent = useCallback((patch) => {
    if (!sess?.id) return;
    sendRemoteIntent(sess.id, patch);
  }, [sess?.id]);

  const seekTo = useCallback((t) => {
    intent({ seek_to_sec: clamp(t, 0, dur || t) });
  }, [intent, dur]);

  const nudge = useCallback((delta, pause) => {
    const base = estPosition(session);
    const patch = { seek_to_sec: clamp(base + delta, 0, dur || base + delta) };
    if (pause) patch.playing = false;
    intent(patch);
  }, [intent, session, dur]);

  const loadVideo = useCallback((v) => {
    intent({
      video_id: v.id, playing: true, seek_to_sec: 0, rate: 1,
      loop: false, ab_start_sec: null, ab_end_sec: null,
    });
  }, [intent]);

  const onScrub = (e) => {
    const val = Number(e.target.value);
    setDrag(val);
    const now = Date.now();
    if (now - lastDragSend.current > DRAG_SEND_MS) {
      lastDragSend.current = now;
      intent({ seek_to_sec: val });
    }
  };
  const endScrub = (e) => {
    const val = Number(e.target.value);
    intent({ seek_to_sec: val });
    clearTimeout(dragClearTimer.current);
    dragClearTimer.current = setTimeout(() => setDrag(null), 900);
  };

  const hasA = session?.ab_start_sec != null;
  const hasB = session?.ab_end_sec != null;

  // Native <button disabled> + inline styles don't dim on their own.
  const B = ({ style, disabled, ...rest }) => (
    <button {...rest} disabled={disabled} style={{ ...ctrlBtn, ...style, opacity: disabled ? 0.38 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }} />
  );

  return (
    <div style={{ ...shell, justifyContent: 'flex-start', paddingBottom: 0 }}>
      {/* header */}
      <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: sp[3] }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: sp[2], fontFamily: mono, fontSize: fs.tiny, letterSpacing: '0.14em', color: tvOnline ? P.green : P.red }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: tvOnline ? P.green : P.red }} />
          {tvOnline ? `PAIRED · ${sess.code}` : 'TV OFFLINE'}
        </div>
        <button onClick={onUnpair} style={miniBtn}>UNPAIR</button>
      </div>

      {!tvOnline && (
        <div style={{ width: '100%', fontFamily: mono, fontSize: fs.tiny, color: P.mute, marginTop: sp[2], lineHeight: 1.5 }}>
          No heartbeat from the TV. Make sure /raidertv is open and showing this code.
        </div>
      )}

      {/* video list */}
      <div style={{ width: '100%', flex: 1, overflowY: 'auto', marginTop: sp[4], WebkitOverflowScrolling: 'touch' }}>
        <div style={{ fontFamily: mono, fontSize: fs.tiny, letterSpacing: '0.2em', color: P.mute, textTransform: 'uppercase', marginBottom: sp[2] }}>
          {videosLoading ? 'Loading videos…' : `${videos.length} video${videos.length === 1 ? '' : 's'}`}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: sp[2] }}>
          {videos.map((v) => {
            const on = v.id === activeId;
            return (
              <button
                key={v.id}
                onClick={() => loadVideo(v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: sp[3], textAlign: 'left', width: '100%',
                  background: on ? P.navy : P.deep, border: `1px solid ${on ? P.gold : P.hair}`, borderRadius: 10,
                  color: P.cream, fontFamily: inter, fontSize: fs.sm, padding: `${sp[3]}px ${sp[4]}px`, cursor: 'pointer',
                }}
              >
                <span style={{ fontFamily: mono, fontSize: fs.md, color: on ? P.gold : P.faint }}>{on ? '▶' : '▷'}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title}</span>
                {v.duration_sec ? (
                  <span style={{ fontFamily: mono, fontSize: fs.tiny, color: P.faint }}>{fmtTime(v.duration_sec)}</span>
                ) : null}
              </button>
            );
          })}
          {!videosLoading && videos.length === 0 && (
            <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.faint, padding: sp[4], textAlign: 'center' }}>
              No videos uploaded yet. Add them in DISPATCH → Raider TV.
            </div>
          )}
        </div>
      </div>

      {/* transport dock */}
      <div style={{
        width: '100%', background: P.ink, borderTop: `1px solid ${P.hair}`, paddingTop: sp[3],
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)', display: 'flex', flexDirection: 'column', gap: sp[3],
      }}>
        {/* scrubber */}
        <div style={{ display: 'flex', alignItems: 'center', gap: sp[3], fontFamily: mono, fontSize: fs.tiny, color: P.mute }}>
          <span>{fmtTime(shownPos)}</span>
          <input
            type="range" min={0} max={dur || 1} step={0.05} value={Math.min(shownPos, dur || 1)}
            onChange={onScrub} onPointerUp={endScrub} onTouchEnd={endScrub} onMouseUp={endScrub}
            disabled={!canControl || !dur}
            style={{ flex: 1, accentColor: P.gold }}
          />
          <span>{fmtTime(dur)}</span>
        </div>

        {/* skip + play row */}
        <div style={{ display: 'flex', gap: sp[2] }}>
          <B disabled={!canControl} onClick={() => nudge(-SKIP_LARGE)}>-10s</B>
          <B disabled={!canControl} onClick={() => nudge(-SKIP_SMALL)}>-1s</B>
          <B style={{ flex: 1.6, background: P.gold, color: P.ink, borderColor: P.gold, fontWeight: 700 }}
            disabled={!canControl} onClick={() => intent({ playing: !session?.playing })}>
            {session?.playing ? 'PAUSE' : 'PLAY'}
          </B>
          <B disabled={!canControl} onClick={() => nudge(SKIP_SMALL)}>+1s</B>
          <B disabled={!canControl} onClick={() => nudge(SKIP_LARGE)}>+10s</B>
        </div>

        {/* frame step + jump to start */}
        <div style={{ display: 'flex', gap: sp[2] }}>
          <B disabled={!canControl} onClick={() => nudge(-FRAME_SEC, true)}>◀ FRAME</B>
          <B disabled={!canControl} onClick={() => seekTo(0)}>⏮ START</B>
          <B disabled={!canControl} onClick={() => nudge(FRAME_SEC, true)}>FRAME ▶</B>
        </div>

        {/* speed */}
        <div style={{ display: 'flex', gap: sp[1], flexWrap: 'wrap' }}>
          {SPEED_PRESETS.map((s) => (
            <B
              key={s}
              disabled={!canControl}
              onClick={() => intent({ rate: s })}
              style={{
                flex: '1 0 12%', padding: `${sp[2]}px 0`,
                background: rate === s ? P.gold : P.deep, color: rate === s ? P.ink : P.cream,
                borderColor: rate === s ? P.gold : P.hair, fontWeight: rate === s ? 700 : 400,
              }}
            >
              {s}×
            </B>
          ))}
        </div>

        {/* loop + A/B */}
        <div style={{ display: 'flex', gap: sp[2] }}>
          <B
            style={{ background: session?.loop && !hasA ? P.gold : P.deep, color: session?.loop && !hasA ? P.ink : P.cream, borderColor: session?.loop && !hasA ? P.gold : P.hair }}
            disabled={!canControl}
            onClick={() => intent({ loop: !session?.loop, ab_start_sec: null, ab_end_sec: null })}
          >
            {session?.loop && !hasA ? 'LOOP ON' : 'LOOP'}
          </B>
          <B style={{ background: hasA ? P.navy : P.deep, borderColor: hasA ? P.gold : P.hair }}
            disabled={!canControl} onClick={() => intent({ ab_start_sec: estPosition(session), loop: true })}>
            SET A{hasA ? ` ${fmtTime(session.ab_start_sec)}` : ''}
          </B>
          <B style={{ background: hasB ? P.navy : P.deep, borderColor: hasB ? P.gold : P.hair }}
            disabled={!canControl} onClick={() => intent({ ab_end_sec: estPosition(session), loop: true })}>
            SET B{hasB ? ` ${fmtTime(session.ab_end_sec)}` : ''}
          </B>
          <B disabled={!canControl || (!hasA && !hasB)}
            onClick={() => intent({ ab_start_sec: null, ab_end_sec: null, loop: false })}>
            CLEAR
          </B>
        </div>
      </div>
    </div>
  );
}

// ── styles ───────────────────────────────────────────────────────────────────
const shell = {
  position: 'fixed', inset: 0, background: P.ink, color: P.cream, fontFamily: inter,
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  padding: '0 16px 20px', boxSizing: 'border-box', overflow: 'hidden',
};

function bigBtn(primary) {
  return {
    width: '100%', padding: `${sp[4]}px`, borderRadius: 12, cursor: 'pointer',
    fontFamily: mono, fontSize: fs.sm, letterSpacing: '0.16em', fontWeight: 700,
    background: primary ? P.gold : P.deep, color: primary ? P.ink : P.cream,
    border: `1px solid ${primary ? P.gold : P.hairStrong}`,
  };
}

const ctrlBtn = {
  flex: 1, minHeight: 46, borderRadius: 9, cursor: 'pointer',
  fontFamily: mono, fontSize: fs.tiny, letterSpacing: '0.08em',
  background: P.deep, color: P.cream, border: `1px solid ${P.hair}`,
};

const miniBtn = {
  fontFamily: mono, fontSize: fs.tiny, letterSpacing: '0.12em', color: P.mute,
  background: 'transparent', border: `1px solid ${P.hair}`, borderRadius: 7,
  padding: `${sp[1]}px ${sp[3]}px`, cursor: 'pointer',
};
