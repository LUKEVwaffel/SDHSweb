import { P, mono, oswald, fraunces, inter, fs, sp, ease } from '../admin/theme.js';
import { RAFTING_TITLE } from '../../lib/rafting.js';
import { useRaftingPhotos } from '../../hooks/useRaftingPhotos.js';
import TvPhotoCarousel from './TvPhotoCarousel.jsx';

// Full-screen /tv + /tv/range takeover: the battalion rafting trip photo set.
// Left column = headline + count (this component); right column = the shared
// kiosk carousel pointed at rafting_photos. Same two-column shell as
// TvCongratsScreen so the boards read as one family. Swapped in for the
// congrats board at TvKiosk.jsx / TvRangeKiosk.jsx — revert is a one-line
// change there.

const KICKER = 'BATTALION';
const SUBHEAD = 'Rafting Trip';

function RaftingStyles() {
  return (
    <style>{`
      @keyframes raftingRise {
        from { opacity: 0; transform: translateY(18px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .rafting-rise { animation: raftingRise 720ms ${ease} both; }
      @media (prefers-reduced-motion: reduce) {
        .rafting-rise { animation: none; }
      }
    `}</style>
  );
}

export default function TvRaftingScreen() {
  const { photos: rows, loading, error } = useRaftingPhotos();

  const photos = rows.map((row, i) => ({
    src: row.url,
    alt: row.caption || `Rafting trip photo ${i + 1}`,
    title: row.caption || RAFTING_TITLE,
  }));

  const count = photos.length;
  const statusLine = loading
    ? 'LOADING…'
    : error
      ? 'PHOTOS UNAVAILABLE'
      : count > 0
        ? `${count} PHOTO${count === 1 ? '' : 'S'}`
        : 'PHOTOS UPLOADING SOON';

  return (
    <div style={{
      position: 'fixed', inset: 0, background: P.ink, fontFamily: inter,
      display: 'grid', gridTemplateColumns: '40% 60%',
    }}>
      <RaftingStyles />

      {/* Left — headline */}
      <div style={{
        position: 'relative', height: '100%', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: `${sp[12]}px ${sp[12]}px`,
        background: `linear-gradient(180deg, ${P.deep} 0%, #0D1C33 100%)`,
        borderRight: `1px solid ${P.hair}`,
      }}>
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `radial-gradient(ellipse 60% 45% at 25% 15%, ${P.goldWash} 0%, transparent 60%),
                       radial-gradient(ellipse 55% 45% at 85% 90%, rgba(201,169,97,0.06) 0%, transparent 65%)`,
        }} />
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.45,
          backgroundImage: `linear-gradient(${P.hair} 1px, transparent 1px), linear-gradient(90deg, ${P.hair} 1px, transparent 1px)`,
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse 75% 65% at 45% 50%, black 0%, transparent 78%)',
          WebkitMaskImage: 'radial-gradient(ellipse 75% 65% at 45% 50%, black 0%, transparent 78%)',
        }} />

        <div style={{ position: 'relative' }}>
          <div className="rafting-rise" style={{
            fontFamily: mono, fontSize: fs.sm, color: P.gold,
            letterSpacing: '0.34em', textTransform: 'uppercase',
          }}>
            {KICKER}
          </div>

          <h1 className="rafting-rise" style={{
            margin: `${sp[4]}px 0 0`, animationDelay: '80ms',
            fontFamily: fraunces, fontWeight: 600, fontSize: 'clamp(48px, 6vw, 92px)',
            lineHeight: 0.98, color: P.cream, letterSpacing: '-0.02em',
          }}>
            {SUBHEAD}
          </h1>

          <div className="rafting-rise" style={{
            marginTop: sp[5], animationDelay: '140ms',
            fontFamily: oswald, fontSize: fs.lg, color: P.mute, letterSpacing: '0.04em',
          }}>
            Downstream with the battalion
          </div>

          <div className="rafting-rise" style={{
            marginTop: sp[10], animationDelay: '200ms',
            fontFamily: mono, fontSize: fs.xs, color: P.gold, opacity: 0.7,
            letterSpacing: '0.24em',
          }}>
            {statusLine}
          </div>
        </div>
      </div>

      {/* Right — carousel */}
      <div style={{ height: '100%', width: '100%' }}>
        {count > 0 ? (
          <TvPhotoCarousel key={`rafting-${count}`} photos={photos} />
        ) : (
          <div style={{
            height: '100%', width: '100%', display: 'flex',
            alignItems: 'center', justifyContent: 'center', background: P.navy,
            fontFamily: mono, fontSize: fs.sm, color: P.mute, letterSpacing: '0.2em',
          }}>
            {statusLine}
          </div>
        )}
      </div>
    </div>
  );
}
