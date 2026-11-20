import { useState } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { invokeError } from '../../../../lib/supabaseFnError';
import { P } from '../../theme';
import { Btn, Input } from '../../shared/ui';

export default function BallDoorPinReset() {
  return <section style={{ marginBottom: 28 }}><h3 style={{ fontSize: 18 }}>On-site attire passcodes</h3><p style={{ color: P.mute, fontSize: 13 }}>Only S-6 can reset these codes. A reset takes effect immediately and clears that reviewer’s code lockout. Station attempt limits still apply. Each reviewer must use a different code. Luke’s and Danielle’s codes apply only at the door. These are the reviewers’ real codes, also used when testing attire review in the sandbox.</p>{[['aubry','Aubry Gillott'],['kylie','Kylie Gray'],['luke','Luke Vetsch'],['danielle','Danielle']].map(([id, name]) => <Reviewer key={id} id={id} name={name} />)}</section>;
}
function Reviewer({ id, name }) {
  const [pin, setPin] = useState(''); const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [done, setDone] = useState(false);
  async function reset(event) {
    event.preventDefault(); setBusy(true); setError(''); setDone(false);
    try {
      const { data, error: problem } = await SB.functions.invoke('ball-door-reset-pin', { body: { approver: id, pin } });
      if (problem || data?.error || !data?.ok) throw new Error(await invokeError(data, problem, 'Passcode was not reset.'));
      setDone(true);
    } catch (problem) { setError(problem.message); }
    finally { setPin(''); setConfirmation(''); setBusy(false); }
  }
  return <form onSubmit={reset} style={{ border: `1px solid ${P.hair}`, borderRadius: 10, padding: 18, marginTop: 12 }}><strong>{name}</strong><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, margin: '12px 0' }}><label style={{ fontSize: 13 }}>New four-digit code<Input type="password" inputMode="numeric" autoComplete="new-password" maxLength={4} value={pin} onChange={event => { setPin(event.target.value.replace(/\D/g,'')); setDone(false); }} disabled={busy} /></label><label style={{ fontSize: 13 }}>Confirm new code<Input type="password" inputMode="numeric" autoComplete="new-password" maxLength={4} value={confirmation} onChange={event => setConfirmation(event.target.value.replace(/\D/g,''))} disabled={busy} /></label></div><Btn type="submit" size="sm" disabled={busy || !/^\d{4}$/.test(pin) || pin !== confirmation}>{busy ? 'RESETTING…' : 'RESET PASSCODE'}</Btn>{done && <p role="status" style={{ color: P.green, fontSize: 13 }}>Passcode reset for {name}. Their previous code no longer works.</p>}{error && <p role="alert" style={{ color: P.red, fontSize: 13 }}>{error}</p>}</form>;
}
