import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { P, mono, oswald, fs, sp, ease } from '../theme';

// Grouped, text-labelled navigation. Daily tasks up top; dev/danger tools
// isolated at the bottom under SYSTEM.
export const NAV_GROUPS = [
  {
    // Placed first, always — the entire point of Emergency Push is being
    // found in seconds during an actual same-day cancellation, not sitting
    // wherever alphabetical/functional grouping would otherwise put it.
    heading: 'URGENT',
    items: [
      { id: 'emergency', icon: '▲', label: 'Emergency Push', danger: true },
    ],
  },
  {
    heading: 'DAILY',
    items: [
      { id: 'overview', icon: '◉', label: 'Overview' },
      { id: 'tvremote', icon: '▥', label: 'TV Remote' },
      { id: 'events',   icon: '◷', label: 'Events' },
      { id: 'aars',     icon: '▤', label: 'AAR Tracker' },
      { id: 'people',   icon: '☰', label: 'People' },
      { id: 'photos',   icon: '⊞', label: 'Photos' },
      { id: 'questions', icon: '?', label: 'FAQ Questions' },
      { id: 'email',    icon: '✉', label: 'Email List' },
      { id: 'messages', icon: '◈', label: 'Messages' },
    ],
  },
  {
    heading: 'LIBRARY',
    items: [
      { id: 'media', icon: '⊡', label: 'Media' },
      { id: 'tvphotos', icon: '▣', label: 'TV Photos' },
    ],
  },
  {
    heading: 'SYSTEM',
    items: [
      { id: 'advanced', icon: '⚙', label: 'Advanced', danger: true },
    ],
  },
  {
    heading: 'ACCOUNT',
    items: [
      { id: 'account', icon: '⚿', label: 'My Account' },
    ],
  },
];

function NavItem({ item, on, onClick }) {
  const [hover, setHover] = useState(false);
  const dangerColor = 'rgba(192,57,43,0.9)';
  const restColor = item.danger ? dangerColor : P.mute;
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: sp[3],
        background: on ? P.navy : (hover ? P.goldWash : 'transparent'),
        borderLeft: `3px solid ${on ? P.gold : 'transparent'}`,
        borderTop: 'none', borderRight: 'none', borderBottom: 'none',
        color: on ? P.cream : restColor,
        cursor: 'pointer', fontFamily: mono, fontSize: fs.sm, letterSpacing: '0.06em',
        padding: '13px 20px', transition: `all 0.14s ${ease}`,
      }}
    >
      <span style={{ fontSize: fs.md, color: on ? P.gold : (hover ? P.gold : 'inherit'), width: 20, transition: `color 0.14s ${ease}` }}>{item.icon}</span>
      {item.label}
    </button>
  );
}

export default function Sidebar({ active, allowed = null }) {
  const navigate = useNavigate();
  // allowed = list of section ids this role may see; null = all.
  const groups = allowed
    ? NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => allowed.includes(i.id)) })).filter((g) => g.items.length)
    : NAV_GROUPS;
  return (
    <div style={{
      width: 244, background: P.deep, borderRight: `1px solid ${P.hairStrong}`,
      display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto', paddingBottom: sp[4],
    }}>
      <div style={{ padding: '20px 20px 16px', borderBottom: `1px solid ${P.hair}`, marginBottom: sp[3] }}>
        <div style={{ fontFamily: oswald, fontSize: fs.lg, color: P.cream, letterSpacing: '0.26em', fontWeight: 600 }}>DISPATCH</div>
        <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.2em', marginTop: 5 }}>S-6 · NET CONTROL</div>
      </div>
      {groups.map((group) => (
        <div key={group.heading} style={{ marginBottom: sp[3] }}>
          <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.faint, letterSpacing: '0.24em', padding: '6px 20px 8px' }}>
            {group.heading}
          </div>
          {group.items.map((item) => (
            <NavItem key={item.id} item={item} on={active === item.id} onClick={() => navigate(`/admin/${item.id}`)} />
          ))}
        </div>
      ))}
    </div>
  );
}
