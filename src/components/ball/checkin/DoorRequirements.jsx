import { useState } from 'react';
import DoorAttireDialog from './DoorAttireDialog';
import { needsAttireReview } from './doorAdmission';
import { FEMALE_AVOID, FEMALE_WEAR, MALE_AVOID, MALE_WEAR } from '../../../lib/ballDressCode';

function DressCodeReference() {
  return <details className="door-dress-code">
    <summary><span className="door-expand">Expand dress code</span><span className="door-collapse">Collapse dress code</span></summary>
    <div className="door-dress-code-groups">
      {[['Dresses', FEMALE_WEAR, FEMALE_AVOID], ['Suits and uniforms', MALE_WEAR, MALE_AVOID]].map(([title, wear, avoid]) => <section key={title}>
        <h4>{title}</h4>
        <strong>What to wear</strong><ul>{wear.map(rule => <li key={rule}>{rule}</li>)}</ul>
        <strong>Not allowed</strong><ul>{avoid.map(rule => <li key={rule}>{rule}</li>)}</ul>
      </section>)}
    </div>
  </details>;
}

// Each decision belongs to one attendee. Passcodes are cleared after every
// attempt and never retained in roster state, localStorage or an audit payload.
export default function DoorRequirements({ person, busy, disabled, onAction, offline, attireReady }) {
  const [review, setReview] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [parent, setParent] = useState('');
  const [signed, setSigned] = useState(false);
  const [school, setSchool] = useState('');
  const locked = busy || disabled;
  const denied = person.attire_status === 'denied';
  async function paper(event) {
    event.preventDefault();
    if (await onAction(person, 'form', { parent, signed })) { setParent(''); setSigned(false); setFormOpen(false); }
  }
  return <div className="door-requirements">
    {person.payment_complete === false && <div className="door-stop"><strong>Unpaid ticket · Do not admit</strong><p>Payment had to be received before the Ball. Cash will NOT be accepted at the door.</p></div>}
    {person.student_status_unknown && <div className="door-rule"><strong>Confirm current school enrollment</strong><p>Does {person.name} currently attend SDHS? Every attending SDHS student needs their own signed form.</p><label>Current enrollment<select value={school} onChange={event => setSchool(event.target.value)} disabled={locked}><option value="">Choose after asking the attendee</option><option value="yes">Currently an SDHS student</option><option value="no">Not currently an SDHS student</option></select></label><button disabled={locked || !school} onClick={() => onAction(person, 'school', { sdhs: school === 'yes' })}>Confirm school status</button></div>}
    {person.form_required && !person.form_received && <div className="door-stop"><strong>Missing field trip form · Do not admit</strong><p>A parent must come to the venue and sign a paper form at the check-in desk. If a parent cannot come and sign, turn the attendee away.</p>{!formOpen ? <button disabled={locked} onClick={() => setFormOpen(true)}>Record parent-signed paper form</button> : <form onSubmit={paper}>
      <label>Parent’s full name<input value={parent} maxLength={120} required autoComplete="off" onChange={event => setParent(event.target.value)} disabled={locked} /></label>
      <label className="door-attestation"><input type="checkbox" checked={signed} onChange={event => setSigned(event.target.checked)} disabled={locked} required /><span>The parent came to the venue, signed the form at this desk, and I received it.</span></label>
      <button disabled={locked || !signed || parent.trim().length < 2}>{busy ? 'Recording…' : 'Confirm signed form received'}</button><button type="button" disabled={locked} onClick={() => { setFormOpen(false); setParent(''); setSigned(false); }}>Cancel</button>
    </form>}</div>}
    {needsAttireReview(person) && <div className={denied ? 'door-stop' : 'door-rule'}>
      <strong>{denied ? 'Attire denied · Do not admit' : 'Dress or suit needs verification'}</strong>
      <p>{denied ? 'Hold entry until a reviewer approves a corrected outfit.' : 'Inspect this outfit at the door before admitting the attendee.'}</p>
      <DressCodeReference />
      <button className="door-verify-site" disabled={locked || !attireReady} onClick={() => setReview(true)}>{denied ? 'Review corrected attire' : 'Verify on site'}</button>
      {!attireReady && <p>While connected, use Add attire reviewer above to enable offline attire review.</p>}
    </div>}
    {review && <DoorAttireDialog offline={offline} person={person} busy={busy} onAction={onAction} onClose={() => setReview(false)} />}
    {person.verification_complete === false && <div className="door-rule"><strong>Registration is incomplete</strong><p>Send this attendee to Chief. Verification must be completed before entry.</p></div>}
    {person.payment_complete === undefined && <div className="door-rule"><strong>Refresh the door requirements</strong><p>{person.issues.join(' · ')}</p></div>}
    {person.attire_by && person.attire_status === 'approved' && <p className="door-rule-cleared">{person.attire_by.split(' ')[0]} verified attire.</p>}
  </div>;
}
