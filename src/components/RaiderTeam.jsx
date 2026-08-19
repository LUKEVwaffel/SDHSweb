import { useState } from 'react';

// Palette mirrors Raiders.jsx — green is the raider accent, gold stays command.
const P = {
  ink: '#06101F', navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', bright: '#E8C77A', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.55)', hair: 'rgba(201,169,97,0.22)',
  hairStrong: 'rgba(201,169,97,0.5)', green: '#7EC87E',
};
const mono = "'JetBrains Mono', monospace";
const oswald = 'Oswald, sans-serif';

// Official 2026 Raider Roster. First name in each list is the team commander.
const TEAMS = [
  {
    key: 'male',
    label: 'MALE VARSITY',
    accent: P.gold,
    members: [
      'Weston Noblit', 'Quincy Tyler', 'William Baker (Senior)', "Aiden O'Brien",
      'Luke Vetch', 'Makio Roos', 'Griffen Blume', 'Aiden Clifton', 'Zane Youngblood',
      'Blayne Frazier', 'Alex Johnson', "Logan O'Brien", 'Hayden Ogle', 'Riley Lyles',
      'Luke Mattison',
    ],
  },
  {
    key: 'coed',
    label: 'CO-ED VARSITY',
    accent: P.bright,
    members: [
      'Zoe McCollum', 'Amber Davidson', 'Kylie Gray', 'Mya Sniedeman', 'Maddie Basset',
      'Bella Basset', 'Lilac Powers', 'Tyler King', 'Chase Otto', 'Levi Fosdick',
      'Bryson Frazier', 'Cooper Higgenbothem', 'William Baker (Freshman)', 'Shawn Layson',
      'James Bunch',
    ],
  },
  {
    key: 'jv',
    label: 'JUNIOR VARSITY',
    accent: P.green,
    members: [
      'Hayden Ogle', 'Avery Fosdick', 'Grayson Mercier', 'Mason Myers', 'Jordan Elsea',
      'Jayden Walker', 'Veronica Coyer', 'Elizabeth Morris', 'Annabelle Settles',
      'Hayden Lee', 'James Shelby', 'Miles Holloway', 'Bryson Dodd', 'Luke Chambers',
      'Landon McClure', 'Ian Thompson',
    ],
  },
];

function RosterStyles() {
  return (
    <style>{`
      .rt-row { transition: background 0.15s, padding-left 0.15s; }
      .rt-row:hover { background: rgba(201,169,97,0.06); padding-left: 6px; }
      @media (max-width: 900px) {
        .rt-cols { grid-template-columns: 1fr !important; }
        .rt-col + .rt-col { border-top: 1px solid ${P.hair}; border-left: none !important; padding-top: 32px !important; margin-top: 32px; }
      }
    `}</style>
  );
}

function PageBg() {
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `linear-gradient(${P.hair} 1px, transparent 1px), linear-gradient(90deg, ${P.hair} 1px, transparent 1px)`,
        backgroundSize: '52px 52px', opacity: 0.25,
      }} />
      {[
        { t: 'AY 2025–26', top: '4%', left: '2%' },
        { t: '// RAIDER TEAM ROSTER', top: '4%', right: '2%' },
        { t: 'Σ cadets = 45', bottom: '3%', left: '2%' },
        { t: 'TN-051 · TROJAN BATTALION', bottom: '3%', right: '2%' },
      ].map((m, i) => (
        <div key={i} style={{
          position: 'absolute', top: m.top, bottom: m.bottom, left: m.left, right: m.right,
          fontFamily: mono, fontSize: 9, color: P.gold, opacity: 0.14, letterSpacing: '0.16em', whiteSpace: 'nowrap',
        }}>{m.t}</div>
      ))}
    </div>
  );
}

function TeamColumn({ team, first }) {
  const [hoveredCmd, setHoveredCmd] = useState(false);
  const commander = team.members[0];
  const rest = team.members.slice(1);

  return (
    <div
      className="rt-col"
      style={{
        borderLeft: first ? 'none' : `1px solid ${P.hair}`,
        paddingLeft: first ? 0 : 40,
      }}
    >
      {/* Column header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
        <div style={{ width: 3, height: 26, background: team.accent, flexShrink: 0 }} />
        <div>
          <div style={{ fontFamily: mono, fontSize: 9, color: team.accent, letterSpacing: '0.28em', marginBottom: 3 }}>
            TEAM
          </div>
          <div style={{ fontFamily: oswald, fontSize: 21, color: P.cream, letterSpacing: '0.05em', lineHeight: 1 }}>
            {team.label}
          </div>
        </div>
      </div>

      {/* Commander */}
      <div
        onMouseEnter={() => setHoveredCmd(true)}
        onMouseLeave={() => setHoveredCmd(false)}
        style={{
          position: 'relative',
          border: `1px solid ${hoveredCmd ? team.accent : P.hairStrong}`,
          background: `linear-gradient(135deg, ${team.accent}14, transparent)`,
          padding: '14px 16px',
          marginBottom: 4,
          transition: 'border-color 0.2s',
        }}
      >
        <div style={{
          fontFamily: mono, fontSize: 8, color: team.accent, letterSpacing: '0.24em', marginBottom: 5,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
            <path d="M4 20 L12 4 L20 20 Z" stroke={team.accent} strokeWidth="2" fill="none" />
          </svg>
          COMMANDER
        </div>
        <div style={{ fontFamily: oswald, fontSize: 17, color: P.cream, letterSpacing: '0.03em' }}>
          {commander}
        </div>
      </div>

      {/* Roster */}
      <div>
        {rest.map((name, i) => (
          <div
            key={name + i}
            className="rt-row"
            style={{
              display: 'flex', alignItems: 'baseline', gap: 12,
              padding: '8px 0', borderBottom: `1px solid ${P.hair}`,
            }}
          >
            <span style={{ fontFamily: mono, fontSize: 9, color: `${team.accent}99`, minWidth: 20 }}>
              {String(i + 2).padStart(2, '0')}
            </span>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: P.cream, letterSpacing: '0.01em' }}>
              {name}
            </span>
          </div>
        ))}
      </div>

      <div style={{
        fontFamily: mono, fontSize: 9, color: `${P.gold}77`, letterSpacing: '0.16em',
        marginTop: 14, textAlign: 'right',
      }}>
        {team.members.length} CADETS
      </div>
    </div>
  );
}

export default function RaiderTeam() {
  const totalCadets = TEAMS.reduce((sum, t) => sum + t.members.length, 0);

  return (
    <div style={{ position: 'relative', background: P.ink, minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <RosterStyles />
      <PageBg />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1300, margin: '0 auto', padding: '60px 24px 100px' }}>
        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 10 }}>
          <div style={{ width: 3, height: 40, background: P.green }} />
          <div>
            <div style={{ fontFamily: mono, fontSize: 9, color: P.green, letterSpacing: '0.32em', marginBottom: 4 }}>
              // AY 2025–26 · TROJAN BATTALION
            </div>
            <div style={{ fontFamily: oswald, fontSize: 34, color: P.cream, letterSpacing: '0.07em', lineHeight: 1 }}>
              RAIDER TEAM ROSTER
            </div>
          </div>
        </div>
        <p style={{
          fontFamily: 'Inter, sans-serif', fontSize: 13.5, color: P.mute, lineHeight: 1.65,
          maxWidth: 640, margin: '18px 0 0 21px',
        }}>
          Official 2026 Raider roster — {totalCadets} cadets across three teams. Each team's commander leads the roster.
        </p>

        <div style={{ height: 1, background: P.hairStrong, margin: '36px 0 44px' }} />

        {/* Three-column roster */}
        <div className="rt-cols" style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 40,
        }}>
          {TEAMS.map((team, i) => (
            <TeamColumn key={team.key} team={team} first={i === 0} />
          ))}
        </div>
      </div>
    </div>
  );
}
