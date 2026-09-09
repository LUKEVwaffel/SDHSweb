// Canonical shape for the Step 3 guest sub-form. One definition, imported by
// the wizard (initial state + "No guest" reset) and StepGuestInfo (the
// guest-type switch reset) so the two call sites can't drift out of sync.

export function blankGuestFields() {
  return {
    guest_type: null,
    name: '', age: '', gender: '',
    is_sdhs_jrotc: false, sdhs_matched_cadet_id: null,
    goes_to_sdhs: null, other_jrotc: false, other_jrotc_school: '', school_attended: '',
    poc_name: '', poc_email: '', poc_phone: '',
    personal_email: '', phone: '', friend_payment_method: '',
  };
}

export function emptyGuest() {
  return { bringing_guest: null, ...blankGuestFields() };
}
