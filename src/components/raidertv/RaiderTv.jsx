import { useState, useEffect, useRef } from 'react';
import { supabase as SB } from '../../lib/supabaseClient';
import { P, mono, fraunces, inter, fs, sp } from '../admin/theme.js';
import { useRaiderTvState } from '../../hooks/useRaiderTvState.js';
import { useRaiderVideos } from '../../hooks/useRaiderVideos.js';
import { useQrDataUrl } from './useQrDataUrl.js';
import {
  makeCode, videoUrl, fmtTime, isConnected, sendTvStatus,
} from '../../lib/raiderTv.js';
import TvRefreshNotice from '../tv/TvRefreshNotice.jsx';

// /raidertv — the display. Creates a session on load, shows a 6-char PAIR
// CODE + QR, and becomes a dumb fullscreen <video> that the phone at
// /raiderremote drives. This screen never has its own controls; it only
// reconciles the <video> element to whatever the session row says and
// heartbeats its real playback position back every second.
//
// Self-contained full-screen anon route (App.jsx bypass), same pattern as
// /tv, /tv/range and /raiderparent.

const LS_KEY = 'raiderTvSessionId';
const HEARTBEAT_MS = 1000;

async function ensureSession() {
  const saved = localStorage.getItem(LS_KEY);
  if (saved) {
    const { data } = await SB.from('raider_tv_sessions').select('id, code').eq('id', saved).maybeSingle();
    if (data) return data;
    localStorage.removeItem(LS_KEY);
  }
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = makeCode();
    // eslint-disable-next-line no-await-in-loop
    const { data, error } = await SB.from('raider_tv_sessions').insert({ code }).select('id, code').single();
    if (!error && data) {
      localStorage.setItem(LS_KEY, data.id);
      return data;
    }
    // Unique-code collision (23505) or a transient error — try a fresh code.
  }
  throw new Error('Could not open a Raider TV session.');
}

export default function RaiderTv() {
  const [sess, setSess] = useState(null); // { id, code }
  const [failed, setFailed] = useState(false);
  const { session } = useRaiderTvState(sess?.id);
  const { videos } = useRaiderVideos();

  const videoRef = useRef(null);
  const sessionRef = useRef(null);
  const lastCmd = useRef(null);
  const lastVideoId = useRef(undefined);
  const pendingSeek = useRef(null);

  sessionRef.current = session;

  const activeVideo = session?.video_id ? videos.find((v) => v.id === session.video_id) || null : null;
  const remoteUrl = sess?.code
    ? `${window.location.origin}/raiderremote?code=${sess.code}`
    : null;
  const qr = useQrDataUrl(remoteUrl);

  useEffect(() => {
    ensureSession().then(setSess).catch(() => setFailed(true));
  }, []);

  // ── Reconcile the <video> element to the session row ──────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !session) return;

    // Source swap
    if (session.video_id !== lastVideoId.current) {
      lastVideoId.current = session.video_id;
      const next = session.video_id ? videos.find((x) => x.id === session.video_id) || null : null;
      if (next) {
        v.src = videoUrl(next.storage_path);
        pendingSeek.current = 0;
        v.load();
      } else {
        v.removeAttribute('src');
        v.load();
      }
    }

    // Rate
    const rate = Number(session.rate) || 1;
    if (v.playbackRate !== rate) v.playbackRate = rate;

    // Seek — only when a new command carries a target
    if (session.command_id && session.command_id !== lastCmd.current) {
      lastCmd.current = session.command_id;
      if (session.seek_to_sec != null && Number.isFinite(+session.seek_to_sec)) {
        const t = +session.seek_to_sec;
        pendingSeek.current = t;
        if (v.readyState >= 1 && Math.abs(v.currentTime - t) > 0.03) {
          try { v.currentTime = t; } catch { /* metadata not ready yet — handled on loadedmetadata */ }
        }
      }
    }

    // Play / pause
    if (session.video_id) {
      if (session.playing && v.paused) v.play().catch(() => {});
      if (!session.playing && !v.paused) v.pause();
    }
  }, [session, videos]);

  // ── <video> element listeners (read session from a ref — handlers outlive renders) ──
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return undefined;

    const onLoadedMetadata = () => {
      const s = sessionRef.current;
      if (pendingSeek.current != null && Number.isFinite(pendingSeek.current)) {
        try { v.currentTime = pendingSeek.current; } catch { /* noop */ }
      }
      if (s) {
        v.playbackRate = Number(s.rate) || 1;
        if (s.playing) v.play().catch(() => {});
      }
    };

    const onTimeUpdate = () => {
      const s = sessionRef.current;
      if (!s || !s.loop) return;
      const a = s.ab_start_sec;
      const b = s.ab_end_sec;
      if (a != null && b != null && b > a && v.currentTime >= b) {
        try { v.currentTime = a; } catch { /* noop */ }
      }
    };

    const onEnded = () => {
      const s = sessionRef.current;
      if (s?.loop) {
        try { v.currentTime = s.ab_start_sec ?? 0; } catch { /* noop */ }
        v.play().catch(() => {});
      }
    };

    v.addEventListener('loadedmetadata', onLoadedMetadata);
    v.addEventListener('timeupdate', onTimeUpdate);
    v.addEventListener('ended', onEnded);
    return () => {
      v.removeEventListener('loadedmetadata', onLoadedMetadata);
      v.removeEventListener('timeupdate', onTimeUpdate);
      v.removeEventListener('ended', onEnded);
    };
  }, []);

  // ── Heartbeat: real playback position -> session row ──────────────────────
  useEffect(() => {
    if (!sess?.id) return undefined;
    const tick = () => {
      const v = videoRef.current;
      sendTvStatus(sess.id, {
        tv_position_sec: v && Number.isFinite(v.currentTime) ? v.currentTime : 0,
        tv_duration_sec: v && Number.isFinite(v.duration) ? v.duration : null,
        tv_ready: !!(v && v.readyState >= 2),
      });
    };
    tick();
    const id = setInterval(tick, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [sess?.id]);

  const paired = isConnected(session, 'remote');
  const rate = Number(session?.rate) || 1;
  const hasAb = session?.ab_start_sec != null && session?.ab_end_sec != null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', fontFamily: inter, overflow: 'hidden' }}>
      <video
        ref={videoRef}
        muted
        playsInline
        style={{
          width: '100%', height: '100%', objectFit: 'contain', background: '#000',
          display: session?.video_id ? 'block' : 'none',
        }}
      />

      {/* Idle / pairing screen — shown until a video is loaded */}
      {!session?.video_id && (
        <div style={{
          position: 'absolute', inset: 0, background: P.ink,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: sp[8],
          padding: '6vh 6vw', textAlign: 'center',
        }}>
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.4,
            backgroundImage: `linear-gradient(${P.hair} 1px, transparent 1px), linear-gradient(90deg, ${P.hair} 1px, transparent 1px)`,
            backgroundSize: '64px 64px',
            maskImage: 'radial-gradient(ellipse 75% 70% at 50% 50%, black 0%, transparent 78%)',
            WebkitMaskImage: 'radial-gradient(ellipse 75% 70% at 50% 50%, black 0%, transparent 78%)',
          }} />
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: sp[3] }}>
            <div style={{ fontFamily: mono, fontSize: 'clamp(14px,1.7vh,20px)', letterSpacing: '0.34em', color: P.gold, textTransform: 'uppercase' }}>
              Raider Film Review
            </div>
            <h1 style={{
              margin: 0, fontFamily: fraunces, fontWeight: 700, fontStyle: 'italic', color: P.cream,
              fontSize: 'clamp(48px,9vh,130px)', lineHeight: 0.95,
            }}>
              Raider&nbsp;TV
            </h1>
          </div>

          {failed ? (
            <div style={{ position: 'relative', fontFamily: mono, fontSize: fs.md, color: P.red, maxWidth: 520, lineHeight: 1.6 }}>
              Could not open a session. Refresh this page — if it keeps failing, the raider_tv.sql migration may not be run yet.
            </div>
          ) : !sess ? (
            <div style={{ position: 'relative', fontFamily: mono, fontSize: fs.sm, letterSpacing: '0.2em', color: P.mute }}>
              STARTING SESSION…
            </div>
          ) : (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '5vw', flexWrap: 'wrap', justifyContent: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: sp[3] }}>
                <div style={{ fontFamily: mono, fontSize: 'clamp(11px,1.4vh,15px)', letterSpacing: '0.28em', color: P.mute, textTransform: 'uppercase' }}>
                  Pair code
                </div>
                <div style={{
                  fontFamily: mono, fontWeight: 700, color: P.cream,
                  fontSize: 'clamp(52px,11vh,150px)', letterSpacing: '0.12em', lineHeight: 1,
                  padding: `${sp[4]}px ${sp[6]}px`, border: `2px solid ${P.hairStrong}`, borderRadius: 16,
                  background: P.deep, boxShadow: '0 18px 44px rgba(0,0,0,0.45)',
                }}>
                  {sess.code}
                </div>
                <div style={{ fontFamily: inter, fontSize: 'clamp(13px,1.7vh,19px)', color: P.mute, maxWidth: 420, lineHeight: 1.55 }}>
                  On your phone open <b style={{ color: P.gold }}>{window.location.host}/raiderremote</b> and enter this code, or scan &rarr;
                </div>
              </div>

              {qr && (
                <div style={{
                  width: 'min(34vh,300px)', aspectRatio: '1 / 1', background: P.cream, borderRadius: 14, overflow: 'hidden',
                  boxShadow: `0 18px 44px rgba(0,0,0,0.45), 0 0 0 1px ${P.hairStrong}`,
                }}>
                  <img src={qr} alt="Scan to open the Raider TV remote" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                </div>
              )}
            </div>
          )}

          {sess && !failed && (
            <div style={{
              position: 'relative', fontFamily: mono, fontSize: fs.tiny, letterSpacing: '0.16em',
              color: paired ? P.green : P.faint, textTransform: 'uppercase',
              display: 'flex', alignItems: 'center', gap: sp[2],
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: paired ? P.green : P.faint }} />
              {paired ? 'Remote paired' : 'Waiting for remote'}
            </div>
          )}
        </div>
      )}

      {/* Persistent corner chip once a video is loaded — lets a second phone rejoin */}
      {session?.video_id && sess && (
        <div style={{
          position: 'absolute', top: 18, right: 20, display: 'flex', alignItems: 'center', gap: sp[3],
          fontFamily: mono, fontSize: fs.tiny, letterSpacing: '0.16em', color: P.cream,
          background: 'rgba(6,16,31,0.7)', border: `1px solid ${P.hair}`, borderRadius: 8,
          padding: `${sp[2]}px ${sp[3]}px`, backdropFilter: 'blur(4px)',
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: paired ? P.green : P.faint }} />
          CODE {sess.code}
        </div>
      )}

      {/* Now-playing badges */}
      {session?.video_id && (
        <div style={{
          position: 'absolute', left: 22, bottom: 20, display: 'flex', alignItems: 'center', gap: sp[3],
          fontFamily: mono, fontSize: fs.xs, color: P.cream,
        }}>
          <span style={{
            background: 'rgba(6,16,31,0.7)', border: `1px solid ${P.hair}`, borderRadius: 8,
            padding: `${sp[2]}px ${sp[3]}px`, letterSpacing: '0.08em', maxWidth: '60vw',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {activeVideo?.title || 'Video'}
          </span>
          {rate !== 1 && (
            <span style={{ background: P.gold, color: P.ink, borderRadius: 8, padding: `${sp[2]}px ${sp[3]}px`, fontWeight: 700 }}>
              {rate}&times;
            </span>
          )}
          {session.loop && (
            <span style={{ background: 'rgba(6,16,31,0.7)', border: `1px solid ${P.hair}`, borderRadius: 8, padding: `${sp[2]}px ${sp[3]}px` }}>
              {hasAb ? `A–B ${fmtTime(session.ab_start_sec)}/${fmtTime(session.ab_end_sec)}` : 'LOOP'}
            </span>
          )}
        </div>
      )}

      <TvRefreshNotice />
    </div>
  );
}
