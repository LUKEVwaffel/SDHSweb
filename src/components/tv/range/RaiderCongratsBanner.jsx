import { P, mono, oswald, inter, fs, sp, radius } from '../../admin/theme.js';

// Congratulates whichever cadets from `matches` made a Raider team — shown on
// a company's Welcome screen (that company's matches only) and on the Staff
// screen (command/staff/s-1..s-6 matches). See useRaiderCongrats.js for the
// name-to-roster cross-reference against DISPATCH's personnel table.
export default function RaiderCongratsBanner({ matches }) {
  if (!matches || matches.length === 0) return null;

  return (
    <div
      className="tv-welcome-block"
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: sp[3],
        padding: `${sp[5]}px ${sp[6]}px`, maxWidth: '80vw',
        border: `1px solid ${P.hairStrong}`, borderRadius: radius.lg,
        background: `linear-gradient(160deg, ${P.goldWash}, transparent)`,
      }}
    >
      <div style={{ fontFamily: mono, fontSize: fs.sm, color: P.gold, letterSpacing: '0.24em' }}>
        🎖 CONGRATULATIONS — MADE THE RAIDER TEAM
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: sp[3] }}>
        {matches.map((m) => (
          <div
            key={m.name}
            style={{
              display: 'flex', alignItems: 'baseline', gap: sp[2],
              padding: `${sp[2]}px ${sp[4]}px`, borderRadius: radius.pill,
              border: `1px solid ${P.hairStrong}`, background: P.navyLift,
            }}
          >
            <span style={{ fontFamily: inter, fontWeight: 600, fontSize: fs.lg, color: P.cream }}>
              {m.name}
            </span>
            <span style={{ fontFamily: mono, fontSize: fs.tiny, color: P.green, letterSpacing: '0.1em' }}>
              {m.teams.map((t) => t.label).join(' · ')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
