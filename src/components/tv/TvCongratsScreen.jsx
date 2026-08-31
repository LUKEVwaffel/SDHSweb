import { P, mono, oswald, fraunces, inter, fs, sp, ease } from '../admin/theme.js';
import { CONGRATS_MEET, CONGRATS_TROPHIES, CONGRATS_PHOTOS } from '../../lib/tvCongratsData.js';
import { useCompPhotoPoll } from '../../hooks/useCompPhotoPoll.js';
import { useRheaPhotos } from '../../hooks/useRheaPhotos.js';
import { feedChip } from '../../lib/rheaComp.js';
import TvPhotoCarousel from './TvPhotoCarousel.jsx';

// Full-screen /tv takeover celebrating a meet result. Left column = the
// headline + podium list (this component); right column = the shared kiosk
// carousel, pointed at CONGRATS_PHOTOS instead of the daily team set. Swapped
// in for TvStandardLayout at TvKiosk.jsx — revert is a one-line change there.

const TIER_BADGE = {
  1: { ring: P.bright, text: P.ink, fill: P.bright, glow: '0 0 24px rgba(232,199,122,0.45)' },
  2: { ring: P.cream, text: P.ink, fill: P.cream, glow: '0 0 18px rgba(244,236,216,0.28)' },
  3: { ring: '#B07B4A', text: P.cream, fill: 'rgba(176,123,74,0.9)', glow: 'none' },
};

function CongratsStyles() {
  return (
    <style>{`
      @keyframes congratsRise {
        from { opacity: 0; transform: translateY(18px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .congrats-rise { animation: congratsRise 720ms ${ease} both; }
      @media (prefers-reduced-motion: reduce) {
        .congrats-rise { animation: none; }
      }
    `}</style>
  );
}

function PlacementBadge({ tier, place }) {
  const t = TIER_BADGE[tier] ?? TIER_BADGE[3];
  return (
    <div style={{
      flexShrink: 0, width: 58, height: 58, borderRadius: '50%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: tier === 1 ? t.fill : 'transparent',
      border: `2px solid ${t.ring}`, boxShadow: t.glow,
      fontFamily: oswald, fontWeight: 700, fontSize: fs.lg,
      color: tier === 1 ? t.text : t.ring, letterSpacing: '0.02em',
    }}>
      {place}
    </div>
  );
}

function TrophyRow({ trophy, index }) {
  return (
    <div
      className="congrats-rise"
      style={{
        display: 'flex', alignItems: 'center', gap: sp[5],
        padding: `${sp[4]}px 0`, borderTop: `1px solid ${P.hair}`,
        animationDelay: `${180 + index * 110}ms`,
      }}
    >
      <PlacementBadge tier={trophy.tier} place={trophy.place} />
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontFamily: oswald, fontWeight: 600, fontSize: fs.xl, color: P.cream,
          letterSpacing: '0.01em', lineHeight: 1.1,
        }}>
          {trophy.event}
        </div>
        <div style={{
          fontFamily: mono, fontSize: fs.xs, color: P.mute,
          letterSpacing: '0.16em', textTransform: 'uppercase', marginTop: sp[2],
        }}>
          {trophy.detail}
        </div>
      </div>
    </div>
  );
}

export default function TvCongratsScreen() {
  // Once the Picture of the Comp winner is declared in DISPATCH, it leads the
  // carousel. Until then the screen is unchanged (winner === null).
  const { winner } = useCompPhotoPoll();

  // Right column now pulls the whole OPTIC feed for the Rhea comp — every
  // published photo, Luke's AND the parents', not just the hardcoded
  // CONGRATS_PHOTOS placeholders. 'public' scope = visibility public + status
  // live, the same set the /rhea (OPTIC) feed shows. Live-synced, so a new
  // parent upload appears on the kiosk without a reload. Falls back to
  // CONGRATS_PHOTOS only while the feed is genuinely empty.
  const { photos: opticRows } = useRheaPhotos({ scope: 'public' });
  const opticPhotos = opticRows.map((row, i) => ({
    src: row.photo_url,
    alt: row.uploader_name ? `OPTIC — ${row.uploader_name}` : `OPTIC photo ${i + 1}`,
    title: feedChip(row) || CONGRATS_MEET.label,
    focalX: row.focal_x ?? 0.5,
    focalY: row.focal_y ?? 0.5,
  }));

  const basePhotos = opticPhotos.length ? opticPhotos : CONGRATS_PHOTOS;
  const photos = winner
    ? [{
        src: winner.photoUrl || winner.thumbUrl,
        alt: 'Picture of the Comp',
        title: 'Picture of the Comp',
      }, ...basePhotos]
    : basePhotos;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: P.ink, fontFamily: inter,
      display: 'grid', gridTemplateColumns: '44% 56%',
    }}>
      <CongratsStyles />

      {/* Left — headline + podium list */}
      <div style={{
        position: 'relative', height: '100%', overflowY: 'auto',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: `${sp[12]}px ${sp[12]}px`,
        background: `linear-gradient(180deg, ${P.deep} 0%, #0D1C33 100%)`,
        borderRight: `1px solid ${P.hair}`,
      }}>
        {/* Same grid + glow decorative language as the kiosk instrument column */}
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
          <div className="congrats-rise" style={{
            fontFamily: mono, fontSize: fs.sm, color: P.gold,
            letterSpacing: '0.34em', textTransform: 'uppercase',
          }}>
            {CONGRATS_MEET.kicker}
          </div>

          <h1 className="congrats-rise" style={{
            margin: `${sp[4]}px 0 0`, animationDelay: '80ms',
            fontFamily: fraunces, fontWeight: 600, fontSize: 'clamp(48px, 6vw, 92px)',
            lineHeight: 0.98, color: P.cream, letterSpacing: '-0.02em',
          }}>
            Congratulations,<br />
            <span style={{ color: P.bright }}>Trojan Raiders</span>
          </h1>

          <div className="congrats-rise" style={{
            marginTop: sp[5], animationDelay: '140ms',
            fontFamily: oswald, fontSize: fs.lg, color: P.mute,
            letterSpacing: '0.04em',
          }}>
            {CONGRATS_MEET.label} · {CONGRATS_MEET.date}
          </div>

          <div style={{ marginTop: sp[10], borderBottom: `1px solid ${P.hair}` }}>
            {CONGRATS_TROPHIES.map((trophy, i) => (
              <TrophyRow key={`${trophy.place}-${trophy.event}`} trophy={trophy} index={i} />
            ))}
          </div>
        </div>
      </div>

      {/* Right — carousel. Leads with the Picture of the Comp winner once declared. */}
      <div style={{ height: '100%', width: '100%' }}>
        <TvPhotoCarousel key={`congrats-${winner ? 'w' : 'x'}-${photos.length}`} photos={photos} />
      </div>
    </div>
  );
}
