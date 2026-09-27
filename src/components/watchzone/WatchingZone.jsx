import { useEffect, useMemo, useRef, useState } from 'react';
import { P, mono, fraunces, inter, fs, sp, radius, shadow, ease } from '../admin/theme.js';
import { useRaiderVideos } from '../../hooks/useRaiderVideos.js';
import { videoUrl, fmtTime, SPEED_PRESETS } from '../../lib/raiderTv.js';
import { buildFilms, categoriesIn } from '../../lib/raiderFilm.js';

// /watchzone — public Raider film archive, desktop + mobile. No pairing, no
// remote: pick a film, watch it. Native fullscreen + a slow-mo speed rail
// (much of the footage is 120fps specifically so it holds up slowed down).
//
// Reads the same raider_videos library DISPATCH's Raider TV panel manages
// (anon-readable). Multi-part uploads collapse into one film via
// buildFilms(); parts auto-advance. Audio-restricted films are forced muted.
//
// Self-contained full-screen anon route (App.jsx bypass), same pattern as
// /raidertv.

function getFullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

export default function WatchingZone() {
  const { videos, loading } = useRaiderVideos();
  const films = useMemo(() => buildFilms(videos), [videos]);
  const categories = useMemo(() => categoriesIn(films), [films]);

  const [category, setCategory] = useState('all');
  const [activeKey, setActiveKey] = useState(null);
  const [partIdx, setPartIdx] = useState(0);
  const [rate, setRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const stageRef = useRef(null);
  const videoRef = useRef(null);

  const shown = useMemo(
    () => (category === 'all' ? films : films.filter((f) => f.category.key === category)),
    [films, category],
  );

  useEffect(() => {
    if (!films.length) return;
    if (!activeKey || !films.some((f) => f.key === activeKey)) setActiveKey(films[0].key);
  }, [films, activeKey]);

  const active = films.find((f) => f.key === activeKey) || null;
  const part = active?.parts[partIdx] || active?.parts[0] || null;
  const muted = Boolean(active?.audioRestricted);

  function selectFilm(key) {
    setActiveKey(key);
    setPartIdx(0);
    setRate(1);
  }

  useEffect(() => {
    const v = videoRef.current;
    if (v) v.playbackRate = rate;
  }, [rate, part?.id]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(getFullscreenElement() === stageRef.current);
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  // Parts of one film play straight through.
  function onEnded() {
    if (active && partIdx < active.parts.length - 1) setPartIdx(partIdx + 1);
  }

  // Native controls expose an unmute button — snap it back for restricted films.
  function onVolumeChange(e) {
    if (muted && !e.currentTarget.muted) e.currentTarget.muted = true;
  }

  // iOS Safari has no element-level Fullscreen API — only <video> itself can
  // go fullscreen there, via the legacy webkit method. Everywhere else
  // (including desktop Safari) the standard/webkit container API works, which
  // is what keeps the slow-mo rail + title visible while fullscreen.
  function toggleFullscreen() {
    const el = stageRef.current;
    const v = videoRef.current;
    if (getFullscreenElement()) {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
      return;
    }
    const canContainerFullscreen = document.fullscreenEnabled || document.webkitFullscreenEnabled;
    if (canContainerFullscreen && el) {
      (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
    } else if (v?.webkitEnterFullscreen) {
      v.webkitEnterFullscreen();
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: P.ink, fontFamily: inter }}>
      <style>{`
        .wz-grid { display: grid; grid-template-columns: minmax(0,1fr) 320px; gap: 28px; align-items: start; }
        .wz-lib { position: sticky; top: 72px; max-height: calc(100vh - 96px); overflow-y: auto; }
        .wz-chips { display: flex; flex-wrap: wrap; gap: 8px; }
        .wz-chips::-webkit-scrollbar { display: none; }
        .wz-film:hover { border-color: ${P.hairStrong} !important; }
        .wz-film:focus-visible, .wz-chip:focus-visible, .wz-speed:focus-visible { outline: 2px solid ${P.gold}; outline-offset: 2px; }
        @media (max-width: 760px) {
          .wz-grid { grid-template-columns: minmax(0,1fr); gap: 24px; }
          .wz-lib { position: static; max-height: none; overflow: visible; }
          .wz-chips { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; }
        }
      `}</style>

      <header style={{
        position: 'sticky', top: 0, zIndex: 5, background: 'rgba(6,16,31,0.92)',
        backdropFilter: 'blur(6px)', borderBottom: `1px solid ${P.hair}`,
        padding: `${sp[3]}px ${sp[4]}px`, display: 'flex', alignItems: 'baseline', gap: sp[3], flexWrap: 'wrap',
      }}>
        <a href="/" style={{
          fontFamily: mono, fontSize: fs.tiny, letterSpacing: '0.16em', color: P.mute, textDecoration: 'none',
        }}>&larr; TROJAN BATTALION</a>
        <div style={{
          fontFamily: mono, fontSize: fs.tiny, letterSpacing: '0.24em', color: P.gold, textTransform: 'uppercase',
        }}>Watching Zone</div>
        <h1 style={{
          margin: '0 0 0 auto', fontFamily: fraunces, fontStyle: 'italic', fontWeight: 700, color: P.cream,
          fontSize: 'clamp(18px,5vw,30px)',
        }}>
          Raider Film
        </h1>
      </header>

      <main className="wz-grid" style={{
        maxWidth: 1280, margin: '0 auto', padding: `${sp[5]}px ${sp[4]}px ${sp[16]}px`,
      }}>
        {/* Stage */}
        <section aria-label="Player">
          <div
            ref={stageRef}
            style={{
              position: 'relative', width: '100%', aspectRatio: '16/9', background: '#000',
              borderRadius: isFullscreen ? 0 : radius.lg, overflow: 'hidden',
              boxShadow: shadow.lg, border: `1px solid ${P.hairStrong}`,
            }}
          >
            {part ? (
              <video
                key={part.id}
                ref={videoRef}
                src={videoUrl(part.storage_path)}
                controls
                controlsList="nodownload"
                playsInline
                muted={muted}
                autoPlay={partIdx > 0}
                onEnded={onEnded}
                onVolumeChange={onVolumeChange}
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

            {part && (
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}
                style={{
                  position: 'absolute', top: sp[3], right: sp[3], zIndex: 2,
                  width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
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
                <div>
                  <div style={{ fontFamily: mono, fontSize: fs.micro, letterSpacing: '0.24em', color: P.gold, textTransform: 'uppercase' }}>
                    {active.category.label}
                  </div>
                  <h2 style={{ margin: '6px 0 0', fontFamily: fraunces, fontWeight: 700, color: P.cream, fontSize: 'clamp(22px,4vw,30px)' }}>
                    {active.title}
                  </h2>
                </div>
                {active.duration_sec ? (
                  <span style={{ fontFamily: mono, fontSize: fs.tiny, color: P.faint, letterSpacing: '0.12em' }}>
                    {fmtTime(active.duration_sec)}
                  </span>
                ) : null}
              </div>

              {muted && (
                <div style={{
                  marginTop: sp[3], display: 'inline-flex', alignItems: 'center', gap: sp[2],
                  fontFamily: mono, fontSize: fs.micro, letterSpacing: '0.14em', color: P.mute,
                  border: `1px solid ${P.hair}`, borderRadius: radius.pill, padding: `${sp[1]}px ${sp[3]}px`,
                }}>
                  <MutedIcon /> AUDIO OFF · AT THE REQUEST OF THE CADETS IN THIS FILM
                </div>
              )}

              {active.parts.length > 1 && (
                <div role="tablist" aria-label="Parts" style={{ marginTop: sp[4], display: 'flex', gap: sp[2] }}>
                  {active.parts.map((p, i) => (
                    <button
                      key={p.id}
                      type="button"
                      role="tab"
                      aria-selected={i === partIdx}
                      className="wz-speed"
                      onClick={() => setPartIdx(i)}
                      style={chipStyle(i === partIdx)}
                    >
                      PART {p.part ?? i + 1}{p.duration_sec ? ` · ${fmtTime(p.duration_sec)}` : ''}
                    </button>
                  ))}
                </div>
              )}

              {/* Slow-mo rail */}
              <div style={{ marginTop: sp[5] }}>
                <div style={labelStyle}>Slow&nbsp;Motion</div>
                <div style={{ display: 'flex', gap: sp[2], flexWrap: 'wrap' }}>
                  {SPEED_PRESETS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="wz-speed"
                      aria-pressed={rate === s}
                      onClick={() => setRate(s)}
                      style={chipStyle(rate === s)}
                    >
                      {s}&times;
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>

        {/* Library */}
        <aside className="wz-lib" aria-label="Film library">
          <div style={labelStyle}>
            {films.length ? `${films.length} film${films.length === 1 ? '' : 's'}` : 'LIBRARY'}
          </div>

          {categories.length > 1 && (
            <div className="wz-chips" style={{ marginBottom: sp[3] }}>
              {[{ key: 'all', label: 'All' }, ...categories].map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className="wz-chip"
                  aria-pressed={category === c.key}
                  onClick={() => setCategory(c.key)}
                  style={{ ...chipStyle(category === c.key), whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: sp[2] }}>
            {shown.map((f) => {
              const isActive = f.key === activeKey;
              return (
                <button
                  key={f.key}
                  type="button"
                  className="wz-film"
                  aria-current={isActive ? 'true' : undefined}
                  onClick={() => selectFilm(f.key)}
                  style={{
                    textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 4,
                    padding: `${sp[3]}px ${sp[4]}px`, borderRadius: radius.md, cursor: 'pointer',
                    border: `1px solid ${isActive ? P.gold : P.hair}`,
                    background: isActive ? P.goldWash : P.deep,
                    transition: `border-color 0.15s ${ease}`,
                  }}
                >
                  <span style={{
                    fontFamily: inter, fontSize: fs.sm, fontWeight: 600, color: isActive ? P.bright : P.cream,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {f.title}
                  </span>
                  <span style={{ display: 'flex', gap: sp[2], alignItems: 'center', fontFamily: mono, fontSize: fs.micro, color: P.faint, letterSpacing: '0.08em' }}>
                    {f.duration_sec ? fmtTime(f.duration_sec) : 'unknown length'}
                    {f.parts.length > 1 && <span style={{ color: P.gold }}>· {f.parts.length} PARTS</span>}
                    {f.audioRestricted && <span aria-label="Audio off"><MutedIcon /></span>}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>
      </main>
    </div>
  );
}

const labelStyle = {
  fontFamily: mono, fontSize: fs.micro, letterSpacing: '0.24em', color: P.mute,
  textTransform: 'uppercase', marginBottom: sp[2],
};

function chipStyle(on) {
  return {
    fontFamily: mono, fontSize: fs.xs, fontWeight: 700, letterSpacing: '0.06em',
    padding: `${sp[2]}px ${sp[3]}px`, borderRadius: radius.sm, cursor: 'pointer',
    border: `1px solid ${on ? P.gold : P.hair}`,
    background: on ? P.gold : 'transparent',
    color: on ? P.ink : P.mute,
    transition: `background 0.15s ${ease}`,
  };
}

function MutedIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M11 5 6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" />
    </svg>
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
