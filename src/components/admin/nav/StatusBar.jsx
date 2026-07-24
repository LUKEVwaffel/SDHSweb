import { P, mono, fs, sp } from '../theme';

export default function StatusBar({ sectionLabel }) {
  return (
    <div style={{
      height: 34, background: P.deep, borderTop: `1px solid ${P.hairStrong}`,
      display: 'flex', alignItems: 'center', paddingLeft: sp[6], gap: sp[6], flexShrink: 0,
    }}>
      <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.16em' }}>
        SECTION: <span style={{ color: P.cream }}>{sectionLabel}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: P.green }} />
        <span style={{ fontFamily: mono, fontSize: fs.micro, color: P.mute, letterSpacing: '0.14em' }}>ALL SYSTEMS NOMINAL</span>
      </div>
      <div style={{ marginLeft: 'auto', marginRight: sp[6], fontFamily: mono, fontSize: fs.micro, color: P.faint, letterSpacing: '0.14em' }}>
        DISPATCH · TROJAN BATTALION
      </div>
    </div>
  );
}
