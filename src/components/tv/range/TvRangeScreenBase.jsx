import { P, mono, fraunces, inter, fs, sp } from '../../admin/theme.js';

// Shared fullscreen chrome for every Range TV phase screen — deliberately
// distraction-free (no carousel, no right-column instrument panel) per spec:
// these screens exist to be readable at a glance from across the room, not
// to carry the Outside kiosk's information density.
export default function TvRangeScreenBase({ kicker, title, sub, children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: P.ink, fontFamily: inter,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: sp[12], textAlign: 'center', gap: sp[6],
    }}>
      {kicker && (
        <div style={{ display: 'flex', alignItems: 'center', gap: sp[3] }}>
          <div style={{ width: 28, height: 2, background: P.gold }} />
          <span style={{ fontFamily: mono, fontSize: fs.md, color: P.gold, letterSpacing: '0.32em' }}>
            {kicker}
          </span>
          <div style={{ width: 28, height: 2, background: P.gold }} />
        </div>
      )}

      {title && (
        <div style={{
          fontFamily: fraunces, fontWeight: 800, fontStyle: 'italic', color: P.cream,
          fontSize: 'clamp(48px, 9vh, 128px)', lineHeight: 1.02, maxWidth: '90vw',
        }}>
          {title}
        </div>
      )}

      {sub && (
        <div style={{ fontFamily: inter, fontSize: fs.lg, color: P.mute, maxWidth: '70vw', lineHeight: 1.5 }}>
          {sub}
        </div>
      )}

      {children}
    </div>
  );
}
