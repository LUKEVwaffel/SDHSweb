import { useState, useEffect, useRef } from 'react';
import { P, mono, oswald, inter, fs, sp, ease } from '../admin/theme.js';
import { useNowTicker } from '../../hooks/useNowTicker.js';
import { todaysFacts } from '../../lib/historicalFacts.js';

const ROTATE_MS = 45000;

function FadeInStyles() {
  return (
    <style>{`
      @keyframes tvFactIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      .tv-fact { animation: tvFactIn 600ms ${ease}; }
      @media (prefers-reduced-motion: reduce) { .tv-fact { animation: none; } }
    `}</style>
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
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: sp[2] }}>
      <FadeInStyles />
      <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.24em' }}>
        ON THIS DAY
      </div>
      {!fact ? (
        <div style={{ fontFamily: inter, fontSize: fs.base, color: P.mute }}>
          No facts on file for today.
        </div>
      ) : (
        <div key={i} className="tv-fact" style={{ display: 'flex', flexDirection: 'column', gap: sp[2] }}>
          <div style={{ fontFamily: oswald, fontSize: fs.lg, fontWeight: 600, color: P.gold }}>
            {fact.year}
          </div>
          <div style={{ fontFamily: inter, fontSize: fs.base, color: P.cream, lineHeight: 1.5 }}>
            {fact.text}
          </div>
        </div>
      )}
    </div>
  );
}
