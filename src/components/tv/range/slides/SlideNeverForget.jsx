import { P, mono, fraunces, inter, fs, sp } from '../../../admin/theme.js';

// 9/11 tribute slide — full-screen "Never Forget" graphic. Added 2026-09-11
// for Range TV's rotation + intro on the anniversary; no admin config, no
// slideRegistry entry (not meant to be added/removed via the slide builder).
export default function SlideNeverForget() {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: P.ink, fontFamily: inter,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: sp[12], textAlign: 'center', gap: sp[6], overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `radial-gradient(ellipse 60% 50% at 50% 30%, rgba(192,57,43,0.10) 0%, transparent 65%)`,
      }} />

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: sp[5] }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: sp[3] }}>
          <div style={{ width: 28, height: 2, background: P.gold }} />
          <span style={{ fontFamily: mono, fontSize: fs.md, color: P.gold, letterSpacing: '0.32em' }}>SEPTEMBER 11, 2001</span>
          <div style={{ width: 28, height: 2, background: P.gold }} />
        </div>

        <div style={{
          fontFamily: fraunces, fontWeight: 800, fontStyle: 'italic', color: P.cream,
          fontSize: 'clamp(56px, 11vh, 148px)', lineHeight: 1.02, maxWidth: '90vw',
          textShadow: '0 4px 40px rgba(192,57,43,0.22)',
        }}>
          Never Forget
        </div>

        <div style={{ fontFamily: inter, fontSize: 'clamp(18px, 2.6vh, 30px)', color: P.mute, letterSpacing: '0.02em' }}>
          Honoring the lives lost and all who answered the call
        </div>
      </div>
    </div>
  );
}
