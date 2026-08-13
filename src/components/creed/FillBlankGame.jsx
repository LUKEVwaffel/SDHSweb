import { useState, useMemo, useCallback, useEffect } from 'react';
import { CREED_TOKENIZED } from '../../data/creed';
import { recordResult } from '../../lib/creedProgress';
import { P, MONO, DISPLAY, BODY } from './creedShared';
import { GameHeader, GoldButton, ResultPanel } from './CreedUi';

const DIFFICULTY = {
  EASY: { label: 'Easy', fraction: 1 / 8, minLen: 4 },   // ~1 blank/line, longer words only
  MEDIUM: { label: 'Medium', fraction: 1 / 3, minLen: 3 },
  HARD: { label: 'Hard', fraction: 2 / 3, minLen: 0 },
};

// Deterministic-enough shuffle for picking which word indices get blanked —
// re-rolled each time the player starts a new round via the `seed` dep.
function pickBlankIndices(words, fraction, minLen, seed) {
  const eligible = words.filter(w => w.clean.length > minLen);
  const count = Math.max(1, Math.round(eligible.length * fraction));
  const shuffled = [...eligible].sort((a, b) => {
    const ha = Math.sin(seed + a.idx * 13.37) * 10000;
    const hb = Math.sin(seed + b.idx * 13.37) * 10000;
    return (ha - Math.floor(ha)) - (hb - Math.floor(hb));
  });
  return new Set(shuffled.slice(0, count).map(w => w.idx));
}

function buildRound(difficulty, seed) {
  const cfg = DIFFICULTY[difficulty];
  return CREED_TOKENIZED.map(line => {
    const blankIdxs = pickBlankIndices(line.words, cfg.fraction, cfg.minLen, seed + line.id);
    return { ...line, blankIdxs };
  });
}

export default function FillBlankGame({ onExit }) {
  const [difficulty, setDifficulty] = useState(null); // null = picker screen
  const [seed, setSeed] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const round = useMemo(() => (difficulty ? buildRound(difficulty, seed) : null), [difficulty, seed]);

  const totalBlanks = useMemo(
    () => round ? round.reduce((sum, l) => sum + l.blankIdxs.size, 0) : 0,
    [round]
  );

  const correctCount = useMemo(() => {
    if (!round || !submitted) return 0;
    let n = 0;
    for (const line of round) {
      for (const idx of line.blankIdxs) {
        const key = `${line.id}-${idx}`;
        const expected = line.words[idx].clean.toLowerCase();
        const given = (answers[key] || '').trim().toLowerCase();
        if (given === expected) n++;
      }
    }
    return n;
  }, [round, submitted, answers]);

  const score = totalBlanks ? Math.round((correctCount / totalBlanks) * 100) : 0;

  const startDifficulty = useCallback((d) => {
    setDifficulty(d);
    setAnswers({});
    setSubmitted(false);
  }, []);

  const retry = useCallback(() => {
    setSeed(s => s + 1);
    setAnswers({});
    setSubmitted(false);
  }, []);

  const submit = useCallback(() => {
    setSubmitted(true);
  }, []);

  // Fire the localStorage write exactly once per submitted round.
  useEffect(() => {
    if (!submitted) return;
    recordResult('fillBlank', current => ({
      bestScore: Math.max(current.bestScore || 0, score),
    }));
  }, [submitted]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!difficulty) {
    return (
      <div style={{ background: P.ink, minHeight: '100vh' }}>
        <GameHeader title="Fill in the Blank" onBack={onExit} />
        <div style={{ maxWidth: 480, margin: '48px auto', padding: '0 24px', textAlign: 'center' }}>
          <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.28em', color: P.gold, opacity: 0.6, marginBottom: 14 }}>
            CHOOSE DIFFICULTY
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(DIFFICULTY).map(([key, cfg]) => (
              <button key={key} onClick={() => startDifficulty(key)} style={{
                background: P.navyDeep, border: `1px solid ${P.hairline}`, cursor: 'pointer',
                padding: '16px 20px', textAlign: 'left', color: P.cream,
                fontFamily: DISPLAY, fontWeight: 600, fontSize: 15, letterSpacing: '0.06em',
              }}>
                {cfg.label.toUpperCase()}
                <span style={{ display: 'block', fontFamily: BODY, fontSize: 12, color: P.mute, fontWeight: 400, marginTop: 4 }}>
                  {key === 'EASY' && 'One blank per line, longer words only'}
                  {key === 'MEDIUM' && 'About a third of each line blanked'}
                  {key === 'HARD' && 'Most of each line blanked'}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={{ background: P.ink, minHeight: '100vh' }}>
        <GameHeader title="Fill in the Blank" onBack={onExit} />
        <ResultPanel
          heading={`${score}% CORRECT`}
          stats={[
            { label: 'CORRECT', value: `${correctCount}/${totalBlanks}` },
            { label: 'DIFFICULTY', value: DIFFICULTY[difficulty].label.toUpperCase() },
          ]}
          onRetry={retry}
          onBack={onExit}
        />
      </div>
    );
  }

  return (
    <div style={{ background: P.ink, minHeight: '100vh' }}>
      <GameHeader
        title="Fill in the Blank"
        onBack={onExit}
        right={<span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.16em', color: P.mute }}>{DIFFICULTY[difficulty].label.toUpperCase()}</span>}
      />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px 64px' }}>
        {round.map(line => (
          <p key={line.id} style={{ fontFamily: BODY, fontSize: 16, lineHeight: 2.2, color: P.cream, margin: '0 0 6px' }}>
            {line.words.map((w, i) => {
              if (!line.blankIdxs.has(i)) return <span key={i}>{w.raw} </span>;
              const key = `${line.id}-${i}`;
              return (
                <input
                  key={i}
                  value={answers[key] || ''}
                  onChange={e => setAnswers(a => ({ ...a, [key]: e.target.value }))}
                  style={{
                    width: Math.max(60, w.clean.length * 11),
                    background: 'rgba(201,169,97,0.08)',
                    border: 'none', borderBottom: `2px solid ${P.gold}`,
                    color: P.goldBright, fontFamily: BODY, fontSize: 15,
                    padding: '2px 6px', margin: '0 2px', outline: 'none',
                  }}
                />
              );
            })}
          </p>
        ))}
        <div style={{ marginTop: 28, display: 'flex', justifyContent: 'center' }}>
          <GoldButton onClick={submit}>CHECK ANSWERS</GoldButton>
        </div>
      </div>
    </div>
  );
}
