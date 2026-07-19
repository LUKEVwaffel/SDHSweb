import { useState, useEffect } from 'react';
import { P, mono, oswald } from '../theme';
import { Btn } from '../shared/ui';

export default function TopBar({ adminId, onLogout }) {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(id); }, []);

  return (
    <div style={{
      height: 48, background: P.deep, borderBottom: `1px solid ${P.hair}`,
      display: 'flex', alignItems: 'center', paddingLeft: 16, gap: 16, flexShrink: 0,
    }}>
      <div style={{ fontFamily: oswald, fontSize: 18, color: P.cream, letterSpacing: '0.3em' }}>DISPATCH</div>
      <div style={{ width: 1, height: 20, background: P.hair }} />
      <div style={{ fontFamily: mono, fontSize: 9, color: P.green, letterSpacing: '0.2em' }}>● LIVE</div>
      <div style={{ fontFamily: mono, fontSize: 9, color: P.mute, letterSpacing: '0.1em' }}>TROJAN BATTALION · SODDY DAISY HS</div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, paddingRight: 16 }}>
        <div style={{ fontFamily: mono, fontSize: 9, color: P.mute }}>{time.toLocaleTimeString()}</div>
        <div style={{ fontFamily: mono, fontSize: 9, color: P.gold, background: P.navy, border: `1px solid ${P.hair}`, padding: '3px 8px' }}>{adminId}</div>
        <Btn onClick={onLogout} variant="ghost" style={{ fontSize: 9 }}>LOGOUT</Btn>
      </div>
    </div>
  );
}
