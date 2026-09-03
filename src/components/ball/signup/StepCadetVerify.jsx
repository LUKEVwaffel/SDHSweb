import { useState } from 'react';
import { P, mono } from '../../admin/theme';
import { lookupCadet } from '../../../lib/ballApi';
import { Label, TextInput, Btn, ErrorText } from './formUi';

const SCHOOL_DOMAIN = '@students.hcde.org';

// Step 1 — cadet identity verification. Single input (username portion of
// school email, suffix locked/shown, same pattern as elsewhere in DISPATCH).
// On match, hands the parent the signupToken minted server-side alongside
// the roster display fields.
export default function StepCadetVerify({ onVerified }) {
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [match, setMatch] = useState(null);

  async function submit(e) {
    e?.preventDefault();
    if (!username.trim() || busy) return;
    setBusy(true);
    setErr('');
    const { data, error } = await lookupCadet(username.trim());
    setBusy(false);
    if (error) {
      setErr("We couldn't find a cadet with that email. Double-check it, or see 1SG Kaz or Chief if the roster needs updating.");
      return;
    }
    setMatch(data);
  }

  if (match) {
    return (
      <div className="ball-scale-in">
        <div style={{ border: `1px solid ${P.hairStrong}`, background: P.navy, padding: 24 }}>
          <div style={{ fontFamily: mono, fontSize: 11, color: P.gold, letterSpacing: '0.14em', marginBottom: 10 }}>WELCOME</div>
          <div style={{ fontSize: 18, marginBottom: 4 }}>{match.name}</div>
          <div style={{ fontFamily: mono, fontSize: 12, color: P.mute }}>
            LET {match.let_level || '--'} · {(match.company || '').toUpperCase() || '--'} COMPANY
          </div>
        </div>

        {match.date_tag && (
          <div style={{ marginTop: 14, border: `1px solid ${P.gold}`, background: P.goldWash, padding: '14px 16px' }}>
            <div style={{ fontFamily: mono, fontSize: 11, color: P.gold, letterSpacing: '0.14em', marginBottom: 6 }}>HEADS UP</div>
            <div style={{ fontFamily: mono, fontSize: 12, color: P.cream, lineHeight: 1.6 }}>
              You've already been added as {match.date_tag.host_name}'s date. Your guest status: <strong>{match.date_tag.status}</strong>.
              You can still continue below to start your own separate signup if you want to.
            </div>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
          <button
            onClick={() => setMatch(null)}
            style={{ background: 'none', border: 'none', color: P.mute, fontFamily: mono, fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
          >
            Not you?
          </button>
          <Btn onClick={() => onVerified({ signupToken: match.signupToken, name: match.name, let_level: match.let_level, company: match.company })}>
            CONTINUE →
          </Btn>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <Label>SCHOOL EMAIL</Label>
      <div style={{ display: 'flex', alignItems: 'stretch', marginBottom: 6 }}>
        <TextInput
          autoFocus
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="jsmith123"
          style={{ borderRight: 'none' }}
        />
        <div style={{ background: P.deep, border: `1px solid ${P.hair}`, borderLeft: 'none', color: P.mute, fontFamily: mono, fontSize: 14, padding: '11px 12px', whiteSpace: 'nowrap' }}>
          {SCHOOL_DOMAIN}
        </div>
      </div>
      <ErrorText>{err}</ErrorText>
      <div style={{ marginTop: 20 }}>
        <Btn type="submit" busy={busy} disabled={!username.trim()}>{busy ? 'CHECKING' : 'FIND ME →'}</Btn>
      </div>
    </form>
  );
}
