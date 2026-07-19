import { useState } from 'react';
import { P, mono, oswald, inter, PASSCODE } from './theme';
import { Btn, Label } from './shared/ui';

export default function LoginScreen({ onLogin }) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState(false);
  const [shake, setShake] = useState(false);

  function attempt() {
    if (code === PASSCODE) { onLogin(); return; }
    setErr(true); setShake(true);
    setTimeout(() => setShake(false), 600);
    setCode('');
  }

  return (
    <div style={{
      minHeight: '100vh', background: P.ink,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: inter,
    }}>
      <div style={{ width: 340 }}>
        <div style={{ fontFamily: oswald, fontSize: 28, color: P.cream, letterSpacing: '0.2em', textAlign: 'center', marginBottom: 4 }}>
          DISPATCH
        </div>
        <div style={{ fontFamily: mono, fontSize: 9, color: P.gold, letterSpacing: '0.3em', textAlign: 'center', marginBottom: 40 }}>
          TROJAN BATTALION · ADMIN
        </div>
        <div style={{
          background: P.navy, border: `1px solid ${err ? P.red : P.hair}`,
          padding: 28, animation: shake ? 'shake 0.4s' : 'none',
        }}>
          <Label>ACCESS CODE</Label>
          <input
            type="password" value={code} autoFocus
            onChange={e => { setCode(e.target.value); setErr(false); }}
            onKeyDown={e => e.key === 'Enter' && attempt()}
            style={{
              width: '100%', background: P.deep, border: `1px solid ${err ? P.red : P.hair}`,
              color: P.cream, fontFamily: mono, fontSize: 14, padding: '10px 12px',
              outline: 'none', letterSpacing: '0.3em', boxSizing: 'border-box', marginBottom: 16,
            }}
          />
          {err && <div style={{ fontFamily: mono, fontSize: 9, color: P.red, letterSpacing: '0.15em', marginBottom: 10 }}>ACCESS DENIED</div>}
          <Btn onClick={attempt} variant="gold" style={{ width: '100%', padding: '10px' }}>AUTHENTICATE</Btn>
        </div>
      </div>
      <style>{`@keyframes shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-8px)} 40%,80%{transform:translateX(8px)} }`}</style>
    </div>
  );
}
