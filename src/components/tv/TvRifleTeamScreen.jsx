import { P, mono, oswald, fraunces, inter, fs, sp, ease } from '../admin/theme.js';
import { RIFLE_TEAM_SEASON, RIFLE_TEAM_ROSTER } from '../../lib/tvRifleTeamData.js';

// Full-screen /tv takeover congratulating the cadets who made the Rifle Team.
// Left column = headline (same shell as TvCongratsScreen / TvRaftingScreen so
// the boards read as one family); right column = the roster. Swapped in at
// TvKiosk.jsx — revert is a one-line change there.

function RifleStyles() {
  return (
    <style>{`
      @keyframes rifleRise {
        from { opacity: 0; transform: translateY(18px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .rifle-rise { animation: rifleRise 720ms ${ease} both; }
      @media (prefers-reduced-motion: reduce) {
        .rifle-rise { animation: none; }
      }
    `}</style>
  );
}

function RosterRow({ name, index }) {
  return (
    <div
      className="rifle-rise"
      style={{
        display: 'flex', alignItems: 'baseline', gap: sp[5],
        padding: `${sp[5]}px 0`, borderTop: `1px solid ${P.hair}`,
        animationDelay: `${260 + index * 110}ms`,
      }}
    >
      <div style={{
        flexShrink: 0, width: 44, fontFamily: mono, fontSize: fs.base,
        color: P.gold, letterSpacing: '0.12em',
      }}>
        {String(index + 1).padStart(2, '0')}
      </div>
      <div style={{
        fontFamily: oswald, fontWeight: 600, fontSize: 'clamp(30px, 3.2vw, 52px)',
        color: P.cream, letterSpacing: '0.02em', lineHeight: 1.05,
      }}>
        {name}
      </div>
    </div>
  );
}

export default function TvRifleTeamScreen() {
  const half = Math.ceil(RIFLE_TEAM_ROSTER.length / 2);
  const columns = [RIFLE_TEAM_ROSTER.slice(0, half), RIFLE_TEAM_ROSTER.slice(half)];

  return (
    <div style={{
      position: 'fixed', inset: 0, background: P.ink, fontFamily: inter,
      display: 'grid', gridTemplateColumns: '44% 56%',
    }}>
      <RifleStyles />

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
          <div className="rifle-rise" style={{
            fontFamily: mono, fontSize: fs.sm, color: P.gold,
            letterSpacing: '0.34em', textTransform: 'uppercase',
          }}>
            {RIFLE_TEAM_SEASON} Rifle Team
          </div>

          <h1 className="rifle-rise" style={{
            margin: `${sp[4]}px 0 0`, animationDelay: '80ms',
            fontFamily: fraunces, fontWeight: 600, fontSize: 'clamp(48px, 6vw, 92px)',
            lineHeight: 0.98, color: P.cream, letterSpacing: '-0.02em',
          }}>
            Congratulations,<br />
            <span style={{ color: P.bright }}>Sharpshooters</span>
          </h1>

          <div className="rifle-rise" style={{
            marginTop: sp[5], animationDelay: '140ms',
            fontFamily: oswald, fontSize: fs.lg, color: P.mute, letterSpacing: '0.04em',
          }}>
            SDHS JROTC · Trojan Battalion
          </div>

          <div className="rifle-rise" style={{
            marginTop: sp[10], animationDelay: '200ms',
            fontFamily: mono, fontSize: fs.xs, color: P.gold, opacity: 0.7,
            letterSpacing: '0.24em',
          }}>
            {RIFLE_TEAM_ROSTER.length} CADETS SELECTED
          </div>
        </div>
      </div>

      {/* Right — roster */}
      <div style={{
        height: '100%', width: '100%', background: P.navy,
        display: 'flex', alignItems: 'center',
        padding: `${sp[12]}px ${sp[16]}px`, boxSizing: 'border-box',
      }}>
        <div style={{
          width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr',
          columnGap: sp[16],
        }}>
          {columns.map((col, c) => (
            <div key={c} style={{ borderBottom: `1px solid ${P.hair}` }}>
              {col.map((name, i) => (
                <RosterRow key={name} name={name} index={c * half + i} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
