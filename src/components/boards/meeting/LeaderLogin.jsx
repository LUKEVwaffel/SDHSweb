import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { identityApi } from './meetingApi';
import { PinPad } from '../ui';
import { pinErrorText } from '../boardApi';
import '../boards.css';
import './meeting.css';
const ROLE = { co: 'Commander', xo: 'Executive officer', '1sg': 'First sergeant' };
export default function LeaderLogin({ onSignedIn, identity = identityApi, authClient = supabase.auth }) {
  const [directoryLoaded, setDirectoryLoaded] = useState(false);
  const [directory, setDirectory] = useState([]);
  const [step, setStep] = useState('name');
  const [member, setMember] = useState(null);
  const [company, setCompany] = useState('all');
  const [dob, setDob] = useState('');
  const [proof, setProof] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reset, setReset] = useState(0);
  const [staffEmail, setStaffEmail] = useState('');
  const [password, setPassword] = useState('');
  const loadDirectory = useCallback(async () => {
    setError(''); setDirectoryLoaded(false);
    try { setDirectory(await identity.directory()); } catch(e) { setError(e.message); } finally { setDirectoryLoaded(true); }
  }, [identity]);
  useEffect(() => { loadDirectory(); }, [loadDirectory]);
  function choose(m) {
    setMember(m); setDob(''); setProof(''); setFirstPin(''); setError(''); setReset((r) => r + 1);
    setStep(m.needs_setup ? 'dob' : 'pin');
  }
  async function verify(e) {
    e.preventDefault(); setBusy(true); setError('');
    try { const data = await identity.verify(member.member_id, dob); setProof(data.setup_token); setDob(''); setStep('create'); }
    catch (err) {
      setError(err.message);
      const fresh = await identity.directory().catch(() => []);
      if(fresh.length) setDirectory(fresh);
      const current = fresh.find((m) => m.member_id === member.member_id);
      if(current && !current.needs_setup) { setMember(current); setStep('pin'); setDob(''); }
    } finally { setBusy(false); }
  }
  async function submitPin(pin) {
    if (step === 'create') { setFirstPin(pin); setStep('confirm'); return; }
    if (step === 'confirm' && pin !== firstPin) { setError('Those PINs do not match. Choose your PIN again.'); setFirstPin(''); setStep('create'); return; }
    setBusy(true); setError('');
    try {
      await identity.finish(step === 'confirm' ? { action: 'set_pin', setup_token: proof, pin } : { action: 'pin_login', member_id: member.member_id, pin });
      setFirstPin(''); setProof(''); await onSignedIn();
    } catch (err) {
      setError(pinErrorText(err)); setReset((r) => r + 1);
      // Re-read server state: enrollment may have saved the PIN even if the
      // session exchange was interrupted. Never send them back through DOB.
      const fresh = await identity.directory().catch(() => []);
      setDirectory(fresh);
      const current = fresh.find((m) => m.member_id === member.member_id);
      if (current && !current.needs_setup) { setMember(current); setStep('pin'); setProof(''); }
      else if (err.body?.next_step === 'verify_dob') { setProof(''); setFirstPin(''); setStep('dob'); }
    } finally { setBusy(false); }
  }
  async function staffSignIn(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const { error: authError } = await authClient.signInWithPassword({ email: staffEmail.trim(), password });
      if (authError) throw authError;
      setPassword(''); await onSignedIn();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  const heading = { name: 'Choose your name.', dob: 'Confirm it’s you.', create: 'Make it yours.', confirm: 'One more time.', pin: 'Welcome back.', staff: 'Presenter sign-in.' }[step];
  return <main className="tb bm-login">
    <section className="bm-login-intro">
      <a href="/boards/meeting" className="bm-brand"><img src="/assets/trojan-helmet.png" width="48" height="48" alt="" /><span>Trojan Battalion<br /><b>Company boards</b></span></a>
      <div><div className="tb-eyebrow">Leadership workshop</div><h1>One company.<br />One standard.<br /><span>Your board.</span></h1><p>Learn the workflow together, using your company’s cadets. Every result in this workshop is practice.</p></div>
      <p className="bm-small">First visit: name → date of birth → personal PIN.<br />Next visit: name → PIN. Your setup stays complete.</p>
    </section>
    <section className="bm-login-content"><div className="bm-login-panel">
      <div className="tb-eyebrow">{step === 'name' ? 'Start here' : member ? `${member.company} · ${ROLE[member.board_role]}` : 'Staff account'}</div>
      <h2>{heading}</h2>
      {member && step !== 'name' && step !== 'staff' && <p className="bm-selected">{member.display_name}</p>}
      {step === 'name' && <>
        <p className="bm-muted">Select your own name. We’ll guide you through the rest.</p>
        <div className="bm-company-filter" aria-label="Filter by company">{['all','alpha','bravo','charlie','delta'].map((c) => <button type="button" key={c} aria-pressed={company===c} onClick={() => setCompany(c)}>{c}</button>)}</div>
        <div className="bm-name-list">{directory.filter((m) => company === 'all' || m.company === company).map((m) => <button type="button" key={m.member_id} onClick={() => choose(m)}><span><b>{m.display_name}</b><small>{m.company} · {ROLE[m.board_role]}</small></span><span className="bm-name-action">{m.needs_setup ? 'Set up' : 'Sign in'} →</span></button>)}</div>
        {!directoryLoaded && !error && <p role="status">Loading company leadership…</p>}
        {directoryLoaded && !directory.length && <p className="bm-muted">Company leadership could not be loaded. Retry or ask the presenter for help.</p>}
        {(error || (directoryLoaded && !directory.length)) && <button type="button" className="tb-btn" onClick={loadDirectory}>Retry name list</button>}
        <button type="button" className="bm-text-button" onClick={() => { setStep('staff'); setError(''); }}>Presenter or staff sign-in</button>
      </>}
      {step === 'dob' && <form onSubmit={verify} className="bm-form">
        <p className="bm-muted">Enter the date of birth on your cadet record. This is required only to set up your PIN.</p>
        <label>Date of birth<input className="tb-input" type="date" autoComplete="bday" required value={dob} onChange={(e) => setDob(e.target.value)} disabled={busy} /></label>
        <button className="tb-btn tb-btn--gold tb-btn--lg" disabled={busy}>{busy ? 'Checking…' : 'Confirm date of birth →'}</button>
      </form>}
      {['create','confirm','pin'].includes(step) && <>
        <p className="bm-muted">{step === 'create' ? 'Choose a four-digit PIN you can remember. You will use it to sign in and sign your company’s board results.' : step === 'confirm' ? 'Enter the same four digits to confirm your PIN.' : 'Enter your personal four-digit PIN.'}</p>
        <PinPad key={step} resetKey={reset} busy={busy} error={error} onComplete={submitPin} />
        {step === 'pin' && <p className="bm-small">Forgot your PIN? Ask S-6 to reset it. Your date of birth cannot replace an existing PIN.</p>}
        {busy && <p role="status" className="bm-muted">{step === 'confirm' ? 'Saving your PIN and signing in…' : 'Signing in…'}</p>}
      </>}
      {step === 'staff' && <form className="bm-form" onSubmit={staffSignIn}>
        <p className="bm-muted">Use your existing DISPATCH staff account. If you’re already signed in to DISPATCH on this browser, open the meeting link from there.</p>
        <label>Email<input type="email" autoComplete="username" className="tb-input" required value={staffEmail} onChange={(e) => setStaffEmail(e.target.value)} /></label>
        <label>Password<input type="password" autoComplete="current-password" className="tb-input" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <button className="tb-btn tb-btn--gold" disabled={busy}>Sign in as presenter</button>
      </form>}
      {error && !['create','confirm','pin'].includes(step) && <div className="tb-banner tb-banner--error" role="alert">{error}</div>}
      {step !== 'name' && <button type="button" className="bm-text-button" disabled={busy} onClick={() => { setStep('name'); setMember(null); setDob(''); setProof(''); setFirstPin(''); setError(''); }}>← Choose another name</button>}
    </div></section>
  </main>;
}
