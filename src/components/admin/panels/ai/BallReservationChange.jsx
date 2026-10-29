import { useEffect, useState } from 'react';
import { supabase as SB } from '../../../../lib/supabaseClient';
import { invokeError } from '../../../../lib/supabaseFnError';
import { P, inter } from '../../theme';

const money = value => `$${Number(value ?? 0).toFixed(2)}`;

export default function BallReservationChange({ proposal, onChanged }) {
  const [status, setStatus] = useState(proposal.status || 'pending');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [emails, setEmails] = useState(null);
  useEffect(() => {
    let current = true;
    SB.from('ball_reservation_changes').select('status,email_state').eq('id', proposal.id).maybeSingle().then(({ data }) => {
      if (current && data) { setStatus(data.status); setEmails(data.email_state); }
    });
    return () => { current = false; };
  }, [proposal.id]);
  async function act(mode) {
    setBusy(true); setError('');
    try {
      const { data, error: requestError } = await SB.functions.invoke('ball-reservation-change', { body: { mode, change_id: proposal.id } });
      if (data?.result) { setStatus('applied'); setEmails(data.emails); onChanged?.(); }
      if (requestError || data?.error) { setError(await invokeError(data, requestError, 'Could not apply change.')); return; }
      if (mode === 'cancel') setStatus('cancelled');
    } catch (err) { setError(err.message || 'Request failed. Retry this same proposal.'); }
    finally { setBusy(false); }
  }
  const newGuest=proposal.action==='add_guest';
  const newFriend=newGuest&&proposal.guest_type==='friend';
  const split = proposal.action === 'split_date';
  const restoring = proposal.action === 'restore_date';
  const adding = proposal.action === 'add_date' || restoring || newGuest;
  const friend = proposal.action === 'remove_friend';
  const allSent = emails?.host?.sent && emails?.date?.sent;
  const button = { border: `1px solid ${P.hair}`, borderRadius: 8, padding: '9px 13px', cursor: 'pointer', font: 'inherit', background: P.deep, color: P.cream };
  return (
    <div className="dispatch-action-card" style={{ width: '100%', boxSizing: 'border-box', maxWidth: 680, border: `1px solid ${P.gold}`, borderRadius: 12, padding: 20, fontFamily: inter, color: P.cream, fontSize: 14 }}>
      <strong>{newGuest ? `Add new ${newFriend?'friend':'date'} · send verification invitation` : restoring ? 'Add date · restore removed guest' : adding ? 'Add date · combine two reservations' : split ? 'Split into two solo reservations' : friend ? 'Remove friend from reservation' : 'Remove date from reservation'}</strong>
      <p>{proposal.host_name} + {proposal.date_name}</p>
      <p style={{ color: P.mute }}>{newGuest?'Current host ticket total':restoring ? 'Current host ticket total' : adding ? 'Current two solo ticket total' : friend ? 'Current host + friend ticket total' : 'Current couple total'} {money(proposal.old_total)} · Payment recorded {money(proposal.old_paid)}</p>
      <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', lineHeight: 1.8 }}>
        <thead><tr><th>After change</th><th>Total</th><th>Paid</th><th>Balance</th><th>Credit</th></tr></thead>
        <tbody>
          <tr><td>{proposal.host_name}</td><td>{money(proposal.host_total)}</td><td>{money(proposal.host_paid)}</td><td>{money(proposal.host_balance)}</td><td>{money(proposal.host_credit)}</td></tr>
          <tr><td>{proposal.date_name}{newGuest?(newFriend?' (separate ticket · unverified)':' (date · unverified)'):adding ? ' (included as date)' : !split && ' (removed)'}</td><td>{money(proposal.date_total)}</td><td>{money(proposal.date_paid)}</td><td>{money(proposal.date_balance)}</td><td>{money(proposal.date_credit)}</td></tr>
        </tbody>
      </table>
      {adding && !restoring && !newGuest && <p style={{ color: P.mute }}>Both people remain attending on one couple reservation. The date’s former solo reservation is merged, with its details archived. The host row shows the shared couple total, payment and balance; the date has no separate ticket charge.</p>}
      {newGuest&&<div style={{color:P.mute,lineHeight:1.6,overflowWrap:'anywhere'}}><p>{proposal.verification_note}</p><p>Guest: age {proposal.guest_details?.age} · {proposal.guest_details?.gender} · {proposal.guest_details?.school_attended}</p>{proposal.guest_details?.poc_name&&<p>Point of contact: {proposal.guest_details.poc_name} · {proposal.guest_details.poc_email} · {proposal.guest_details.poc_phone}</p>}</div>}
      {restoring && <p style={{ color: P.mute }}>Restores the guest details saved when removed from {proposal.previous_host_name}’s reservation. Verification: {proposal.guest_verified ? 'previously completed' : 'still outstanding'}. Existing forms and attire statuses carry over. Previous credit of {money(proposal.previous_credit)} stays in the removal audit for staff refund review; no payment is transferred or refunded.</p>}
      {friend && <p style={{ color: P.mute }}>The host keeps their existing ticket and payment. Any recorded friend payment is retained in this change for staff credit/refund review.</p>}
      <p style={{ color: P.mute }}>{newGuest?'A host update and a separate guest verification invitation will be sent to':'Reservation and balance updates will be emailed to'} {proposal.host_email} and {proposal.date_email}.</p>
      {(proposal.host_credit > 0 || proposal.date_credit > 0) && <p style={{ color: P.gold }}>Credit requires staff review. No refund is issued automatically.</p>}
      {status === 'pending' && <div style={{ display: 'flex', gap: 10 }}>
        <button style={{ ...button, color: P.gold }} disabled={busy} onClick={() => act('apply')}>{busy ? 'Applying…' : newGuest?'Add guest & send invitation':'Apply and email'}</button>
        <button style={button} disabled={busy} onClick={() => act('cancel')}>Cancel</button>
      </div>}
      {status === 'cancelled' && <p>Change cancelled.</p>}
      {status === 'applied' && <div>
        <p>{allSent ? newGuest?'Reservation updated. Host update and guest invitation accepted for delivery.':'Reservation updated. Both email notifications accepted for delivery.' : 'Reservation updated. Email notifications need attention.'}</p>
        {!allSent && <button style={button} disabled={busy} onClick={() => act('apply')}>{busy ? 'Retrying…' : 'Retry notifications'}</button>}
      </div>}
      {error && <p role="alert" style={{ color: P.red }}>{error}</p>}
    </div>
  );
}
