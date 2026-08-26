import { P, fraunces, mono, inter, fs, sp, radius, shadow, ease } from '../../admin/theme.js';

function CongratsStyles() {
  return (
    <style>{`
      @keyframes raiderCongratsRise { from { opacity: 0; transform: translateY(10px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
      @keyframes raiderCongratsShimmer { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
      .raider-congrats-card { animation: raiderCongratsRise 600ms cubic-bezier(0.16,1,0.3,1) both; }
      .raider-congrats-medal { animation: raiderCongratsShimmer 2600ms ease-in-out infinite; }
      @media (prefers-reduced-motion: reduce) {
        .raider-congrats-card, .raider-congrats-medal { animation: none; }
      }
    `}</style>
  );
}

// Congratulates whichever cadets from `matches` made a Raider team — shown on
// a company's Welcome screen (that company's matches only) and on the Staff
// screen (command/staff/s-1..s-6 matches). See useRaiderCongrats.js for the
// name-to-roster cross-reference against DISPATCH's personnel table. Each
// team keeps its own roster accent color (src/lib/raiderRoster.js) so a
// cadet's card reads at a glance even for names on more than one team.
export default function RaiderCongratsBanner({ matches }) {
  if (!matches || matches.length === 0) return null;

  return (
    <div
      className="tv-welcome-block"
      style={{
        position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: sp[5],
        padding: `${sp[6]}px ${sp[8]}px`, maxWidth: '84vw',
        border: `1px solid ${P.hairStrong}`, borderRadius: radius.lg,
        background: `linear-gradient(160deg, rgba(201,169,97,0.1), rgba(201,169,97,0.02))`,
        boxShadow: `${shadow.lg}, inset 0 1px 0 rgba(244,236,216,0.06)`,
        overflow: 'hidden',
      }}
    >
      <CongratsStyles />

      {/* Faint corner glow, purely decorative — same layering language as the
          screen's own background wash, just concentrated so this block reads
          as a distinct "trophy case" rather than another flat pill. */}
      <div style={{
        position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)',
        width: 420, height: 200, pointerEvents: 'none',
        background: `radial-gradient(ellipse, ${P.goldWash} 0%, transparent 70%)`,
      }} />

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: sp[3] }}>
        <span className="raider-congrats-medal" style={{ fontSize: fs.xl }}>🎖</span>
        <span style={{
          fontFamily: fraunces, fontWeight: 800, fontStyle: 'italic', color: P.bright,
          fontSize: fs.xxl, letterSpacing: '0.01em',
        }}>
          Made the Raider Team
        </span>
        <span className="raider-congrats-medal" style={{ fontSize: fs.xl }}>🎖</span>
      </div>

      <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: sp[4] }}>
        {matches.map((m, i) => (
          <div
            // `matches` only carries name + company (cadet_company_roster has
            // no id column — see useRaiderCongrats.js), and two cadets can
            // share a name across companies (confirmed on Range's roster: two
            // "William Baker"s), so name alone collided as a key and threw
            // React's duplicate-key warning on this battalion-wide slide.
            key={`${m.company}:${m.name}:${i}`}
            className="raider-congrats-card"
            style={{
              animationDelay: `${i * 90}ms`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: sp[2],
              padding: `${sp[4]}px ${sp[5]}px`, minWidth: 180, borderRadius: radius.md,
              border: `1px solid ${P.hairStrong}`, background: P.navyLift,
              boxShadow: shadow.sm,
            }}
          >
            <span style={{ fontFamily: inter, fontWeight: 700, fontSize: fs.lg, color: P.cream, textAlign: 'center' }}>
              {m.name}
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: sp[1] }}>
              {m.teams.map((t) => (
                <span
                  key={t.key}
                  style={{
                    fontFamily: mono, fontSize: fs.micro, letterSpacing: '0.1em',
                    padding: `2px ${sp[2]}px`, borderRadius: radius.pill,
                    color: t.accent, border: `1px solid ${t.accent}55`, background: `${t.accent}1a`,
                  }}
                >
                  {t.label}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
