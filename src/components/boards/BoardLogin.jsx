import { useState } from 'react';
import { boardApi, pinErrorText } from './boardApi';
import { PinPad } from './ui';

// /boards sign-in: school email, then 4-digit PIN on a keypad.
export default function BoardLogin({ onSignedIn }) {
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resetKey, setResetKey] = useState(0);

  function toPin(e) {
    e.preventDefault();
    if (!email.trim().includes('@')) { setError('Enter your school email.'); return; }
    setError('');
    setStep('pin');
  }

  async function submit(pin) {
    setBusy(true);
    setError('');
    try {
      await boardApi.signIn(email, pin);
      onSignedIn();
    } catch (err) {
      setError(pinErrorText(err));
      setResetKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="tb tb-login">
      <section className="tb-login-art" aria-hidden="true">
        <div>
          <img className="tb-helmet" src="/assets/trojan-helmet.png" alt="" width="140" height="140" />
        </div>
        <div>
          <div className="tb-eyebrow">Trojan Battalion · Army JROTC</div>
          <h1 className="tb-h1" style={{ fontSize: 'clamp(44px, 6vw, 76px)' }}>Promotion<br />Boards</h1>
          <p className="tb-sub">One standard, every company. Score it, sign it, send it up the chain.</p>
        </div>
      </section>

      <section className="tb-login-form">
        <div className="tb-login-card">
          <div className="tb-eyebrow">{step === 'email' ? 'Step 1 of 2' : 'Step 2 of 2'}</div>
          <h2 className="tb-h1" style={{ fontSize: 34 }}>{step === 'email' ? 'Sign in' : 'Enter PIN'}</h2>

          {step === 'email' ? (
            <form onSubmit={toPin} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 18 }}>
              <p className="tb-sub">Company CO, XO, 1SG and the SAI only. Use the email your account was set up with.</p>
              <label className="tb-field">
                <span className="tb-label">School email</span>
                <input
                  className="tb-input" type="email" autoComplete="username" autoFocus value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  placeholder="ab12345@students.hcde.org"
                />
              </label>
              {error && <p role="alert" style={{ color: '#ffb3b5', margin: 0, fontSize: 13.5 }}>{error}</p>}
              <button className="tb-btn tb-btn--gold tb-btn--lg" type="submit">Continue →</button>
            </form>
          ) : (
            <div style={{ marginTop: 6 }}>
              <p className="tb-sub" style={{ fontSize: 13.5 }}>
                {email.trim().toLowerCase()} · <button type="button" className="tb-btn tb-btn--ghost tb-btn--sm" onClick={() => { setStep('email'); setError(''); }}>Change</button>
              </p>
              <PinPad onComplete={submit} busy={busy} resetKey={resetKey} error={error} />
              {busy && <p className="tb-sub" style={{ textAlign: 'center', marginTop: 14 }}><span className="tb-spin" /> Signing in…</p>}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
