export function draftKey(email, sessionId, cadetId) { return `tb-board-draft-v1:${email}:${sessionId}:${cadetId}`; }
export function readDraft(storage, key) {
  try {
    const draft = JSON.parse(storage.getItem(key) || 'null');
    if (!draft || draft.version !== 1 || !draft.form || typeof draft.form !== 'object' || !Number.isFinite(draft.savedAt) || Date.now() - draft.savedAt > 24 * 60 * 60 * 1000) return null;
    return draft;
  } catch { return null; }
}
export function writeDraft(storage, key, form, baseRevision) {
  try { storage.setItem(key, JSON.stringify({ version: 1, savedAt: Date.now(), form, baseRevision })); return true; }
  catch { return false; }
}
export function clearDraft(storage, key) { try { storage.removeItem(key); } catch { /* explicit server saves still work */ } }

// Canonical comparison lets a lost save response be recognized after reload:
// if the server already holds the same form, local recovery is unnecessary.
export function normalizePracticeForm(input = {}) {
  const uniform = input.uniform ?? input.uniform_inspection ?? {};
  const keys = ['score_address','score_facing','score_creed','score_jrotc','score_class'];
  return {
    scores: Object.fromEntries(keys.map((key) => [key, Number.isInteger(input.scores?.[key]) ? input.scores[key] : null])),
    uniform: { mode: ['class_a','khaki_polo'].includes(uniform?.mode) ? uniform.mode : '', noIssuedUniform: uniform?.noIssuedUniform === true, missing: Array.isArray(uniform?.missing) ? uniform.missing : [], infractions: Array.isArray(uniform?.infractions) ? uniform.infractions : [] },
    rank: input.rank ?? input.rank_before ?? 'PVT',
    leader: input.leader ?? input.leadership_position ?? false,
    decision: input.decision ?? '', target: input.target ?? input.promote_to ?? '', comment: input.comment ?? '',
  };
}
export function recoverPracticeForm(server, recovered) {
  if (!recovered?.form) return null;
  return JSON.stringify(normalizePracticeForm(server)) === JSON.stringify(normalizePracticeForm(recovered.form)) ? null : recovered;
}
