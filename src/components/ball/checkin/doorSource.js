import { withDoorOverride } from './doorAdmission.js';
import { canCheckInBoth, personKey } from './doorRoster.js';

// Sandbox always reads the authenticated live roster, but attendance writes
// stop here. Overrides live only in this page instance and survive polling.
export function createDoorSource(rpc, sandbox, invoke) {
  const overrides = new Map();
  return {
    reset() { overrides.clear(); },
    async load() {
      const response = await rpc('ball_checkin_roster');
      if (response.error || !response.data) return response;
      return { ...response, data: { ...response.data, people: response.data.people.map(person => withDoorOverride(person, overrides.get(personKey(person)) || {})) } };
    },
    async decideAttire(person, pin, approved) {
      const response = await invoke({ action: 'attire', kind: person.person_kind, person_id: person.person_id, pin, approved, expected_attire: person.attire_status, sandbox });
      if (response.error || response.data?.error) return response;
      if (sandbox) overrides.set(personKey(person), { ...overrides.get(personKey(person)), ...response.data.result });
      return response;
    },
    async confirmStudent(person, sdhs) {
      if (sandbox) {
        const result = { student_status_unknown: false, form_required: sdhs };
        overrides.set(personKey(person), { ...overrides.get(personKey(person)), ...result });
        return { data: { result }, error: null };
      }
      return invoke({ action: 'confirm_student', kind: person.person_kind, person_id: person.person_id, sdhs_student: sdhs, sandbox });
    },
    async receiveForm(person, parentName, signed) {
      if (!signed || parentName.trim().length < 2) return { data: { error: 'Parent must be here and sign the paper form before you record it.' }, error: null };
      if (sandbox) {
        overrides.set(personKey(person), { ...overrides.get(personKey(person)), form_received: true });
        return { data: { result: { form_received: true } }, error: null };
      }
      return invoke({ action: 'receive_form', kind: person.person_kind, person_id: person.person_id, parent_name: parentName.trim(), parent_present_signed: signed, sandbox });
    },
    async checkInBoth(people) {
      if (!canCheckInBoth(people)) return { data: null, error: { message: 'Both people must be cleared and waiting.' } };
      if (!sandbox) return rpc('ball_check_in_pair', { p_people: people.map(person => ({
        kind: person.person_kind, id: person.person_id, revision: person.revision || null,
      })) });
      const checked_in_at = new Date().toISOString();
      const data = people.map(person => ({
        person_kind: person.person_kind, person_id: person.person_id, checked_in_at, revision: crypto.randomUUID(),
      }));
      for (const row of data) overrides.set(personKey(row), { ...overrides.get(personKey(row)), ...row });
      return { data, error: null };
    },
    async mark(person, present) {
      if (present && withDoorOverride(person, overrides.get(personKey(person)) || {}).issues.length) return { data: null, error: { message: 'Entry requirements are not complete. Do not admit.' } };
      if (sandbox) {
        const data = { person_kind: person.person_kind, person_id: person.person_id, checked_in_at: present ? new Date().toISOString() : null, revision: crypto.randomUUID() };
        overrides.set(personKey(person), { ...overrides.get(personKey(person)), ...data });
        return { data, error: null };
      }
      return rpc('ball_set_arrival', { p_kind: person.person_kind, p_person: person.person_id, p_present: present, p_revision: person.revision || null });
    },
  };
}
