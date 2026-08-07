import { P, mono, oswald, inter, fs, sp } from '../admin/theme.js';

export default function TvCustomMessagePanel({ message, signoff }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: sp[2] }}>
      <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.24em' }}>
        MESSAGE OF THE DAY
      </div>
      <div style={{ fontFamily: inter, fontSize: fs.base, color: P.cream, lineHeight: 1.5 }}>
        {message}
      </div>
      {signoff && (
        <div style={{ fontFamily: oswald, fontSize: fs.sm, color: P.gold, marginTop: sp[1] }}>
          — {signoff}
        </div>
      )}
    </div>
  );
}
