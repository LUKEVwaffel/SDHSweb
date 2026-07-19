import { P, mono, oswald } from '../theme';

// Grouped, text-labelled navigation. Replaces the old 52px single-glyph rail.
// Daily tasks up top; dev/danger tools isolated at the bottom under SYSTEM.
export const NAV_GROUPS = [
  {
    heading: 'DAILY',
    items: [
      { id: 'overview', icon: '◉', label: 'Overview' },
      { id: 'events',   icon: '◷', label: 'Events' },
      { id: 'people',   icon: '☰', label: 'People' },
      { id: 'photos',   icon: '⊞', label: 'Photos' },
      { id: 'email',    icon: '✉', label: 'Email List' },
    ],
  },
  {
    heading: 'LIBRARY',
    items: [
      { id: 'media', icon: '⊡', label: 'Media' },
    ],
  },
  {
    heading: 'SYSTEM',
    items: [
      { id: 'advanced', icon: '⚙', label: 'Advanced', danger: true },
    ],
  },
];

export default function Sidebar({ active, setActive }) {
  return (
    <div style={{
      width: 208, background: P.deep, borderRight: `1px solid ${P.hair}`,
      display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto', paddingBottom: 16,
    }}>
      <div style={{ padding: '16px 16px 12px', borderBottom: `1px solid ${P.hair}`, marginBottom: 8 }}>
        <div style={{ fontFamily: oswald, fontSize: 17, color: P.cream, letterSpacing: '0.28em' }}>DISPATCH</div>
        <div style={{ fontFamily: mono, fontSize: 8, color: P.gold, letterSpacing: '0.2em', marginTop: 3 }}>S-6 · NET CONTROL</div>
      </div>
      {NAV_GROUPS.map((group) => (
        <div key={group.heading} style={{ marginBottom: 10 }}>
          <div style={{ fontFamily: mono, fontSize: 8, color: P.mute, letterSpacing: '0.25em', padding: '4px 16px 6px' }}>
            {group.heading}
          </div>
          {group.items.map((item) => {
            const on = active === item.id;
            return (
              <button key={item.id} onClick={() => setActive(item.id)} style={{
                width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
                background: on ? P.navy : 'transparent',
                borderLeft: `2px solid ${on ? P.gold : 'transparent'}`,
                borderTop: 'none', borderRight: 'none', borderBottom: 'none',
                color: on ? P.cream : (item.danger ? 'rgba(192,57,43,0.85)' : P.mute),
                cursor: 'pointer', fontFamily: mono, fontSize: 11, letterSpacing: '0.08em',
                padding: '9px 16px', transition: 'all 0.12s',
              }}>
                <span style={{ fontSize: 13, color: on ? P.gold : 'inherit', width: 16 }}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
