import { useState } from 'react';
import { Link } from 'react-router-dom';
import { legacyIdToPath } from '../lib/routes';

const P = {
  navyDeep: '#0A1628',
  gold: '#C9A961',
  goldBright: '#E8C77A',
  cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.6)',
  hairline: 'rgba(201,169,97,0.25)',
};

const JROTC = '/assets/army-jrotc.png';

// Map footer label → tab id (null = not a nav link)
const NAV_MAP = {
  'Raiders':      'raiders',
  'Rifle':        'rifle',
  'Academic':     'academic',
  'Drill':        'drill',
  'Events':       'events',
  'Submit Photos': 'submit',
  'Staff':        'staff',
  'Companies':    'companies',
  'About':        'about',
  'Cadet Manual': 'cadet-manual',
};

const COLS = [
  { h: 'PROGRAMS',  items: ['Raiders', 'Rifle', 'Academic', 'Drill'] },
  { h: 'BATTALION', items: ['Events', 'Submit Photos', 'Staff', 'Companies', 'Cadet Manual', 'About'] },
  { h: 'INFO',      items: ['Soddy Daisy HS', '618 Sequoyah Access Rd', 'Soddy Daisy, TN 37379', 'thrasher_michael@hcde.org'] },
];

function FooterLink({ label }) {
  const [hovered, setHovered] = useState(false);
  const tabId = NAV_MAP[label];

  if (!tabId) {
    // plain text — email gets a mailto link
    if (label.includes('@')) {
      return (
        <a href={`mailto:${label}`} style={{
          color: hovered ? P.cream : P.mute,
          fontFamily: 'Inter, sans-serif', fontSize: 13,
          textDecoration: 'none', transition: 'color 0.15s',
        }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >{label}</a>
      );
    }
    return (
      <div style={{ color: P.mute, fontFamily: 'Inter, sans-serif', fontSize: 13 }}>
        {label}
      </div>
    );
  }

  return (
    <Link
      to={legacyIdToPath(tabId)}
      onClick={() => window.scrollTo({ top: 0, behavior: 'instant' })}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'transparent', border: 'none', cursor: 'pointer',
        color: hovered ? P.goldBright : P.mute,
        fontFamily: 'Inter, sans-serif', fontSize: 13,
        padding: 0, textAlign: 'left',
        textDecoration: 'none',
        transition: 'color 0.15s',
      }}
    >
      {label}
    </Link>
  );
}

export default function Footer() {
  return (
    <footer className="site-footer" style={{
      background: P.navyDeep, padding: '48px 32px 28px',
      borderTop: `1px solid ${P.hairline}`,
    }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div className="footer-grid" style={{
          display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr',
          gap: 40, marginBottom: 40,
        }}>
          {/* brand block */}
          <div className="footer-brand">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <img src={JROTC} alt="" style={{ height: 44 }} />
              <div>
                <div style={{
                  color: P.cream, fontFamily: 'Oswald, sans-serif', fontWeight: 700,
                  fontSize: 16, letterSpacing: '0.22em', whiteSpace: 'nowrap',
                }}>TROJAN BATTALION</div>
                <div style={{
                  color: P.gold, fontFamily: "'JetBrains Mono', monospace", fontSize: 8,
                  letterSpacing: '0.32em', marginTop: 4, opacity: 0.8, whiteSpace: 'nowrap',
                }}>SODDY DAISY HS · AJROTC</div>
              </div>
            </div>
            <p style={{
              color: P.mute, fontFamily: 'Inter, sans-serif', fontSize: 13,
              lineHeight: 1.6, maxWidth: 380, margin: 0,
            }}>
              U.S. Army Junior ROTC. Building leaders of character through discipline,
              service, and academic excellence.
            </p>
          </div>

          {/* nav columns */}
          {COLS.map((col, i) => (
            <div key={i}>
              <div style={{
                color: P.gold, fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
                letterSpacing: '0.32em', marginBottom: 16,
              }}>{col.h}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {col.items.map((x, j) => (
                  <FooterLink key={j} label={x} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{
          paddingTop: 20, borderTop: `1px solid ${P.hairline}`,
          display: 'flex', justifyContent: 'space-between',
          fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
          letterSpacing: '0.22em', color: P.gold, opacity: 0.6,
          flexWrap: 'wrap', gap: 8,
        }}>
          <span>© 2026 SODDY DAISY HS · TROJAN BATTALION · MLWEBDESIGN</span>
          <span>v 1.0 Beta - Built By Assistant S-6 Luke Vetsch</span>
        </div>
      </div>
      <style>{`
        @media (max-width: 767px) {
          .site-footer { padding: 32px 20px 26px !important; }
          .footer-grid { grid-template-columns: 1fr 1fr !important; gap: 24px 16px !important; }
          .footer-brand { grid-column: 1 / -1 !important; }
        }
      `}</style>
    </footer>
  );
}
