import { useState, useEffect, useRef, useMemo } from 'react';
import { P, mono, oswald, inter, fs, sp, ease } from '../admin/theme.js';
import quotes from '../../data/quotes.json';

const ROTATE_MS = 45000;

function FadeInStyles() {
  return (
    <style>{`
      @keyframes tvQuoteIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      .tv-quote { animation: tvQuoteIn 600ms ${ease}; }
      @media (prefers-reduced-motion: reduce) { .tv-quote { animation: none; } }
    `}</style>
  );
}

// Cycles through the 1SGT's curated subset for the day (or the full library
// when nothing's been picked) — same 45s rotation rhythm as TvHistoryPanel,
// so the bottom widget always feels like one consistent instrument no matter
// which mode is active.
export default function TvQuotePanel({ selectedIds = [] }) {
  const pool = useMemo(
    () => (selectedIds.length ? quotes.filter((q) => selectedIds.includes(q.id)) : quotes),
    [selectedIds]
  );
  const [i, setI] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => { setI(0); }, [pool]);

  useEffect(() => {
    if (pool.length <= 1) return;
    timerRef.current = setTimeout(() => setI((n) => (n + 1) % pool.length), ROTATE_MS);
    return () => clearTimeout(timerRef.current);
  }, [i, pool.length]);

  const quote = pool[i % Math.max(pool.length, 1)];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: sp[2] }}>
      <FadeInStyles />
      <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.24em' }}>
        QUOTE OF THE DAY
      </div>
      {!quote ? (
        <div style={{ fontFamily: inter, fontSize: fs.base, color: P.mute }}>No quote on file.</div>
      ) : (
        <div key={i} className="tv-quote" style={{ display: 'flex', flexDirection: 'column', gap: sp[1] }}>
          <div style={{ fontFamily: inter, fontSize: fs.base, color: P.cream, lineHeight: 1.5 }}>
            "{quote.text}"
          </div>
          <div style={{ fontFamily: oswald, fontSize: fs.sm, color: P.gold, marginTop: sp[1] }}>
            — {quote.author}{quote.source ? `, ${quote.source}` : ''}
          </div>
        </div>
      )}
    </div>
  );
}
