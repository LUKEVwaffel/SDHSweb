import { normalizePracticeForm } from './draftRecovery.js';
export const sharedDraftKey = (email, session, cadet, focus) => `tb-shared-cadet-v1:${email}:${session}:${cadet}:${focus}`;
export function sharedField(row, field) {
  const form = normalizePracticeForm(row ?? {});
  if (field.startsWith('score_')) return form.scores[field] ?? null;
  if (field === 'rank_before') return form.rank;
  if (field === 'leadership_position') return form.leader;
  if (field === 'promote_to') return form.target;
  if (field.startsWith('uniform.')) {
    const [, key, item] = field.split('.');
    return item ? form.uniform[key].includes(item) : form.uniform[key];
  }
  return form[field] ?? '';
}
export function applyPendingFields(row, pending) {
  const form = normalizePracticeForm(row ?? {});
  for (const [field, edit] of Object.entries(pending)) {
    const value = edit.value;
    if (field.startsWith('score_')) form.scores[field] = value;
    else if (field === 'rank_before') { form.rank = value; form.decision = ''; form.target = ''; }
    else if (field === 'leadership_position') { form.leader = value; form.decision = ''; form.target = ''; }
    else if (field === 'promote_to') form.target = value;
    else if (field.startsWith('uniform.')) {
      const [, key, item] = field.split('.');
      if (!item) form.uniform[key] = value;
      else form.uniform[key] = value ? [...new Set([...form.uniform[key], item])] : form.uniform[key].filter((x) => x !== item);
    } else form[field] = value;
  }
  return form;
}
export function newerSharedRow(current, incoming) {
  if (!incoming) return current;
  return !current || Number(incoming.edit_sequence ?? 0) >= Number(current.edit_sequence ?? 0) ? incoming : current;
}
