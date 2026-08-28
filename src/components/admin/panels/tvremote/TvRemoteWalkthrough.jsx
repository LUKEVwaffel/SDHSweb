import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { P, mono, oswald, inter, fs, sp, radius, shadow, ease } from '../../theme';
import { Btn } from '../../shared/ui';
import { WALKTHROUGH } from './tvRemoteHelpContent';

// First-run guided tour for the BC. Eight short slides, Back / Next / Skip,
// progress dots, arrow-key navigation. `onDone` fires on finish OR skip - the
// caller records that the tour is complete either way (skipping once is a
// deliberate "I've got it", not something to nag about).
export default function TvRemoteWalkthrough({ onDone, name, avatarUrl }) {
  const [i, setI] = useState(0);
  const total = WALKTHROUGH.length;
  const slide = WALKTHROUGH[i];
  const last = i === total - 1;
  const first = i === 0;

  const next = useCallback(() => (last ? onDone() : setI((n) => n + 1)), [last, onDone]);
  const back = useCallback(() => setI((n) => Math.max(0, n - 1)), []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onDone();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, back, onDone]);

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1100, padding: sp[4],
      background: 'rgba(6,16,31,0.82)', backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: '100%', maxWidth: 560, background: P.navy,
        border: `1px solid ${P.gold}`, borderRadius: radius.lg, boxShadow: shadow.lg,
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}>
        {/* header strip */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: `${sp[3]}px ${sp[5]}px`, borderBottom: `1px solid ${P.hair}`,
        }}>
          <span style={{ fontFamily: mono, fontSize: 9, color: P.gold, letterSpacing: '0.24em' }}>
            TV REMOTE - QUICK TOUR
          </span>
          <span style={{ fontFamily: mono, fontSize: 9, color: P.faint, letterSpacing: '0.16em' }}>
            {i + 1} / {total}
          </span>
        </div>

        {/* slide body */}
        <div style={{ padding: `${sp[8]}px ${sp[8]}px ${sp[6]}px`, minHeight: 300 }}>
          {first && (name || avatarUrl) ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: sp[3], marginBottom: sp[5] }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="" style={{
                  width: 56, height: 56, borderRadius: '50%', objectFit: 'cover',
                  border: `1px solid ${P.hairStrong}`,
                }} />
              ) : (
                <div style={{ fontSize: 44, lineHeight: 1 }} aria-hidden>{slide.icon}</div>
              )}
              {name && (
                <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.gold, letterSpacing: '0.14em' }}>
                  {name.toUpperCase()}
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 44, lineHeight: 1, marginBottom: sp[5] }} aria-hidden>{slide.icon}</div>
          )}
          <div style={{
            fontFamily: oswald, fontSize: fs.xl, color: P.cream, fontWeight: 600,
            letterSpacing: '0.01em', marginBottom: sp[4],
          }}>
            {slide.title}
          </div>
          {slide.body.map((para, idx) => (
            <p key={idx} style={{
              fontFamily: inter, fontSize: fs.base, color: P.mute, lineHeight: 1.65,
              margin: `0 0 ${sp[3]}px`,
            }}>
              {para}
            </p>
          ))}
        </div>

        {/* progress dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 7, padding: `0 ${sp[5]}px ${sp[4]}px` }}>
          {WALKTHROUGH.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setI(idx)}
              aria-label={`Go to step ${idx + 1}`}
              style={{
                width: idx === i ? 22 : 7, height: 7, borderRadius: radius.pill, border: 'none',
                background: idx === i ? P.gold : P.hairStrong, cursor: 'pointer',
                transition: `all 200ms ${ease}`,
              }}
            />
          ))}
        </div>

        {/* footer controls */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: `${sp[3]}px ${sp[5]}px`, borderTop: `1px solid ${P.hair}`, background: P.deep,
        }}>
          <button onClick={onDone} style={{
            all: 'unset', cursor: 'pointer', fontFamily: mono, fontSize: fs.micro,
            color: P.faint, letterSpacing: '0.14em', padding: sp[2],
          }}>
            SKIP TOUR
          </button>
          <div style={{ display: 'flex', gap: sp[2] }}>
            {i > 0 && <Btn onClick={back} variant="ghost" size="sm">BACK</Btn>}
            <Btn onClick={next} variant="gold" size="sm">
              {last ? 'GET STARTED' : 'NEXT'}
            </Btn>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
