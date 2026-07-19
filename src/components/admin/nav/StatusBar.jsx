import { P, mono } from '../theme';

export default function StatusBar({ sectionLabel }) {
  return (
    <div style={{
      height: 28, background: P.deep, borderTop: `1px solid ${P.hair}`,
      display: 'flex', alignItems: 'center', paddingLeft: 16, gap: 24, flexShrink: 0,
    }}>
      <div style={{ fontFamily: mono, fontSize: 9, color: P.gold, letterSpacing: '0.15em' }}>
        SECTION: <span style={{ color: P.cream }}>{sectionLabel}</span>
      </div>
      <div style={{ marginLeft: 'auto', marginRight: 16, fontFamily: mono, fontSize: 9, color: P.mute }}>
        DISPATCH · TROJAN BATTALION
      </div>
    </div>
  );
}
