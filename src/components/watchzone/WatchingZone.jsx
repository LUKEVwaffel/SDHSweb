import { useEffect, useMemo, useRef, useState } from 'react';
import { P, mono, fraunces, inter, fs, sp, radius, shadow, ease } from '../admin/theme.js';
import { useRaiderVideos } from '../../hooks/useRaiderVideos.js';
import { videoUrl, fmtTime, SPEED_PRESETS } from '../../lib/raiderTv.js';

// /watchzone — public Raider film archive. No pairing, no remote: pick a clip,
// watch it. Native fullscreen + a slow-mo speed rail (the OC footage is shot
// at high frame rate specifically so it holds up slowed down).
//
// Reuses the same raider_videos library DISPATCH's Raider TV panel manages —
// that table has always been anon-readable (the /raidertv display reads it
// the same way). This just orders the list newest-first instead of by the
// coaching sort_order, so a fresh upload is what a visitor sees first.
//
// Self-contained full-screen anon route (App.jsx bypass), same pattern as
// /raidertv.

function getFullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

// Curated allowlist — the coaching library (raider_videos) has years of
// practice clips DISPATCH manages; this public page only ever shows what's
// explicitly featured here. Add an id to feature another clip.
const FEATURED_IDS = new Set([
  '86839e28-6160-42d0-9d49-46adca8c345a', // OC — Part 1
  '3252c9a8-6e2f-4578-8649-70d184f0029e', // OC — Part 2
]);

export default function WatchingZone() {
  const { videos: allVideos, loading } = useRaiderVideos();
  const videos = useMemo(() => allVideos.filter((v) => FEATURED_IDS.has(v.id)), [allVideos]);
  const [activeId, setActiveId] = useState(null);
  const [rate, setRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const stageRef = useRef(null);
  const videoRef = useRef(null);

  const ordered = useMemo(
    () => [...videos].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [videos],
  );

  useEffect(() => {
    if (!ordered.length) return;
    if (!activeId || !ordered.some((v) => v.id === activeId)) setActiveId(ordered[0].id);
  }, [ordered, activeId]);

  const active = ordered.find((v) => v.id === activeId) || null;

  // New clip loaded — reset speed to normal.
  useEffect(() => { setRate(1); }, [activeId]);

  useEffect(() => {
    const v = videoRef.current;
    if (v) v.playbackRate = rate;
  }, [rate, activeId]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(getFullscreenElement() === stageRef.current);
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  function toggleFullscreen() {
    const el = stageRef.current;
    if (!el) return;
    if (getFullscreenElement()) {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
    } else {
      (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: P.ink, fontFamily: inter }}>
      <div style={{
        position: 'sticky', top: 0, zIndex: 5, background: 'rgba(6,16,31,0.92)',
        backdropFilter: 'blur(6px)', borderBottom: `1px solid ${P.hair}`,
        padding: `${sp[4]}px ${sp[5]}px`, display: 'flex', alignItems: 'baseline', gap: sp[3], flexWrap: 'wrap',
      }}>
        <a href="/" style={{
          fontFamily: mono, fontSize: fs.tiny, letterSpacing: '0.2em', color: P.mute, textDecoration: 'none',
        }}>&larr; TROJAN BATTALION</a>
        <div style={{
          fontFamily: mono, fontSize: fs.tiny, letterSpacing: '0.3em', color: P.gold, textTransform: 'uppercase',
        }}>Watching Zone</div>
        <h1 style={{
          margin: '0 0 0 auto', fontFamily: fraunces, fontStyle: 'italic', fontWeight: 700, color: P.cream,
          fontSize: 'clamp(20px,2.6vw,30px)',
        }}>
          Raider Film
        </h1>
      </div>

      <div style={{
        maxWidth: 1240, margin: '0 auto', padding: `${sp[6]}px ${sp[5]}px ${sp[16]}px`,
        display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: sp[6],
      }}>
        {/* Stage */}
        <div>
          <div
            ref={stageRef}
            style={{
              position: 'relative', width: '100%', aspectRatio: '16/9', background: '#000',
              borderRadius: isFullscreen ? 0 : radius.lg, overflow: 'hidden',
              boxShadow: shadow.lg, border: `1px solid ${P.hairStrong}`,
            }}
          >
            {active ? (
              <video
                key={active.id}
                ref={videoRef}
                src={videoUrl(active.storage_path)}
                controls
                playsInline
                onLoadedMetadata={() => { if (videoRef.current) videoRef.current.playbackRate = rate; }}
                style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', background: '#000' }}
              />
            ) : (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: mono, fontSize: fs.sm, letterSpacing: '0.2em', color: P.faint, textTransform: 'uppercase',
              }}>
                {loading ? 'LOADING…' : 'NO FILM YET'}
              </div>
            )}

            {active && (
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}
                style={{
                  position: 'absolute', top: sp[3], right: sp[3], zIndex: 2,
                  width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(6,16,31,0.72)', border: `1px solid ${P.hair}`, borderRadius: radius.sm,
                  color: P.cream, cursor: 'pointer', backdropFilter: 'blur(4px)',
                }}
              >
                {isFullscreen ? <ShrinkIcon /> : <ExpandIcon />}
              </button>
            )}
          </div>

          {active && (
            <>
              <div style={{ marginTop: sp[4], display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: sp[3], flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontFamily: fraunces, fontWeight: 700, color: P.cream, fontSize: fs.xl }}>
                  {active.title}
                </h2>
                {active.duration_sec ? (
                  <span style={{ fontFamily: mono, fontSize: fs.tiny, color: P.faint, letterSpacing: '0.12em' }}>
                    {fmtTime(active.duration_sec)}
                  </span>
                ) : null}
              </div>

              {/* Slow-mo rail */}
              <div style={{ marginTop: sp[5] }}>
                <div style={{ fontFamily: mono, fontSize: fs.micro, letterSpacing: '0.24em', color: P.mute, textTransform: 'uppercase', marginBottom: sp[2] }}>
                  Slow&nbsp;Motion
                </div>
                <div style={{ display: 'flex', gap: sp[2], flexWrap: 'wrap' }}>
                  {SPEED_PRESETS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setRate(s)}
                      style={{
                        fontFamily: mono, fontSize: fs.xs, fontWeight: 700, letterSpacing: '0.06em',
                        padding: `${sp[2]}px ${sp[3]}px`, borderRadius: radius.sm, cursor: 'pointer',
                        border: `1px solid ${rate === s ? P.gold : P.hair}`,
                        background: rate === s ? P.gold : 'transparent',
                        color: rate === s ? P.ink : P.mute,
                        transition: `background ${'0.15s'} ${ease}`,
                      }}
                    >
                      {s}&times;
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Library */}
        <div>
          <div style={{ fontFamily: mono, fontSize: fs.micro, letterSpacing: '0.24em', color: P.mute, textTransform: 'uppercase', marginBottom: sp[3] }}>
            {ordered.length ? `${ordered.length} clip${ordered.length === 1 ? '' : 's'}` : 'LIBRARY'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: sp[2] }}>
            {ordered.map((v) => {
              const isActive = v.id === activeId;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setActiveId(v.id)}
                  style={{
                    textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 4,
                    padding: `${sp[3]}px ${sp[4]}px`, borderRadius: radius.md, cursor: 'pointer',
                    border: `1px solid ${isActive ? P.gold : P.hair}`,
                    background: isActive ? P.goldWash : P.deep,
                  }}
                >
                  <span style={{
                    fontFamily: inter, fontSize: fs.sm, fontWeight: 600, color: isActive ? P.bright : P.cream,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {v.title}
                  </span>
                  <span style={{ fontFamily: mono, fontSize: fs.micro, color: P.faint, letterSpacing: '0.08em' }}>
                    {v.duration_sec ? fmtTime(v.duration_sec) : 'unknown length'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function ExpandIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />
    </svg>
  );
}

function ShrinkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M9 3v5H4M15 3v5h5M9 21v-5H4M15 21v-5h5" />
    </svg>
  );
}
