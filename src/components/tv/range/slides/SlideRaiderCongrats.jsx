import { useEffect } from 'react';
import { P, mono, fraunces, inter, fs, sp, radius } from '../../../admin/theme.js';
import { RAIDER_TEAMS } from '../../../../lib/raiderRoster.js';
import { useRaiderCongrats } from '../../../../hooks/useRaiderCongrats.js';

function TeamColumn({ team, matches }) {
  const list = matches.filter((m) => m.teams.some((t) => t.key === team.key));
  if (!list.length) return null;

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: sp[3] }}>
      <div style={{
        fontFamily: mono, fontSize: fs.sm, letterSpacing: '0.2em', color: team.accent,
        paddingBottom: sp[2], borderBottom: `1px solid ${team.accent}55`,
      }}>
        {team.label} · {list.length}
      </div>
      {list.map((m) => (
        <div key={m.name} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: sp[3] }}>
          <span style={{ fontFamily: inter, fontWeight: 600, fontSize: fs.base, color: P.cream }}>{m.name}</span>
          <span style={{ fontFamily: mono, fontSize: fs.tiny, color: P.faint, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
            {m.company.toUpperCase()}
          </span>
        </div>
      ))}
    </div>
  );
}

// Battalion-wide version of RaiderCongratsBanner.jsx (which is scoped to one
// company's Welcome screen) — this is Range's rotation slide, so it isn't
// tied to any one company and instead lists everyone who made a team,
// grouped by team rather than by company. Same data source
// (useRaiderCongrats), just a different grouping/layout for a full screen.
export default function SlideRaiderCongrats({ onEmpty }) {
  const { matches, loading } = useRaiderCongrats();

  useEffect(() => {
    if (loading || matches.length) return undefined;
    const id = setTimeout(() => onEmpty?.(), 1500);
    return () => clearTimeout(id);
  }, [loading, matches.length, onEmpty]);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: P.ink, fontFamily: inter,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: `${sp[12]}px ${sp[16]}px`, boxSizing: 'border-box',
    }}>
      <div style={{
        position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 240, pointerEvents: 'none',
        background: `radial-gradient(ellipse, ${P.goldWash} 0%, transparent 70%)`,
      }} />

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: sp[3], marginBottom: sp[10], flexShrink: 0 }}>
        <span style={{ fontSize: fs.xl }}>🎖</span>
        <span style={{
          fontFamily: fraunces, fontWeight: 800, fontStyle: 'italic', color: P.bright,
          fontSize: fs.xxl,
        }}>
          Made the Raider Team
        </span>
        <span style={{ fontSize: fs.xl }}>🎖</span>
      </div>

      {matches.length > 0 && (
        <div style={{
          position: 'relative', display: 'flex', gap: sp[10], width: '100%', maxWidth: 1400,
          padding: `${sp[8]}px ${sp[8]}px`, borderRadius: radius.lg,
          border: `1px solid ${P.hairStrong}`, background: `linear-gradient(160deg, rgba(201,169,97,0.06), transparent)`,
        }}>
          {RAIDER_TEAMS.map((team) => <TeamColumn key={team.key} team={team} matches={matches} />)}
        </div>
      )}
    </div>
  );
}
