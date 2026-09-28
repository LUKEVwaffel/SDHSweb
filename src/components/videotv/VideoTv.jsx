import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { P, mono, oswald, fraunces } from '../admin/theme.js';
import { videoUrl, fmtTime } from '../../lib/raiderTv.js';
import { useRaiderVideos } from '../../hooks/useRaiderVideos.js';
import { buildFilms } from '../../lib/raiderFilm.js';
import { SEASON } from '../RaiderCompetitionResults.jsx';
import VideoTvTrophySlide from './VideoTvTrophySlide.jsx';
import VideoTvLoopEditor from './VideoTvLoopEditor.jsx';
import { loadLoopConfig, saveLoopConfig, orderedFilms } from './videoTvPlaylist.js';

// /videotv — hallway-TV loop of the whole Raider film library (muted, no
// remote). Every film plays in full — multi-part films (P1/P2, Part 1/Part 2)
// run back-to-back as one — with the Trophy Case slide between each film,
// then the loop repeats forever.
//
// Which films play and in what order is set per TV from EDIT LOOP (saved in
// that TV's localStorage — see videoTvPlaylist.js). Default: only the
// latest comp's films (older films sit switched off in EDIT LOOP).
//
// Self-contained full-screen anon route (App.jsx bypass), same pattern as
// /balltv and /watchzone.

const TROPHY_MS = 20000;         // trophy case dwell between films
const VIDEO_GRACE_MS = 20000;    // advance anyway if a clip never fires 'ended' (stalled load)

export default function VideoTv() {
  const { videos, loading } = useRaiderVideos();
  const films = useMemo(() => buildFilms(videos), [videos]);
  const [loopConfig, setLoopConfig] = useState(loadLoopConfig);
  const rows = useMemo(() => orderedFilms(films, loopConfig), [films, loopConfig]);
  const loop = useMemo(() => rows.filter((r) => r.included).map((r) => r.film), [rows]);

  const [pos, setPos] = useState({ film: 0, part: 0, phase: 'video' });
  const [editing, setEditing] = useState(false);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef(null);

  const hasLoop = loop.length > 0;
  const film = hasLoop ? loop[pos.film % loop.length] : null;
  const part = film ? film.parts[pos.part] || film.parts[0] : null;
  const isVideo = hasLoop && pos.phase === 'video';
  const nextFilm = hasLoop ? loop[(pos.film + 1) % loop.length] : null;

  // Parts → next part; last part → trophy case; trophy case → next film.
  const advance = useCallback(() => {
    setProgress(0);
    setPos((p) => {
      if (!hasLoop) return p;
      const f = loop[p.film % loop.length];
      if (p.phase === 'video' && p.part < f.parts.length - 1) return { ...p, part: p.part + 1 };
      if (p.phase === 'video') return { ...p, phase: 'trophy' };
      return { film: (p.film + 1) % loop.length, part: 0, phase: 'video' };
    });
  }, [hasLoop, loop]);

  // Loop edited — restart from the top of the new loop.
  useEffect(() => { setPos({ film: 0, part: 0, phase: 'video' }); }, [loop.length, loopConfig]);

  useEffect(() => {
    if (!isVideo || !part) return undefined;
    const v = videoRef.current;
    if (v) {
      v.currentTime = 0;
      v.play().catch(() => {});
    }
    const ms = VIDEO_GRACE_MS + (Number(part.duration_sec) || 0) * 1000;
    const id = setTimeout(advance, ms);
    return () => clearTimeout(id);
  }, [isVideo, part, advance]);

  useEffect(() => {
    if (isVideo) return undefined;
    const id = setTimeout(advance, TROPHY_MS);
    return () => clearTimeout(id);
  }, [isVideo, pos, advance]);

  useEffect(() => {
    function onKey(e) {
      if (editing) return;
      if (e.key === 'e' || e.key === 'E') setEditing(true);
      if (e.key === 'ArrowRight') advance();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing, advance]);

  function saveLoop(config) {
    saveLoopConfig(config);
    setLoopConfig(config);
    setEditing(false);
  }
  function resetLoop() {
    saveLoopConfig(null);
    setLoopConfig(null);
    setEditing(false);
  }
  function playNow(key) {
    const i = loop.findIndex((f) => f.key === key);
    setEditing(false);
    if (i >= 0) {
      setProgress(0);
      setPos({ film: i, part: 0, phase: 'video' });
    }
  }

  const conf = SEASON.conference;
  const partLabel = film && film.parts.length > 1 ? ` · Part ${pos.part + 1} of ${film.parts.length}` : '';

  return (
    <div style={root}>
      <style>{`
        .vtv-fade { animation: vtvIn 0.8s ease both; }
        @keyframes vtvIn { from { opacity: 0; } to { opacity: 1; } }
        .vtv-btn:hover { border-color: ${P.gold} !important; color: ${P.cream} !important; }
        @media (prefers-reduced-motion: reduce) { .vtv-fade { animation: none; } }
      `}</style>

      <header style={topBar}>
        <div style={{ minWidth: 0 }}>
          <div style={kicker}>{isVideo ? `NOW PLAYING · ${film.category.label}` : 'TROPHY CASE'}</div>
          <div style={titleText}>
            {isVideo ? `${film.title}${partLabel}` : loading ? 'Loading film…' : SEASON.label}
          </div>
        </div>
        {conf && (
          <div style={confBadge}>
            <span style={confPlace}>{conf.place}</span>
            <span style={confLabel}>{conf.label}<br />{conf.scope}</span>
          </div>
        )}
      </header>

      <main style={stage}>
        {isVideo && part ? (
          <video
            key={part.id}
            ref={videoRef}
            src={videoUrl(part.storage_path)}
            muted
            autoPlay
            playsInline
            onEnded={advance}
            onError={advance}
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              if (v.duration) setProgress(v.currentTime / v.duration);
            }}
            style={videoEl}
          />
        ) : (
          <VideoTvTrophySlide key={`trophy-${pos.film}`} upNext={nextFilm?.title} />
        )}
      </main>

      <footer style={bottomBar}>
        <div style={{ ...footMeta, minWidth: 0 }}>
          {hasLoop ? (
            <>
              <span style={{ color: P.gold }}>FILM {(pos.film % loop.length) + 1} / {loop.length}</span>
              {isVideo && nextFilm && <span style={nextText}>UP NEXT · {nextFilm.title}</span>}
            </>
          ) : (
            <span>{loading ? 'LOADING…' : 'NO FILMS IN THIS LOOP — PRESS EDIT LOOP'}</span>
          )}
        </div>
        <div style={progressTrack} aria-hidden="true">
          <div style={{ ...progressFill, transform: `scaleX(${isVideo ? progress : 1})` }} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {isVideo && part?.duration_sec ? <span style={footMeta}>{fmtTime(part.duration_sec)}</span> : null}
          <button type="button" className="vtv-btn" style={footBtn} onClick={advance} disabled={!hasLoop}>SKIP ▶▶</button>
          <button type="button" className="vtv-btn" style={footBtn} onClick={() => setEditing(true)}>EDIT LOOP</button>
        </div>
      </footer>

      {editing && (
        <VideoTvLoopEditor
          rows={rows}
          onSave={saveLoop}
          onReset={resetLoop}
          onClose={() => setEditing(false)}
          onPlayNow={playNow}
        />
      )}
    </div>
  );
}

// ── styles ──────────────────────────────────────────────────────────────────
const root = { position: 'fixed', inset: 0, background: '#000', display: 'flex', flexDirection: 'column' };
const topBar = {
  flexShrink: 0, background: '#000', borderBottom: `1px solid ${P.hairStrong}`,
  padding: 'clamp(12px,2vh,24px) clamp(20px,3vw,40px)',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '3vw',
};
const kicker = { fontFamily: mono, fontSize: 'clamp(10px,1vw,14px)', color: P.gold, letterSpacing: '0.3em', textTransform: 'uppercase' };
const titleText = {
  fontFamily: fraunces, fontStyle: 'italic', fontWeight: 700, color: P.cream,
  fontSize: 'clamp(18px,2.2vw,34px)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
};
const confBadge = {
  flexShrink: 0, display: 'flex', alignItems: 'center', gap: 'clamp(8px,1vw,16px)',
  border: `1px solid ${P.gold}`, background: 'rgba(201,169,97,0.12)', padding: 'clamp(6px,0.8vh,12px) clamp(12px,1.4vw,22px)',
};
const confPlace = { fontFamily: fraunces, fontStyle: 'italic', fontWeight: 900, color: P.bright, fontSize: 'clamp(28px,3.4vw,56px)', lineHeight: 1 };
const confLabel = { fontFamily: oswald, fontWeight: 600, color: P.cream, fontSize: 'clamp(11px,1.1vw,17px)', letterSpacing: '0.1em', textTransform: 'uppercase', lineHeight: 1.2 };
const stage = { flex: 1, minHeight: 0, position: 'relative', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const videoEl = { width: '100%', height: '100%', objectFit: 'contain', background: '#000', display: 'block' };
const bottomBar = {
  flexShrink: 0, background: '#000', borderTop: `1px solid ${P.hairStrong}`,
  padding: 'clamp(10px,1.5vh,18px) clamp(16px,2vw,32px)',
  display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(120px,1.2fr) auto', alignItems: 'center', gap: '2vw',
};
const footMeta = {
  display: 'flex', gap: 16, alignItems: 'center', fontFamily: mono, fontSize: 'clamp(10px,0.9vw,13px)',
  color: P.mute, letterSpacing: '0.12em', whiteSpace: 'nowrap',
};
const nextText = { overflow: 'hidden', textOverflow: 'ellipsis' };
const progressTrack = { height: 4, background: P.hair, overflow: 'hidden' };
const progressFill = { height: '100%', background: P.gold, transformOrigin: 'left', transition: 'transform 0.3s linear' };
const footBtn = {
  fontFamily: mono, fontSize: 'clamp(10px,0.9vw,13px)', fontWeight: 700, letterSpacing: '0.12em',
  background: 'transparent', color: P.mute, border: `1px solid ${P.hair}`, padding: '8px 14px', cursor: 'pointer',
};
