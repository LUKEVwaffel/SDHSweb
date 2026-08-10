import { useState, useEffect, useRef } from 'react';
import { P, mono, fraunces, inter, fs, sp, ease } from '../admin/theme.js';
import { useNowTicker } from '../../hooks/useNowTicker.js';
import { todaysFacts } from '../../lib/historicalFacts.js';

const ROTATE_MS = 45000;

function PanelStyles() {
  return (
    <style>{`
      @keyframes tvFactIn {
        from { opacity: 0; transform: translateY(10px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes tvYearIn {
        from { opacity: 0; transform: translateY(6px) scale(0.97); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }
      .tv-fact-body { animation: tvFactIn 700ms ${ease} 120ms both; }
      .tv-fact-year { animation: tvYearIn 700ms ${ease} both; }
      .tv-fact-dropcap {
        float: left; font-family: ${fraunces}; font-style: italic; font-weight: 700;
        font-size: 2.6em; line-height: 0.78; padding: 0.03em 0.09em 0 0; color: ${P.gold};
      }
      @media (prefers-reduced-motion: reduce) {
        .tv-fact-body, .tv-fact-year { animation: none; }
      }
    `}</style>
  );
}

// Oversized, near-invisible year sitting behind the content — the editorial
// "watermark numeral" trick that gives the panel depth without competing
// with the readable headline year in front of it.
function GhostYear({ year }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute', top: '-0.14em', right: '-0.05em',
        fontFamily: fraunces, fontWeight: 900, fontStyle: 'italic',
        fontSize: 'clamp(64px, 13vh, 168px)', lineHeight: 1, color: P.gold, opacity: 0.05,
        letterSpacing: '-0.02em', pointerEvents: 'none', userSelect: 'none',
      }}
    >
      {year}
    </div>
  );
}

function RotationDots({ count, active }) {
  if (count <= 1) return null;
  return (
    <div style={{ display: 'flex', gap: 6, marginTop: sp[2] }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            width: i === active ? 16 : 6, height: 3, borderRadius: 2,
            background: i === active ? P.gold : P.hairStrong,
            transition: `all 400ms ${ease}`,
          }}
        />
      ))}
    </div>
  );
}

export default function TvHistoryPanel() {
  const now = useNowTicker();
  const facts = todaysFacts(now);
  const [i, setI] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (facts.length <= 1) return;
    timerRef.current = setTimeout(() => setI((n) => (n + 1) % facts.length), ROTATE_MS);
    return () => clearTimeout(timerRef.current);
  }, [i, facts.length]);

  // If the day rolls over (or the fact count changes), don't stay stuck past the array end.
  const fact = facts[i % Math.max(facts.length, 1)];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
      <PanelStyles />

      {fact && <GhostYear year={fact.year} />}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
        <div style={{ width: 14, height: 2, background: P.gold }} />
        <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.28em' }}>
          ON THIS DAY
        </div>
        <div style={{ flex: 1, height: 1, background: P.hair }} />
      </div>

      {!fact ? (
        <div style={{ fontFamily: inter, fontSize: fs.base, color: P.mute, marginTop: sp[4] }}>
          No facts on file for today.
        </div>
      ) : (
        <div key={i} style={{ position: 'relative', marginTop: sp[2] }}>
          <div
            className="tv-fact-year"
            style={{
              fontFamily: fraunces, fontStyle: 'italic', fontWeight: 900,
              fontSize: 'clamp(30px, 6vh, 92px)', lineHeight: 0.86, letterSpacing: '-0.015em',
              backgroundImage: `linear-gradient(135deg, ${P.bright}, ${P.gold} 65%)`,
              WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
            }}
          >
            {fact.year}
          </div>

          <div style={{ width: 40, height: 3, background: P.gold, opacity: 0.55, margin: `${sp[2]}px 0` }} />

          <div
            className="tv-fact-body"
            style={{
              fontFamily: inter, fontSize: fs.base, color: P.cream, lineHeight: 1.45,
              borderLeft: `2px solid ${P.hairStrong}`, paddingLeft: sp[3],
            }}
          >
            <span className="tv-fact-dropcap">{fact.text.charAt(0)}</span>
            {fact.text.slice(1)}
          </div>

          <RotationDots count={facts.length} active={i} />
        </div>
      )}
    </div>
  );
}
