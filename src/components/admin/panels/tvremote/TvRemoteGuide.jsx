import { createPortal } from 'react-dom';
import { useEffect } from 'react';
import { P, mono, oswald, inter, fs, sp, radius, shadow } from '../../theme';
import { Btn } from '../../shared/ui';
import { GUIDE_SECTIONS, WALKTHROUGH } from './tvRemoteHelpContent';

// Full written reference behind the "? Guide" button. Always available, not
// just first-run. `onReplayTour` re-launches the guided slide tour.
function Block({ block }) {
  if (typeof block === 'string') {
    return (
      <p style={{ fontFamily: inter, fontSize: fs.sm, color: P.mute, lineHeight: 1.7, margin: `0 0 ${sp[3]}px` }}>
        {block}
      </p>
    );
  }
  return (
    <ul style={{ margin: `0 0 ${sp[3]}px`, paddingLeft: sp[5], display: 'grid', gap: sp[2] }}>
      {block.list.map((item, idx) => (
        <li key={idx} style={{ fontFamily: inter, fontSize: fs.sm, color: P.mute, lineHeight: 1.6 }}>
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function TvRemoteGuide({ open, onClose, onReplayTour }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1090, padding: sp[4],
      background: 'rgba(6,16,31,0.78)', backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: 680, maxHeight: '88vh', display: 'flex', flexDirection: 'column',
        background: P.navy, border: `1px solid ${P.gold}`, borderRadius: radius.lg, boxShadow: shadow.lg,
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: sp[4],
          padding: `${sp[4]}px ${sp[6]}px`, borderBottom: `1px solid ${P.hair}`, flexShrink: 0,
        }}>
          <div style={{ fontFamily: mono, fontSize: fs.sm, color: P.gold, letterSpacing: '0.18em' }}>
            TV REMOTE - FULL GUIDE
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: sp[2] }}>
            {onReplayTour && (
              <Btn onClick={() => { onClose(); onReplayTour(); }} variant="ghost" size="sm">
                REPLAY TOUR
              </Btn>
            )}
            <button onClick={onClose} aria-label="Close" style={{
              all: 'unset', cursor: 'pointer', color: P.faint, fontSize: fs.md, lineHeight: 1, padding: 4,
            }}>✕</button>
          </div>
        </div>

        <div style={{ overflowY: 'auto', padding: `${sp[6]}px ${sp[6]}px ${sp[8]}px` }}>
          <p style={{
            fontFamily: inter, fontSize: fs.base, color: P.cream, lineHeight: 1.7,
            margin: `0 0 ${sp[6]}px`,
          }}>
            This panel is the remote control for the JROTC-area televisions. Below is how every
            part of it works. New to it? The {WALKTHROUGH.length}-step tour is the fastest way in -
            use REPLAY TOUR above.
          </p>

          {GUIDE_SECTIONS.map((section) => (
            <section key={section.heading} style={{ marginBottom: sp[6] }}>
              <h3 style={{
                fontFamily: oswald, fontSize: fs.md, color: P.bright, fontWeight: 600,
                letterSpacing: '0.02em', margin: `0 0 ${sp[3]}px`,
                paddingBottom: sp[2], borderBottom: `1px solid ${P.hair}`,
              }}>
                {section.heading}
              </h3>
              {section.blocks.map((block, idx) => <Block key={idx} block={block} />)}
            </section>
          ))}
        </div>

        <div style={{
          display: 'flex', justifyContent: 'flex-end',
          padding: `${sp[3]}px ${sp[6]}px`, borderTop: `1px solid ${P.hair}`, background: P.deep, flexShrink: 0,
        }}>
          <Btn onClick={onClose} variant="gold" size="sm">CLOSE</Btn>
        </div>
      </div>
    </div>,
    document.body,
  );
}
