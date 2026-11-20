export function needsAttireReview(person) {
  return person.attire_status === 'pending' || person.attire_status === 'denied';
}

export function doorIssues(person) {
  if (person.payment_complete === undefined) return person.issues || [];
  return [
    person.student_status_unknown && 'Confirm whether this person currently attends SDHS before entry.',
    !person.verification_complete && 'Registration verification incomplete',
    person.form_required && !person.form_received && 'Field trip form missing. Parent must attend in person and sign at the venue.',
    !person.payment_complete && 'Unpaid ticket. Do not admit. Cash is not accepted at the door.',
    person.attire_status === 'denied' && 'Attire denied. Do not admit.',
    person.attire_status === 'pending' && 'Attire approval needed',
  ].filter(Boolean);
}
export function withDoorOverride(person, changes) {
  const result = { ...person, ...changes };
  return { ...result, issues: doorIssues(result) };
}
