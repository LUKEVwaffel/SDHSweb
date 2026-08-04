import { useState } from 'react';

const P = {
  navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.55)', hair: 'rgba(201,169,97,0.22)',
};
const mono = "'JetBrains Mono', monospace";
const oswald = 'Oswald, sans-serif';

// Starter questions — content is a placeholder draft, meant to be edited.
const FAQS = [
  { q: 'What is the Raiders team?', a: 'Raiders is the Trojan Battalion’s physical fitness and tactical skills competition team. Events include rope bridges, obstacle courses, land navigation, and team relays against other JROTC battalions.' },
  { q: 'How much time does it take?', a: 'Practices run a few times a week after school, with additional sessions in the weeks before a competition. Exact schedule is announced each season and posted on the calendar below.' },
  { q: 'How do I join?', a: 'Any enrolled JROTC cadet can join, no tryout required to start. Talk to a Raiders commander or the Senior Army Instructor to get added to practices.' },
  { q: 'Do I need to already be fit?', a: 'No prior fitness level is required. Training builds up over the season, and cadets of all starting fitness levels are welcome.' },
  { q: 'What does the competition schedule look like?', a: 'The team competes at scheduled meets throughout the school year, typically against other battalions in the region. See the Event Calendar section below for upcoming dates.' },
  { q: 'Is prior JROTC experience needed?', a: 'No. Raiders is open to cadets at any point in the JROTC program, including first-year cadets.' },
];

function ChevronIcon({ open }) {
  return (
    <span style={{
      color: P.gold, fontSize: 16, opacity: 0.7,
      transform: open ? 'rotate(90deg)' : 'none',
      transition: 'transform 0.2s', display: 'inline-block', flexShrink: 0,
    }}>›</span>
  );
}

export default function RaiderFAQ() {
  const [openIdx, setOpenIdx] = useState(null);
  const toggle = (i) => setOpenIdx((cur) => (cur === i ? null : i));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {FAQS.map((item, i) => {
        const open = openIdx === i;
        return (
          <div key={i} style={{ border: `1px solid ${P.hair}`, background: P.navy, overflow: 'hidden' }}>
            <button
              onClick={() => toggle(i)}
              aria-expanded={open}
              style={{
                width: '100%', textAlign: 'left',
                background: open ? 'rgba(201,169,97,0.06)' : 'transparent',
                border: 'none', cursor: 'pointer',
                padding: '16px 20px',
                display: 'flex', alignItems: 'center', gap: 14,
              }}
            >
              <div style={{ fontFamily: mono, fontSize: 9, color: P.gold, letterSpacing: '0.2em', opacity: 0.6, flexShrink: 0 }}>
                Q{String(i + 1).padStart(2, '0')}
              </div>
              <div style={{ fontFamily: oswald, fontWeight: 700, fontSize: 15, letterSpacing: '0.02em', color: P.cream, flex: 1 }}>
                {item.q}
              </div>
              <ChevronIcon open={open} />
            </button>
            {open && (
              <div style={{ borderTop: `1px solid ${P.hair}`, padding: '16px 20px 20px 54px' }}>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: P.mute, lineHeight: 1.7, margin: 0 }}>
                  {item.a}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
