import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const P = {
  navy: '#142847',
  gold: '#C9A961',
  cream: '#F4ECD8',
  white: '#FFFFFF',
  hairline: 'rgba(201,169,97,0.25)',
};

const ITEMS = [
  { id: 'cadet-manual', title: 'Cadet Manual',  body: 'Standards, regulations, uniform guide, and chain of command.', code: 'TB·001' },
  { id: 'raiders',      title: 'Raiders',       body: 'Physical fitness team competing in cross-country rescue, rope bridge, and obstacle events.', code: 'TB·002' },
  { id: 'submit',       title: 'Submit Photos', body: 'Upload competition & practice photos for any specialty team. Raider shots go into Funny, Aura, and Team-Leading voting.', code: 'TB·008' },
  { id: 'rifle',        title: 'Rifle',         body: 'Marksmanship team training with precision air rifle.', code: 'TB·003' },
  { id: 'academic',     title: 'Academic',      body: 'JLAB academic bowl competitors representing the battalion regionally.', code: 'TB·004' },
  { id: 'drill',        title: 'Drill',         body: 'Armed and unarmed drill teams performing regulation and exhibition routines.', code: 'TB·005' },
  { id: 'events',       title: 'Events',        body: 'Full battalion calendar and photos from formations, parades, competitions, and ceremonies.', code: 'TB·006' },
  { id: 'staff',        title: 'Leadership',    body: 'Meet the cadet officers, NCOs, and staff section leads who run the battalion.', code: 'TB·007' },
];

// Corner brackets rendered on every tile — gold, dim at rest, bright on hover.
function TileBrackets({ active }) {
  const stroke = active ? P.gold : 'rgba(201,169,97,0.35)';
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', transition: 'opacity 0.2s' }}>
      <svg width="14" height="14" viewBox="0 0 14 14" style={{ position: 'absolute', top: 14, right: 14 }}>
        <path d="M 0 0 L 14 0 L 14 14" stroke={stroke} strokeWidth="2" fill="none" style={{ transition: 'stroke 0.2s' }} />
      </svg>
      <svg width="14" height="14" viewBox="0 0 14 14" style={{ position: 'absolute', bottom: 14, left: 14 }}>
        <path d="M 0 0 L 0 14 L 14 14" stroke={stroke} strokeWidth="2" fill="none" style={{ transition: 'stroke 0.2s' }} />
      </svg>
    </div>
  );
}

export default function TabGrid() {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(null);

  return (
    <section style={{
      background: P.cream, padding: '72px 32px',
      borderBottom: `4px solid ${P.gold}`,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* faint hairline grid backdrop — ties this section to the rest of the page */}
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.05,
        backgroundImage: `linear-gradient(${P.navy} 1px, transparent 1px), linear-gradient(90deg, ${P.navy} 1px, transparent 1px)`,
        backgroundSize: '56px 56px',
      }} />

      <div style={{ maxWidth: 1400, margin: '0 auto', position: 'relative' }}>
        <div style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          marginBottom: 40, gap: 32,
        }}>
          <div>
            <div style={{
              color: P.navy, opacity: 0.6, fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10, letterSpacing: '0.32em', marginBottom: 12,
            }}>// S-3 OPERATIONS · FULL DIRECTORY</div>
            <div style={{
              color: P.navy, fontFamily: 'Oswald, sans-serif', fontWeight: 700,
              fontSize: 48, letterSpacing: '0.04em', lineHeight: 0.95,
            }}>THE DIRECTORY</div>
          </div>
          <p style={{
            color: P.navy, opacity: 0.7, fontFamily: 'Inter, sans-serif',
            fontSize: 14, lineHeight: 1.6, maxWidth: 380, margin: 0,
          }}>
            Seven specialty programs. One battalion. Choose a section to explore the
            teams, instructors, and resources that make up the Trojan Battalion.
          </p>
        </div>

        <div className="tab-grid" style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16,
        }}>
          {ITEMS.map((it, i) => {
            const isFeatured = i === 0;
            const isWide = i === 6; // Events — highest-traffic section, gets bento rhythm too
            const isHovered = hovered === it.id;
            return (
              <button key={it.id}
                onClick={() => navigate(`/${it.id}`)}
                onMouseEnter={() => setHovered(it.id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  textAlign: 'left', cursor: 'pointer',
                  background: isFeatured ? P.navy : P.white,
                  color: isFeatured ? P.cream : P.navy,
                  border: isFeatured ? 'none' : '1px solid rgba(20,40,71,0.12)',
                  borderTop: isHovered ? `3px solid ${P.gold}` : (isFeatured ? 'none' : '3px solid transparent'),
                  padding: '24px 22px', minHeight: isWide ? 140 : 220,
                  display: 'flex', flexDirection: 'column',
                  gridColumn: isFeatured ? 'span 2' : (isWide ? 'span 2' : 'span 1'),
                  gridRow: isFeatured ? 'span 2' : 'span 1',
                  position: 'relative', overflow: 'hidden',
                  transform: isHovered ? 'translateY(-3px)' : 'translateY(0)',
                  boxShadow: isHovered ? '0 18px 32px -18px rgba(20,40,71,0.35)' : 'none',
                  transition: 'transform 0.3s cubic-bezier(0.16,1,0.3,1), box-shadow 0.3s cubic-bezier(0.16,1,0.3,1), border-top-color 0.2s',
                }}>
                <TileBrackets active={isHovered} />
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
                  letterSpacing: '0.28em', opacity: 0.6,
                }}>{it.code} · 0{i + 1}</div>
                <div style={{
                  fontFamily: 'Oswald, sans-serif', fontWeight: 700,
                  fontSize: isFeatured ? 56 : (isWide ? 34 : 26),
                  letterSpacing: '0.02em', lineHeight: 0.95,
                  marginTop: 'auto', marginBottom: 12,
                }}>{it.title.toUpperCase()}</div>
                <div style={{
                  fontFamily: 'Inter, sans-serif', fontSize: 13,
                  lineHeight: 1.55, opacity: 0.8, maxWidth: isFeatured || isWide ? 420 : 'auto',
                }}>{it.body}</div>
                <div style={{
                  marginTop: 16, fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9, letterSpacing: '0.32em',
                  color: isFeatured ? P.gold : P.navy,
                  opacity: isFeatured ? 1 : 0.6,
                }}>OPEN →</div>
              </button>
            );
          })}
        </div>
      </div>

      <style>{`@media (max-width: 760px) { .tab-grid { grid-template-columns: repeat(2, 1fr) !important; } }`}</style>
    </section>
  );
}
