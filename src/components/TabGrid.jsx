import { useState } from 'react';

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
  { id: 'pictures',     title: 'Pictures',      body: 'Photo archive: formations, parades, competitions, and ceremonies.', code: 'TB·006' },
  { id: 'staff',        title: 'Leadership',    body: 'Meet the cadet officers, NCOs, and staff section leads who run the battalion.', code: 'TB·007' },
];

export default function TabGrid({ setActive }) {
  const [hovered, setHovered] = useState(null);

  return (
    <section style={{
      background: P.cream, padding: '72px 32px',
      borderBottom: `4px solid ${P.gold}`,
    }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          marginBottom: 40, gap: 32,
        }}>
          <div>
            <div style={{
              color: P.navy, opacity: 0.6, fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10, letterSpacing: '0.32em', marginBottom: 12,
            }}>// SECTIONS · 08</div>
            <div style={{
              color: P.navy, fontFamily: 'Oswald, sans-serif', fontWeight: 700,
              fontSize: 48, letterSpacing: '0.04em', lineHeight: 0.95,
            }}>THE BATTALION</div>
          </div>
          <p style={{
            color: P.navy, opacity: 0.7, fontFamily: 'Inter, sans-serif',
            fontSize: 14, lineHeight: 1.6, maxWidth: 380, margin: 0,
          }}>
            Seven specialty programs. One battalion. Choose a section to explore the
            teams, instructors, and resources that make up the Trojan Battalion.
          </p>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16,
        }}>
          {ITEMS.map((it, i) => (
            <button key={it.id}
              onClick={() => setActive(it.id)}
              onMouseEnter={() => setHovered(it.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                textAlign: 'left', cursor: 'pointer',
                background: i === 0 ? P.navy : P.white,
                color: i === 0 ? P.cream : P.navy,
                border: i === 0 ? 'none' : '1px solid rgba(20,40,71,0.12)',
                padding: '24px 22px', minHeight: 220,
                display: 'flex', flexDirection: 'column',
                gridColumn: i === 0 ? 'span 2' : 'span 1',
                gridRow: i === 0 ? 'span 2' : 'span 1',
                position: 'relative', overflow: 'hidden',
                transform: hovered === it.id ? 'translateY(-2px)' : 'translateY(0)',
                transition: 'transform 0.2s',
              }}>
              {/* corner brackets on featured card */}
              {i === 0 && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" style={{ position: 'absolute', top: 14, right: 14 }}>
                    <path d="M 0 0 L 14 0 L 14 14" stroke={P.gold} strokeWidth="2" fill="none" />
                  </svg>
                  <svg width="14" height="14" viewBox="0 0 14 14" style={{ position: 'absolute', bottom: 14, left: 14 }}>
                    <path d="M 0 0 L 0 14 L 14 14" stroke={P.gold} strokeWidth="2" fill="none" />
                  </svg>
                </div>
              )}
              <div style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
                letterSpacing: '0.28em', opacity: 0.6,
              }}>{it.code} · 0{i + 1}</div>
              <div style={{
                fontFamily: 'Oswald, sans-serif', fontWeight: 700,
                fontSize: i === 0 ? 56 : 26,
                letterSpacing: '0.02em', lineHeight: 0.95,
                marginTop: 'auto', marginBottom: 12,
              }}>{it.title.toUpperCase()}</div>
              <div style={{
                fontFamily: 'Inter, sans-serif', fontSize: 13,
                lineHeight: 1.55, opacity: 0.8, maxWidth: i === 0 ? 360 : 'auto',
              }}>{it.body}</div>
              <div style={{
                marginTop: 16, fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9, letterSpacing: '0.32em',
                color: i === 0 ? P.gold : P.navy,
                opacity: i === 0 ? 1 : 0.6,
              }}>OPEN →</div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
