// Tickets require positive completion, never merely the absence of rejection.
const knownAmount = value => value != null && value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0;
const sdhsSchool = value => /\bsoddy[\s-]*daisy\b|\bsdhs\b/i.test(String(value || ''));
export function isBallHostFormRequired(host) {
  return host?.standalone_guest !== true || host?.field_trip_form_required !== false;
}
export function isBallGuestFormRequired(guest) {
  if (!guest) return false;
  return guest.field_trip_form_required !== false || guest.is_sdhs_jrotc === true || !!guest.sdhs_matched_cadet_id || sdhsSchool(guest.school_attended);
}
export function isBallGuestSchoolUnknown(guest){
 return !!guest&&guest.is_sdhs_jrotc!==true&&guest.field_trip_form_required===false&&!guest.sdhs_matched_cadet_id&&!String(guest.school_attended||'').trim();
}
export function isBallLabelEligible(host, guest) {
  return getBallTicketReadinessIssues(host, guest).length === 0;
}

export function getBallTicketReadinessIssues(host, guest) {
  const issues = [];
  if (!host) return ['Reservation no longer exists.'];
  const hostName = host.cadet_name || 'Cadet';
  const guestName = guest?.name || 'Guest';
  if (host.status !== 'fully_verified') issues.push(`${hostName}'s reservation is not verified.`);
  if(isBallGuestSchoolUnknown(guest))issues.push(`${guestName}'s current SDHS student status is unconfirmed.`);
  if (guest && !guest.verified_at) issues.push(`${guestName}'s verification is incomplete.`);
  if (isBallHostFormRequired(host) && host.field_trip_form_received !== true) {
    issues.push(host.standalone_guest !== true || host.field_trip_form_required === true
      ? `${hostName}'s field-trip form is not marked received.`
      : `${hostName}'s field-trip form requirement is unspecified.`);
  }
  if (guest && isBallGuestFormRequired(guest) && guest.field_trip_form_received !== true) {
    const schoolRequiresForm = guest.is_sdhs_jrotc === true || !!guest.sdhs_matched_cadet_id || sdhsSchool(guest.school_attended);
    issues.push(schoolRequiresForm || guest.field_trip_form_required === true
      ? `${guestName}'s field-trip form is not marked received.`
      : `${guestName}'s field-trip form requirement is unspecified.`);
  }
  if (!knownAmount(host.amount_due)) issues.push(`${hostName}'s ticket amount is unknown.`);
  const paid = host.amount_paid ?? (host.cash_received === true ? host.amount_due : 0);
  if (knownAmount(host.amount_due) && (!knownAmount(paid) || Math.round(Number(paid) * 100) < Math.round(Number(host.amount_due) * 100))) {
    issues.push(`${hostName}'s ticket balance is not fully paid.`);
  }
  if (guest?.guest_type === 'friend') {
    if (!knownAmount(guest.friend_amount_due)) issues.push(`${guestName}'s friend ticket amount is unknown.`);
    const friendPaid = guest.friend_cash_received === true || (guest.friend_payment_method === 'host_delivers' && host.cash_received === true);
    if (knownAmount(guest.friend_amount_due) && Number(guest.friend_amount_due) > 0 && !friendPaid) issues.push(`${guestName}'s friend ticket payment is not recorded.`);
  }
  // Regular male cadets wear their issued uniform; individual approval does
  // not apply to their reservation, even if an old approval field is false.
  // Standalone guests and every accompanying guest still require approval.
  const standardUniform = String(host.cadet_gender || '').trim().toLowerCase() === 'male' && host.standalone_guest !== true;
  if (host.door_attire_denied === true) issues.push(`${hostName} has an on-site attire denial. Do not issue a ticket.`);
  if (!standardUniform && host.dress_approved !== true) {
    issues.push(host.dress_approved === false ? `${hostName}'s attire is marked not approved.` : `${hostName}'s attire approval is missing.`);
  }
  if (guest && guest.dress_approved !== true) issues.push(`${guestName}'s attire approval is missing.`);
  return issues;
}

// A receipt is a follow-up for an unfinished reservation, not a ticket.
// A saved delivery always wins, even if a later edit makes the booking incomplete.
export function isBallReceiptEligible(host, guest, delivery) {
  return delivery?.distributed !== true && !isBallLabelEligible(host, guest);
}

export function getBallPaymentFacts(host,guest){
 const total=knownAmount(host?.amount_due)?Number(host.amount_due):null;
 const recorded=host?.amount_paid ?? (host?.cash_received===true?total:0);
 const paid=knownAmount(recorded)?Number(recorded):null;
 const hostBalance=total==null||paid==null?null:Math.max(0,Math.round((total-paid)*100)/100);
 const friendTotal=guest?.guest_type==='friend'?(knownAmount(guest.friend_amount_due)?Number(guest.friend_amount_due):null):0;
 const friendPaid=guest?.friend_cash_received===true||(guest?.friend_payment_method==='host_delivers'&&host?.cash_received===true);
 const friendBalance=friendTotal==null?null:friendPaid?0:friendTotal;
 return {total,paid,hostBalance,friendBalance,complete:hostBalance===0&&friendBalance===0};
}

export function isBallStatusReceiptCurrent(field,host,guest){
 const payment=getBallPaymentFacts(host,guest);
 if(field==='cash')return host?.cash_received===true&&payment.hostBalance===0;
 if(field==='form')return host?.field_trip_form_received===true;
 if(field==='friend_cash')return guest?.guest_type==='friend'&&guest.friend_cash_received===true&&payment.friendBalance===0;
 if(field==='guest_form')return guest?.field_trip_form_received===true;
 return false;
}
