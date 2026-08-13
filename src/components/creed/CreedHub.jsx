import { useState, useEffect, useCallback } from 'react';
import { P, MONO, DISPLAY, BODY, MASTERY_LABEL, MASTERY_COLOR } from './creedShared';
import { getProgress, masteryLevel } from '../../lib/creedProgress';
import { CREED_LINES } from '../../data/creed';
import FillBlankGame from './FillBlankGame';
import ScrambleGame from './ScrambleGame';
import SequencingGame from './SequencingGame';
import RecallGame from './RecallGame';
import SpeedGame from './SpeedGame';

const GAMES = [
  {
    key: 'fillBlank', id: 'fill-blank', label: 'Fill in the Blank',
    desc: 'Key words blanked out. Fills in as you build confidence.', icon: '▤',
  },
  {
    key: 'sequencing', id: 'sequencing', label: 'Line Sequencing',
    desc: 'Drag all 8 lines back into the correct order.', icon: '⇅',
  },
  {
    key: 'scramble', id: 'scramble', label: 'Word Scramble',
    desc: 'Unscramble one line at a time, word by word.', icon: '✳',
  },
  {
    key: 'recall', id: 'recall', label: 'Type It From Memory',
    desc: 'Live feedback as you type. Hints on, then hints off.', icon: '✎',
  },
  {
    key: 'speed', id: 'speed', label: 'Speed Challenge',
    desc: 'Beat the clock. Track your fastest clean pass.', icon: '⚡',
  },
];

export default function CreedHub() {
  const [activeGame, setActiveGame] = useState(null); // null = hub, else game key
  const [progress, setProgress] = useState(getProgress);

  const refreshProgress = useCallback(() => setProgress(getProgress()), []);

  const openGame = useCallback((key) => {
    setActiveGame(key);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const closeGame = useCallback(() => {
    setActiveGame(null);
    refreshProgress();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [refreshProgress]);

  useEffect(() => { refreshProgress(); }, [refreshProgress]);

  if (activeGame === 'fillBlank') return <FillBlankGame onExit={closeGame} />;
  if (activeGame === 'sequencing') return <SequencingGame onExit={closeGame} />;
  if (activeGame === 'scramble') return <ScrambleGame onExit={closeGame} />;
  if (activeGame === 'recall') return <RecallGame onExit={closeGame} />;
  if (activeGame === 'speed') return <SpeedGame onExit={closeGame} />;

  const masteredCount = GAMES.filter(g => masteryLevel(g.key, progress) === 'MASTERED').length;

  return (
    <div style={{ background: P.ink, minHeight: '100vh' }}>
      {/* page header */}
      <div style={{
        background: `linear-gradient(180deg, ${P.navy} 0%, ${P.navyDeep} 100%)`,
        borderBottom: `1px solid ${P.hairline}`,
        padding: '28px 24px 24px',
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{
            fontFamily: MONO, fontSize: 9, letterSpacing: '0.32em', color: P.gold, opacity: 0.6, marginBottom: 8,
          }}>// TB·002 · CADET CREED MEMORIZATION</div>
          <div style={{
            color: P.cream, fontFamily: DISPLAY, fontWeight: 700,
            fontSize: 32, letterSpacing: '0.1em', marginBottom: 10,
          }}>LEARN THE CREED</div>
          <div style={{
            fontFamily: BODY, fontSize: 14, color: P.mute, maxWidth: 560, lineHeight: 1.6, marginBottom: 16,
          }}>
            Five drills, five different ways to lock it in. Progress is saved on this device — no login needed.
          </div>
          <div style={{
            fontFamily: MONO, fontSize: 9, letterSpacing: '0.2em', color: P.gold,
          }}>{masteredCount} / {GAMES.length} MASTERED</div>
        </div>
      </div>

      {/* reference text */}
      <CreedReference />

      {/* game grid */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '8px 24px 64px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 14,
        }}>
          {GAMES.map(game => (
            <GameCard
              key={game.key}
              game={game}
              level={masteryLevel(game.key, progress)}
              record={progress[game.key]}
              onClick={() => openGame(game.key)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function CreedReference() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 24px 0' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', textAlign: 'left', background: 'transparent',
        border: `1px solid ${P.hairline}`, cursor: 'pointer',
        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
        color: P.gold, fontFamily: MONO, fontSize: 10, letterSpacing: '0.2em',
      }}>
        <span style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block' }}>›</span>
        {open ? 'HIDE' : 'SHOW'} THE FULL CREED
      </button>
      {open && (
        <div style={{
          border: `1px solid ${P.hairline}`, borderTop: 'none',
          padding: '18px 20px', background: P.navyDeep,
        }}>
          {CREED_LINES.map(line => (
            <p key={line.id} style={{
              fontFamily: BODY, fontSize: 14, lineHeight: 1.75, color: P.cream, margin: '0 0 8px',
            }}>{line.text}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function GameCard({ game, level, record, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        textAlign: 'left', border: `1px solid ${hovered ? P.hairlineStrong : P.hairline}`,
        background: hovered ? 'rgba(201,169,97,0.06)' : P.navyDeep,
        cursor: 'pointer', padding: '20px', display: 'flex', flexDirection: 'column', gap: 12,
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ fontSize: 22, color: P.gold, lineHeight: 1 }}>{game.icon}</div>
        <MasteryBadge level={level} />
      </div>
      <div style={{
        fontFamily: DISPLAY, fontWeight: 700, fontSize: 16, letterSpacing: '0.06em', color: P.cream,
      }}>{game.label}</div>
      <div style={{ fontFamily: BODY, fontSize: 13, color: P.mute, lineHeight: 1.5, flex: 1 }}>{game.desc}</div>
      <RecordLine gameKey={game.key} record={record} />
    </button>
  );
}

function MasteryBadge({ level }) {
  return (
    <div style={{
      fontFamily: MONO, fontSize: 8, letterSpacing: '0.16em',
      color: MASTERY_COLOR[level], border: `1px solid ${MASTERY_COLOR[level]}`,
      padding: '3px 7px', whiteSpace: 'nowrap', opacity: level === 'NOT_STARTED' ? 0.6 : 1,
    }}>{MASTERY_LABEL[level]}</div>
  );
}

function RecordLine({ gameKey, record }) {
  if (!record || !record.attempts) {
    return <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.1em', color: P.mute, opacity: 0.5 }}>NO ATTEMPTS YET</div>;
  }
  let text = `${record.attempts} ATTEMPT${record.attempts !== 1 ? 'S' : ''}`;
  if (gameKey === 'fillBlank' || gameKey === 'scramble') text += ` · BEST ${record.bestScore}%`;
  if (gameKey === 'sequencing' && record.bestTimeMs != null) text += ` · BEST ${(record.bestTimeMs / 1000).toFixed(1)}s`;
  if (gameKey === 'recall') text += ` · BEST ${record.bestAccuracy}%`;
  if (gameKey === 'speed') text += ` · BEST ${record.bestWpm} WPM`;
  return <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.1em', color: P.gold, opacity: 0.7 }}>{text}</div>;
}
