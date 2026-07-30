import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { legacyIdToPath, pathToLegacyId } from '../lib/routes';

const P = {
  ink: '#06101F', navyDeep: '#0A1628', navy: '#142847',
  gold: '#C9A961', goldBright: '#E8C77A',
  cream: '#F4ECD8', mute: 'rgba(244,236,216,0.6)',
  hairline: 'rgba(201,169,97,0.22)',
};

const LOGO = '/assets/trojan-helmet.png';

// Sharp-edged US flag accent — 13 stripes, simplified canton. No rounded corners.
function UsFlag() {
  const RED = '#B31942';
  const BLUE = '#0A3161';
  const WHITE = '#FFFFFF';
  return (
    <svg width="26" height="16" viewBox="0 0 26 16" role="img" aria-label="United States flag"
      style={{ display: 'block', border: `1px solid ${P.hairline}`, flexShrink: 0 }}>
      {Array.from({ length: 13 }).map((_, i) => (
        <rect key={i} x="0" y={(16 / 13) * i} width="26" height={16 / 13}
          fill={i % 2 === 0 ? RED : WHITE} />
      ))}
      <rect x="0" y="0" width="11" height={(16 / 13) * 7} fill={BLUE} />
      {Array.from({ length: 4 }).map((_, r) =>
        Array.from({ length: 5 }).map((_, c) => (
          <rect key={`${r}-${c}`} x={1.4 + c * 2} y={1.1 + r * 2} width="0.9" height="0.9" fill={WHITE} />
        ))
      )}
    </svg>
  );
}

const NAV_ITEMS = [
  { id: 'cadet-manual', label: 'CADET MANUAL' },
  {
    id: 'specialty-teams', label: 'SPECIALTY TEAMS', dropdown: [
      { id: 'raiders',  label: 'RAIDERS',  sub: 'Physical team competition' },
      { id: 'rifle',    label: 'RIFLE',    sub: 'Precision marksmanship' },
      { id: 'academic', label: 'ACADEMIC', sub: 'JLAB Bowl & academics' },
      { id: 'drill',    label: 'DRILL',    sub: 'Armed & unarmed routines' },
    ],
  },
  { id: 'events', label: 'EVENTS' },
  { id: 'staff',  label: 'STAFF' },
  {
    id: 'companies', label: 'COMPANIES', dropdown: [
      { id: 'company-alpha',   label: 'ALPHA',   sub: 'Alpha Company leadership' },
      { id: 'company-bravo',   label: 'BRAVO',   sub: 'Bravo Company leadership' },
      { id: 'company-charlie', label: 'CHARLIE', sub: 'Charlie Company leadership' },
      { id: 'company-delta',   label: 'DELTA',   sub: 'Delta Company leadership' },
    ],
  },
  { id: 'about', label: 'ABOUT' },
];

function DropdownMenu({ items, active, setActive, onClose }) {
  return (
    <div style={{
      position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
      background: P.navyDeep, border: `1px solid ${P.hairline}`,
      minWidth: 220, zIndex: 100,
      boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
      animation: 'dropIn 0.15s ease',
    }}>
      {items.map((item, i) => (
        <button key={item.id}
          onClick={() => { setActive(item.id); onClose(); }}
          style={{
            display: 'block', width: '100%', textAlign: 'left',
            background: active === item.id ? 'rgba(201,169,97,0.1)' : 'transparent',
            border: 'none',
            borderBottom: i < items.length - 1 ? `1px solid ${P.hairline}` : 'none',
            borderLeft: active === item.id ? `2px solid ${P.gold}` : '2px solid transparent',
            cursor: 'pointer', padding: '12px 18px',
            transition: 'all 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(201,169,97,0.08)'; e.currentTarget.style.borderLeftColor = P.gold; }}
          onMouseLeave={e => { e.currentTarget.style.background = active === item.id ? 'rgba(201,169,97,0.1)' : 'transparent'; e.currentTarget.style.borderLeftColor = active === item.id ? P.gold : 'transparent'; }}
        >
          <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 12, color: P.cream, letterSpacing: '0.18em', fontWeight: 600 }}>
            {item.label}
          </div>
          {item.sub && (
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: P.mute, marginTop: 3, letterSpacing: '0.08em' }}>
              {item.sub}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

function NavItem({ item, active, setActive }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const timerRef = useRef(null);

  const isActive = item.dropdown
    ? item.dropdown.some(d => d.id === active)
    : active === item.id;

  function handleMouseEnter() {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (item.dropdown) setOpen(true);
  }

  function handleMouseLeave() {
    if (item.dropdown) {
      timerRef.current = setTimeout(() => setOpen(false), 120);
    }
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        onClick={() => { if (!item.dropdown) setActive(item.id); else setOpen(o => !o); }}
        style={{
          background: isActive ? 'rgba(201,169,97,0.1)' : 'transparent',
          border: 'none', cursor: 'pointer',
          color: isActive ? P.cream : P.mute,
          fontFamily: 'Oswald, sans-serif',
          fontSize: 12, fontWeight: 600,
          letterSpacing: '0.18em',
          padding: '10px 14px',
          position: 'relative',
          transition: 'color 0.15s, background 0.15s',
          whiteSpace: 'nowrap',
          display: 'flex', alignItems: 'center', gap: 5,
        }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = P.cream; }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = P.mute; }}
      >
        {item.label}
        {item.dropdown && (
          <svg width="8" height="5" viewBox="0 0 8 5" fill="none"
            style={{ transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', opacity: 0.7 }}>
            <path d="M1 1L4 4L7 1" stroke={P.gold} strokeWidth="1.5" strokeLinecap="square" />
          </svg>
        )}
        {isActive && (
          <div style={{ position: 'absolute', bottom: -1, left: 14, right: 14, height: 2, background: P.gold }} />
        )}
      </button>

      {item.dropdown && open && (
        <DropdownMenu
          items={item.dropdown}
          active={active}
          setActive={setActive}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

export default function TopNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const active = pathToLegacyId(location.pathname);
  const setActive = (id) => navigate(legacyIdToPath(id));

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 20,
      background: `linear-gradient(180deg, ${P.ink} 0%, ${P.navyDeep} 100%)`,
      borderBottom: `1px solid ${P.hairline}`,
    }}>
      <div style={{
        maxWidth: 1400, margin: '0 auto',
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '14px 32px',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer', flexShrink: 0, marginRight: 16 }}
          onClick={() => setActive('home')}>
          <img src={LOGO} alt="" style={{ height: 64, width: 'auto' }} />
          <div>
            <div style={{ color: P.cream, fontFamily: 'Oswald, sans-serif', fontSize: 16, letterSpacing: '0.22em', fontWeight: 700, lineHeight: 1, whiteSpace: 'nowrap' }}>
              TROJAN BATTALION
            </div>
            <div style={{ color: P.gold, fontFamily: "'JetBrains Mono', monospace", fontSize: 8, letterSpacing: '0.32em', marginTop: 4, opacity: 0.8, whiteSpace: 'nowrap' }}>
              SODDY DAISY HS · AJROTC
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto', gap: 0 }}>
          {NAV_ITEMS.map(item => (
            <NavItem key={item.id} item={item} active={active} setActive={setActive} />
          ))}
        </nav>

        {/* Flag + status cluster */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginLeft: 16, flexShrink: 0 }}>
          <UsFlag />
          <div style={{ width: 1, height: 22, background: P.hairline }} />
          {/* Status pill */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 12px', border: `1px solid ${P.hairline}`,
            fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
            letterSpacing: '0.2em', color: P.gold,
          }}>
            <span className="hp-blink" style={{ color: P.goldBright }}>●</span>
            <span>ACTIVE</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes dropIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-6px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </header>
  );
}
