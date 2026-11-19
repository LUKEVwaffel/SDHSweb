import { useCallback, useEffect, useState } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import BallDoorPinReset from './BallDoorPinReset';
import { invokeError } from '../../../../lib/supabaseFnError';
import { P, sp } from '../../theme';
import { Btn, Input, Label } from '../../shared/ui';

export default function BallCheckinSetup() {
  const [staff, setStaff] = useState([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const load = useCallback(async () => {
    const { data, error: problem } = await SB.from('ball_checkin_staff').select('email,display_name,active').order('display_name');
    if (problem) { setError(problem.message); return; }
    setStaff(data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function add(event) {
    event.preventDefault(); setBusy(true); setError(''); setResult(null);
    let login = null;
    const address = email.trim().toLowerCase();
    try {
      const { data, error: problem } = await SB.functions.invoke('admin-create-auth-user', { body: { email: address } });
      if (problem || data?.error) throw new Error(await invokeError(data, problem, 'Could not create the login.'));
      login = data;
      // Keep the password visible even if the separate access grant fails.
      setResult({ email: address, password: data.temp_password, granted: false });
      const { data: saved, error: grantError } = await SB.from('ball_checkin_staff').upsert({ email: address, display_name: name.trim(), active: true }, { onConflict: 'email' }).select('email').single();
      if (grantError || !saved) throw new Error(grantError?.message || 'Check-in access was not saved.');
      setResult({ email: address, password: data.temp_password, granted: true });
      setName(''); setEmail(''); await load();
    } catch (problem) { setError(`${problem.message}${login ? ' The login exists; keep the password below and retry the access grant with the same email.' : ''}`); }
    finally { setBusy(false); }
  }
  async function toggle(person) {
    setBusy(true); setError('');
    try {
      const { data, error: problem } = await SB.from('ball_checkin_staff').update({ active: !person.active }).eq('email', person.email).select('email').single();
      if (problem || !data) throw new Error(problem?.message || 'No account was changed.');
      await load();
    } catch (problem) { setError(problem.message); }
    finally { setBusy(false); }
  }
  const box = { border: `1px solid ${P.hair}`, padding: sp[4], borderRadius: 10, marginBottom: sp[4] };
  return <div style={{ maxWidth: 760, color: P.cream, lineHeight: 1.6 }}>
    <div style={box}><h2 style={{ fontSize: 22, margin: '0 0 10px' }}>A simple page for the welcome desk</h2><p style={{ color: P.mute, margin: '0 0 16px' }}>Staff search a name, confirm who is there, then check in each person. Missing requirements go to Chief. Arrivals can be undone. If venue Wi-Fi is uncertain, open the desk page on the event computer and choose Prepare offline station while connected.</p><a href="/ball/checkin" target="_blank" rel="noreferrer" style={{ display: 'inline-block', color: P.gold, fontWeight: 600, padding: '8px 0' }}>Open Ball check-in ↗</a><p style={{ color: P.mute, fontSize: 13, margin: '10px 0 0' }}>Staff link: {window.location.origin}/ball/checkin</p></div>
    <form onSubmit={add} style={box}><h3 style={{ fontSize: 18, margin: '0 0 8px' }}>Give someone check-in access</h3><p style={{ color: P.mute, fontSize: 13, margin: '0 0 16px' }}>New accounts receive a generated password shown here once. Check-in access alone lets them see names, readiness and arrival status. It does not grant payment, reservation, or DISPATCH access. Existing logins keep their current password and other permissions.</p>
      <Label>STAFF NAME</Label><Input required value={name} onChange={event => setName(event.target.value)} placeholder="Name of the person at the desk" />
      <div style={{ marginTop: sp[3] }}><Label>STAFF EMAIL</Label><Input required type="email" autoComplete="off" value={email} onChange={event => setEmail(event.target.value)} placeholder="Their sign-in email" /></div>
      <div style={{ marginTop: sp[3] }}><Btn type="submit" disabled={busy || !name.trim() || !email.trim()}>{busy ? 'SAVING…' : 'GRANT CHECK-IN ACCESS'}</Btn></div>
    </form>
    {error && <p role="alert" style={{ color: P.red }}>{error}</p>}
    {result && <div style={{ ...box, borderColor: result.granted ? P.green : P.gold }}><strong>{result.granted ? 'Check-in access is ready' : 'Login created; check-in access still needs saving'}</strong><p>{result.email}</p>{result.password ? <><p style={{ color: P.mute, fontSize: 13 }}>Give this password to the staff member privately. Save it before dismissing this box.</p><code style={{ display: 'block', userSelect: 'all', padding: 12, background: P.deep, overflowWrap: 'anywhere' }}>{result.password}</code></> : <p style={{ color: P.mute }}>This login already exists. They should use their current password. Password resets are available in Portal Access → AUTH.</p>}<div style={{ marginTop: 12 }}><Btn size="sm" variant="ghost" onClick={() => setResult(null)}>DISMISS</Btn></div></div>}
    <BallDoorPinReset />
    <h3 style={{ fontSize: 18 }}>Check-in staff</h3>
    {!staff.length && <p style={{ color: P.mute }}>No check-in accounts yet. Add the person who will run the desk above.</p>}
    {staff.map(person => <div key={person.email} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 14, padding: '14px 0', borderBottom: `1px solid ${P.hair}` }}><div style={{ flex: 1, minWidth: 180 }}><strong>{person.display_name}</strong><div style={{ color: P.mute, fontSize: 13, overflowWrap: 'anywhere' }}>{person.email}</div></div><span style={{ color: person.active ? P.green : P.mute, fontSize: 13 }}>{person.active ? 'Active' : 'Disabled'}</span><Btn size="sm" variant="ghost" disabled={busy} onClick={() => toggle(person)}>{person.active ? 'DISABLE' : 'RESTORE'}</Btn></div>)}
    <p style={{ color: P.mute, fontSize: 13, marginTop: 20 }}>Before the Ball, have staff sign in on the actual check-in device. Use a live internet connection. No check-in changes send emails or change ticket/payment records.</p>
  </div>;
}
