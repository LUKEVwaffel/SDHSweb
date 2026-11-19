import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function DoorAttireDialog({ person, busy, onAction, onClose, offline }) {
  const dialog = useRef(null); const pinInput = useRef(null); const choices = useRef([]); const done = useRef(null);
  const [choice, setChoice] = useState(0); const [step, setStep] = useState('decision');
  const [pin, setPin] = useState(''); const [error, setError] = useState(''); const [verified, setVerified] = useState(null);
  useEffect(() => {
    const opener = document.activeElement;
    const modal = dialog.current;
    modal.showModal();
    return () => { if (modal.open) modal.close(); if (opener?.isConnected) opener.focus(); };
  }, []);
  useEffect(() => {
    if (step === 'decision') choices.current[choice]?.focus();
    else if (step === 'pin' && !busy) pinInput.current?.focus();
    else if (step === 'done') done.current?.focus();
  }, [step, choice, busy]);
  const valid = offline ? /^[\w-]{43}$/.test(pin.trim()) : /^\d{4}$/.test(pin);
  async function submit(event) {
    event.preventDefault();
    if (busy || !valid) return;
    setError('');
    try {
      const result = await onAction(person, 'attire', { pin, approved: choice === 0 });
      if (!result || result.error) { setError(result?.error || 'Could not verify the code. Try again.'); return; }
      setVerified(result); setStep('done');
    } finally { setPin(''); }
  }
  function keys(event) {
    event.stopPropagation();
    if (step === 'decision' && ['ArrowDown','ArrowRight','ArrowUp','ArrowLeft'].includes(event.key)) {
      event.preventDefault(); setChoice(previous => previous === 0 ? 1 : 0);
    }
    if (event.key === 'Tab') {
      // The native modal dialog confines Tab focus to this popup.
      return;
    }
  }
  const approved = verified?.attire_status === 'approved';
  return createPortal(<dialog className="door-attire-dialog" ref={dialog} aria-labelledby="attire-dialog-title" aria-describedby="attire-dialog-person" onKeyDown={keys} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <p className="door-dialog-kicker">On-site attire review</p>
    <h2 id="attire-dialog-title">{step === 'done' ? `${verified.attire_by.split(' ')[0]} verified` : step === 'pin' ? 'Enter reviewer’s passcode' : 'Approve or deny attire?'}</h2>
    <p id="attire-dialog-person" className="door-dialog-person">{person.name}</p>
    {step === 'decision' ? <><div className="door-decision-choices" role="group" aria-label="Attire decision">{[['Approve attire','Their outfit is approved for entry.'],['Deny entry','Turn this person away for attire.']].map(([label, hint], index) => <button type="button" key={label} ref={node => { choices.current[index] = node; }} aria-pressed={choice === index} className={`${choice === index ? 'is-active' : ''} ${index ? 'is-deny' : ''}`} onFocus={() => setChoice(index)} onClick={() => { setChoice(index); setStep('pin'); }}><strong>{label}</strong><span>{hint}</span></button>)}</div><p className="door-dialog-help">↑ ↓ or ← → to choose · Enter to continue</p><button className="door-dialog-cancel" onClick={onClose}>Cancel · Esc</button></>
    : step === 'pin' ? <form onSubmit={submit}><div className={`door-decision-summary ${choice ? 'is-deny' : ''}`}>{choice ? 'Deny entry · This attendee will be turned away' : 'Approve attire'}</div><label htmlFor="door-reviewer-pin">{offline ? 'Aubry’s or Kylie’s offline reviewer code' : 'Aubry’s or Kylie’s 4-digit passcode'}</label><input ref={pinInput} id="door-reviewer-pin" type="password" inputMode={offline ? 'text' : 'numeric'} autoComplete="off" autoCapitalize="off" spellCheck={false} maxLength={offline ? 50 : 4} value={pin} onChange={event => { setPin(offline ? event.target.value : event.target.value.replace(/\D/g, '').slice(0,4)); setError(''); }} disabled={busy} required /><p className="door-dialog-help">The code identifies the reviewer automatically. Press Enter to verify.</p>{error && <p role="alert" className="door-dialog-error">{error}</p>}<button className={`door-dialog-submit ${choice ? 'is-deny' : ''}`} disabled={busy || !valid}>{busy ? 'Verifying…' : 'Verify passcode · Enter'}</button><div className="door-dialog-footer"><button type="button" disabled={busy} onClick={() => { setPin(''); setError(''); setStep('decision'); }}>Back</button><button type="button" disabled={busy} onClick={onClose}>Cancel · Esc</button></div></form>
    : <div className="door-dialog-confirmation"><div className={approved ? 'door-decision-summary' : 'door-decision-summary is-deny'}>{approved ? 'Attire approved' : 'Attire denied · Do not admit'}</div><p>{approved ? 'Other entry requirements must still be complete before check-in.' : 'This person must be turned away. Check-in remains blocked.'}</p><button ref={done} className="door-dialog-submit" onClick={onClose}>Done · Enter</button></div>}
  </dialog>, document.body);
}
