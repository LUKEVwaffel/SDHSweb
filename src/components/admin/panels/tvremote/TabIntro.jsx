import { P, mono, inter, fs, sp, radius } from '../../theme';
import { TAB_INTRO } from './tvRemoteHelpContent';

// The explainer banner pinned to the top of every TV Remote tab pane. Turns
// each tab into something you can read before you touch it: what it controls,
// where it lands on the TV, and when the change actually takes effect.
const ROW = [
  ['what', 'WHAT THIS IS'],
  ['where', 'WHERE IT SHOWS'],
  ['when', 'WHEN IT TAKES EFFECT'],
];

export default function TabIntro({ id }) {
  const intro = TAB_INTRO[id];
  if (!intro) return null;

  const danger = intro.tone === 'danger';
  const accent = danger ? P.red : P.gold;
  const wash = danger ? 'rgba(192,57,43,0.07)' : P.goldWash;

  return (
    <div style={{
      marginBottom: sp[5], padding: sp[4], borderRadius: radius.md,
      background: wash, border: `1px solid ${danger ? 'rgba(192,57,43,0.35)' : P.hair}`,
      borderLeft: `3px solid ${accent}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: sp[3], marginBottom: sp[3] }}>
        <span style={{ fontSize: 20, lineHeight: 1 }} aria-hidden>{intro.icon}</span>
        <span style={{
          fontFamily: mono, fontSize: fs.sm, color: danger ? P.red : P.bright,
          letterSpacing: '0.16em', fontWeight: 600,
        }}>
          {intro.title.toUpperCase()}
        </span>
      </div>
      <div style={{ display: 'grid', gap: sp[3] }}>
        {ROW.map(([key, label]) => (
          <div key={key} style={{ display: 'flex', gap: sp[3], alignItems: 'baseline' }}>
            <span style={{
              flexShrink: 0, width: 128, fontFamily: mono, fontSize: 9,
              color: P.faint, letterSpacing: '0.16em', paddingTop: 2,
            }}>
              {label}
            </span>
            <span style={{ fontFamily: inter, fontSize: fs.sm, color: P.mute, lineHeight: 1.55 }}>
              {intro[key]}
            </span>
          </div>
        ))}
        {intro.tip && (
          <div style={{ display: 'flex', gap: sp[3], alignItems: 'baseline' }}>
            <span style={{
              flexShrink: 0, width: 128, fontFamily: mono, fontSize: 9,
              color: accent, letterSpacing: '0.16em', paddingTop: 2,
            }}>
              TIP
            </span>
            <span style={{ fontFamily: inter, fontSize: fs.sm, color: P.cream, lineHeight: 1.55 }}>
              {intro.tip}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
