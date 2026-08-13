import { useState, useEffect } from 'react';
import { P, mono, fraunces, inter, fs, sp, radius } from '../../admin/theme.js';
import { RAIDER_PRACTICE_TILES } from '../../../lib/raiderPracticeInfo.js';

function PanelHeading({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: sp[4] }}>
      <div style={{ width: 14, height: 2, background: P.gold }} />
      <div style={{ fontFamily: mono, fontSize: fs.micro, color: P.gold, letterSpacing: '0.28em' }}>
        {children}
      </div>
      <div style={{ flex: 1, height: 1, background: P.hair }} />
    </div>
  );
}

function PracticeTile({ tile }) {
  return (
    <div style={{ borderBottom: `1px solid ${P.hair}`, paddingBottom: sp[3], marginBottom: sp[3] }}>
      <div style={{ fontFamily: fraunces, fontWeight: 800, fontStyle: 'italic', fontSize: fs.xl, color: P.bright }}>
        {tile.value}
      </div>
      <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.cream, letterSpacing: '0.16em', marginTop: 4 }}>
        {tile.label}
      </div>
      {tile.sub && <div style={{ fontFamily: inter, fontSize: fs.sm, color: P.mute, marginTop: 2 }}>{tile.sub}</div>}
    </div>
  );
}

// Dedicated Raiders info panel in Range's rotation phase, gated behind
// config.showRaiderPractice — period_company (the period→company map driving
// the welcome screens) has no slot for extracurricular teams, so this lives
// as a 4th always-visible column in TvRangeRotationLayout.jsx instead.
// Content mirrors Raiders.jsx's own "JOIN THE TEAM" tiles via the shared
// raiderPracticeInfo.js constant, so the two surfaces can't drift apart.
// GroupMe QR is a small element here rather than its own phase screen —
// thematically tied to the practice info, no new schedule-engine phase
// needed. qrcode is dynamically imported (same pattern as
// lib/eventsPdfPrint.js) so it only loads once a URL is actually set.
export default function TvRangeRaiderPracticeWidget({ groupmeUrl }) {
  const [qrSrc, setQrSrc] = useState(null);

  useEffect(() => {
    if (!groupmeUrl) {
      setQrSrc(null);
      return;
    }
    let cancelled = false;
    import('qrcode')
      .then(({ toDataURL }) =>
        toDataURL(groupmeUrl, { margin: 1, width: 160, color: { dark: '#06101F', light: '#F4ECD8' } })
      )
      .then((url) => { if (!cancelled) setQrSrc(url); })
      .catch(() => { if (!cancelled) setQrSrc(null); });
    return () => { cancelled = true; };
  }, [groupmeUrl]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <PanelHeading>RAIDERS PRACTICE</PanelHeading>

      <div style={{ flex: 1, minHeight: 0 }}>
        {RAIDER_PRACTICE_TILES.map((t) => <PracticeTile key={t.label} tile={t} />)}
      </div>

      {qrSrc && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: sp[3], marginTop: sp[3],
          paddingTop: sp[3], borderTop: `1px solid ${P.hair}`,
        }}>
          <img
            src={qrSrc} alt="QR code to join the Raiders GroupMe" width={64} height={64}
            style={{ borderRadius: radius.sm, flexShrink: 0 }}
          />
          <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.gold, letterSpacing: '0.08em', lineHeight: 1.6 }}>
            SCAN TO JOIN<br />THE RAIDERS GROUPME
          </div>
        </div>
      )}
    </div>
  );
}
