import { useState, useEffect } from 'react';
import { P, mono, oswald, fs, sp } from '../theme';
import { Btn } from '../shared/ui';

export default function TopBar({ adminId, onLogout }) {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(id); }, []);

  return (
    <div style={{
      height: 64, background: `linear-gradient(180deg, ${P.navy} 0%, ${P.deep} 100%)`,
      borderBottom: `1px solid ${P.hairStrong}`,
      display: 'flex', alignItems: 'center', paddingLeft: sp[6], gap: sp[5], flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: sp[3] }}>
        <div style={{ fontFamily: oswald, fontSize: fs.xl, color: P.cream, letterSpacing: '0.3em', fontWeight: 600 }}>DISPATCH</div>
      </div>
      <div style={{ width: 1, height: 26, background: P.hair }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: P.green, boxShadow: `0 0 8px ${P.green}` }} />
        <span style={{ fontFamily: mono, fontSize: fs.tiny, color: P.green, letterSpacing: '0.2em' }}>LIVE</span>
      </div>
      <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.mute, letterSpacing: '0.12em' }}>TROJAN BATTALION · SODDY DAISY HS</div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: sp[4], paddingRight: sp[6] }}>
        <div style={{ fontFamily: mono, fontSize: fs.tiny, color: P.mute, fontVariantNumeric: 'tabular-nums' }}>{time.toLocaleTimeString()}</div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7, fontFamily: mono, fontSize: fs.tiny, color: P.gold,
          background: P.navy, border: `1px solid ${P.hair}`, padding: '6px 12px', borderRadius: 5,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: P.gold }} />
          {adminId}
        </div>
        <Btn onClick={onLogout} variant="ghost" size="sm">LOGOUT</Btn>
      </div>
    </div>
  );
}
