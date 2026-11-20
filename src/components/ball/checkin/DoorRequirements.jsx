import { useState } from 'react';
import DoorAttireDialog from './DoorAttireDialog';

// Each decision belongs to one attendee. Passcodes are cleared after every
// attempt and never retained in roster state, localStorage or an audit payload.
export default function DoorRequirements({ person, busy, disabled, onAction, offline, attireReady }) {
  const [review, setReview] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [parent, setParent] = useState('');
  const [signed, setSigned] = useState(false);
  const [school, setSchool] = useState('');
  const locked = busy || disabled;
  async function paper(event) {
    event.preventDefault();
    if (await onAction(person, 'form', { parent, signed })) { setParent(''); setSigned(false); setFormOpen(false); }
  }
  return <div className="door-requirements">
    {person.payment_complete === false && <div className="door-stop"><strong>Unpaid ticket · Do not admit</strong><p>Payment had to be received before the Ball. Cash will NOT be accepted at the door.</p></div>}
    {person.student_status_unknown && <div className="door-rule"><strong>Confirm current school enrollment</strong><p>Does {person.name} currently attend SDHS? Every attending SDHS student needs their own signed form.</p><label>Current enrollment<select value={school} onChange={event => setSchool(event.target.value)} disabled={locked}><option value="">Choose after asking the attendee</option><option value="yes">Currently an SDHS student</option><option value="no">Not currently an SDHS student</option></select></label><button disabled={locked || !school} onClick={() => onAction(person, 'school', { sdhs: school === 'yes' })}>Confirm school status</button></div>}
    {person.form_required && !person.form_received && <div className="door-rule"><strong>Missing signed form · No entry yet</strong><p>Give them an extra paper form. Their parent must come to the desk and sign it before they can enter.</p>{!formOpen ? <button disabled={locked} onClick={() => setFormOpen(true)}>Record parent-signed paper form</button> : <form onSubmit={paper}>
      <label>Parent’s full name<input value={parent} maxLength={120} required autoComplete="off" onChange={event => setParent(event.target.value)} disabled={locked} /></label>
      <label className="door-attestation"><input type="checkbox" checked={signed} onChange={event => setSigned(event.target.checked)} disabled={locked} required /><span>The parent is here, has signed the paper form, and I have received it.</span></label>
      <button disabled={locked || !signed || parent.trim().length < 2}>{busy ? 'Recording…' : 'Confirm signed form received'}</button><button type="button" disabled={locked} onClick={() => { setFormOpen(false); setParent(''); setSigned(false); }}>Cancel</button>
    </form>}</div>}
    {person.attire_status && <div className={person.attire_status === 'denied' ? 'door-stop' : person.attire_status === 'pending' || review ? 'door-rule' : 'door-attire-cleared'}><strong>{person.attire_status === 'denied' ? 'Attire denied · Do not admit' : person.attire_status === 'pending' ? 'On-site attire review needed' : 'Attire cleared'}</strong><p>{person.attire_status === 'denied' ? `This person must be turned away unless an authorized reviewer examines a corrected outfit and approves it.${person.attire_by ? ` Decision by ${person.attire_by}.` : ''}` : 'Aubry Gillott, Kylie Gray, Luke Vetsch, or Danielle can approve or deny attire at the door.'}</p>
      <button className="door-verify-site" disabled={locked || !attireReady} onClick={() => setReview(true)}>{person.attire_status === 'denied' ? 'Review corrected attire' : 'Verify on site'}</button>
      {!attireReady && <p>Enroll a reviewer while connected to use on-site review offline.</p>}
      {review && <DoorAttireDialog offline={offline} person={person} busy={busy} onAction={onAction} onClose={() => setReview(false)} />}
    </div>}
    {person.verification_complete === false && <div className="door-rule"><strong>Registration is incomplete</strong><p>Send this attendee to Chief. Verification must be completed before entry.</p></div>}
    {person.payment_complete === undefined && <div className="door-rule"><strong>Refresh the door requirements</strong><p>{person.issues.join(' · ')}</p></div>}
    {person.attire_by && person.attire_status === 'approved' && <p className="door-rule-cleared">{person.attire_by.split(' ')[0]} verified attire.</p>}
  </div>;
}
