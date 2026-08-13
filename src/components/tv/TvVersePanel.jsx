import { useState, useEffect, useRef, useMemo } from 'react';
import { P, mono, oswald, inter, fs, sp, ease } from '../admin/theme.js';
import verses from '../../data/verses.json';

const ROTATE_MS = 45000;

function FadeInStyles() {
  return (
    <style>{`
      @keyframes tvVerseIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      .tv-verse { animation: tvVerseIn 600ms ${ease}; }
      @media (prefers-reduced-motion: reduce) { .tv-verse { animation: none; } }
    `}</style>
  );
}

export default function TvVersePanel({ selectedIds = [] }) {
  const pool = useMemo(
    () => (selectedIds.length ? verses.filter((v) => selectedIds.includes(v.id)) : verses),
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

  const verse = pool[i % Math.max(pool.length, 1)];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: sp[2] }}>
      <FadeInStyles />
      <div style={{ fontFamily: mono, fontSize: fs.xs, color: P.gold, letterSpacing: '0.24em' }}>
        VERSE OF THE DAY
      </div>
      {!verse ? (
        <div style={{ fontFamily: inter, fontSize: fs.md, color: P.mute }}>No verse on file.</div>
      ) : (
        <div key={i} className="tv-verse" style={{ display: 'flex', flexDirection: 'column', gap: sp[2] }}>
          <div style={{ fontFamily: inter, fontSize: fs.lg, color: P.cream, lineHeight: 1.5 }}>
            {verse.text}
          </div>
          <div style={{ fontFamily: oswald, fontSize: fs.md, color: P.gold, marginTop: sp[1] }}>
            — {verse.reference}
          </div>
        </div>
      )}
    </div>
  );
}
