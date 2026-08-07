import { P, mono, oswald, inter, sp, radius, ease } from '../../admin/theme.js';
import { TEAMS } from '../../../lib/teams.js';

export default function StepFeaturedTeams({ selected, onChange }) {
  const toggle = (id) => {
    const has = selected.includes(id);
    const next = has ? selected.filter((t) => t !== id) : [...selected, id];
    onChange(next.length ? next : selected); // never allow zero teams selected
  };

  return (
    <div>
      <div style={{ fontFamily: mono, fontSize: 10, color: P.gold, letterSpacing: '0.24em', marginBottom: sp[2] }}>
        FEATURED TODAY
      </div>
      <div style={{ fontFamily: inter, fontSize: 13, color: P.mute, marginBottom: sp[5], lineHeight: 1.5 }}>
        Which team(s) does today's carousel represent? Drives the on-screen team badge and narrows the past-event picker.
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: sp[3] }}>
        {TEAMS.map((team) => {
          const active = selected.includes(team.id);
          return (
            <button
              key={team.id}
              onClick={() => toggle(team.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: sp[2],
                padding: `${sp[3]}px ${sp[4]}px`, borderRadius: radius.md,
                border: `1px solid ${active ? team.accent : P.hair}`,
                background: active ? `${team.accent}1A` : 'transparent',
                color: active ? P.bright : P.mute,
                fontFamily: oswald, fontSize: 16, cursor: 'pointer',
                transition: `all 150ms ${ease}`,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 999, background: team.accent, flexShrink: 0 }} />
              {team.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
