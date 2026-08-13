import { useState, useMemo, useEffect, useCallback } from 'react';
import { CREED_TOKENIZED } from '../../data/creed';
import { recordResult } from '../../lib/creedProgress';
import { P, MONO, BODY } from './creedShared';
import { GameHeader, GoldButton, GhostButton, ResultPanel } from './CreedUi';

function seededShuffle(items, seed) {
  return items
    .map((item, i) => ({ item, key: Math.sin(seed + i * 7.919) }))
    .sort((a, b) => (a.key - Math.floor(a.key)) - (b.key - Math.floor(b.key)))
    .map(x => x.item);
}

// Guarantees the shuffle isn't accidentally identical to the original order
// (trivial for short lines) by reshuffling with a bumped seed if it matches.
function scrambleLine(words, seed) {
  let shuffled = seededShuffle(words, seed);
  let attempt = seed;
  while (words.length > 1 && shuffled.every((w, i) => w.idx === words[i].idx)) {
    attempt += 1;
    shuffled = seededShuffle(words, attempt);
  }
  return shuffled;
}

export default function ScrambleGame({ onExit }) {
  const [lineIdx, setLineIdx] = useState(0);
  const [seed, setSeed] = useState(0);
  const [placed, setPlaced] = useState([]);
  const [resets, setResets] = useState(0);
  const [lineScores, setLineScores] = useState([]);
  const [done, setDone] = useState(false);

  const line = CREED_TOKENIZED[lineIdx];
  const pool = useMemo(() => {
    const scrambled = scrambleLine(line.words, seed + line.id * 31);
    return scrambled.filter(w => !placed.some(p => p.idx === w.idx));
  }, [line, seed, placed]);

  const isFull = placed.length === line.words.length;
  const isCorrect = isFull && placed.every((w, i) => w.idx === i);
  const isWrong = isFull && !isCorrect;

  const place = useCallback((word) => {
    if (isFull) return;
    setPlaced(p => [...p, word]);
  }, [isFull]);

  const resetLine = useCallback(() => {
    setPlaced([]);
    setResets(r => r + 1);
  }, []);

  const nextLine = useCallback(() => {
    const score = Math.max(0, 100 - resets * 25);
    setLineScores(s => [...s, score]);
    setPlaced([]);
    setResets(0);
    if (lineIdx + 1 < CREED_TOKENIZED.length) {
      setLineIdx(i => i + 1);
    } else {
      setDone(true);
    }
  }, [resets, lineIdx]);

  const overallScore = useMemo(() => {
    if (!lineScores.length) return 0;
    return Math.round(lineScores.reduce((a, b) => a + b, 0) / lineScores.length);
  }, [lineScores]);

  useEffect(() => {
    if (!done) return;
    recordResult('scramble', current => ({
      bestScore: Math.max(current.bestScore || 0, overallScore),
    }));
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  const retryAll = useCallback(() => {
    setLineIdx(0);
    setSeed(s => s + 1);
    setPlaced([]);
    setResets(0);
    setLineScores([]);
    setDone(false);
  }, []);

  if (done) {
    return (
      <div style={{ background: P.ink, minHeight: '100vh' }}>
        <GameHeader title="Word Scramble" onBack={onExit} />
        <ResultPanel
          heading={`${overallScore}% CLEAN`}
          stats={[{ label: 'LINES', value: CREED_TOKENIZED.length }, { label: 'AVG SCORE', value: `${overallScore}%` }]}
          onRetry={retryAll}
          onBack={onExit}
        />
      </div>
    );
  }

  return (
    <div style={{ background: P.ink, minHeight: '100vh' }}>
      <GameHeader
        title="Word Scramble"
        onBack={onExit}
        right={<span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.16em', color: P.mute }}>LINE {lineIdx + 1}/{CREED_TOKENIZED.length}</span>}
      />
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px 64px' }}>
        {/* answer row */}
        <div style={{
          minHeight: 56, border: `1px solid ${isCorrect ? P.correct : isWrong ? P.red : P.hairlineStrong}`,
          background: isCorrect ? P.correctBg : isWrong ? P.wrongBg : 'rgba(0,0,0,0.3)',
          padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
          marginBottom: 20, transition: 'background 0.2s, border-color 0.2s',
        }}>
          {placed.length === 0 && (
            <span style={{ fontFamily: BODY, fontSize: 13, color: P.mute, opacity: 0.5 }}>Tap words below in order…</span>
          )}
          {placed.map((w, i) => (
            <span key={i} style={{
              fontFamily: BODY, fontSize: 15, color: P.cream,
              background: 'rgba(201,169,97,0.1)', border: `1px solid ${P.hairline}`, padding: '4px 10px',
            }}>{w.raw}</span>
          ))}
        </div>

        {isCorrect && (
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.14em', color: P.correct, marginBottom: 16 }}>
            ✓ CORRECT {resets > 0 && `(${resets} RESET${resets !== 1 ? 'S' : ''})`}
          </div>
        )}
        {isWrong && (
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.14em', color: P.red, marginBottom: 16 }}>
            ✕ NOT QUITE — RESET AND TRY AGAIN
          </div>
        )}

        {/* word pool */}
        {!isCorrect && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 28 }}>
            {pool.map(w => (
              <button key={w.idx} onClick={() => place(w)} disabled={isWrong} style={{
                background: P.navyDeep, border: `1px solid ${P.hairline}`,
                color: P.cream, cursor: isWrong ? 'default' : 'pointer',
                fontFamily: BODY, fontSize: 15, padding: '8px 14px',
                opacity: isWrong ? 0.4 : 1,
              }}>{w.raw}</button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12 }}>
          {isCorrect ? (
            <GoldButton onClick={nextLine}>{lineIdx + 1 < CREED_TOKENIZED.length ? 'NEXT LINE →' : 'FINISH'}</GoldButton>
          ) : (
            <GhostButton onClick={resetLine}>RESET LINE</GhostButton>
          )}
        </div>
      </div>
    </div>
  );
}
