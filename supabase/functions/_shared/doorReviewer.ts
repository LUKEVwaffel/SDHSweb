import { verifyPin } from './pin.ts';
type Reviewer = { key: string; email: string; name: string; pin_hash: string; active: boolean; pin_locked_until?: string | null };
// Match both protected codes without exposing either hash to the browser.
// Duplicate codes fail closed instead of attributing a decision arbitrarily.
export async function identifyDoorReviewer(pin: string, reviewers: Reviewer[]) {
  const eligible = reviewers.filter(person => ['aubry','kylie'].includes(person.key) && person.active && person.pin_hash);
  const checks = await Promise.all(eligible.map(async person => ({ person, matches: await verifyPin(pin, person.pin_hash) })));
  const matches = checks.filter(check => check.matches);
  if (matches.length > 1) return { error: 'Reviewer codes must be different. Ask S-6 to reset one code.', reviewer: null };
  if (!matches.length) return { error: 'Code not accepted. No attire decision was recorded.', reviewer: null };
  const reviewer = matches[0].person;
  if (reviewer.pin_locked_until && new Date(reviewer.pin_locked_until).getTime() > Date.now()) return { error: 'This reviewer’s code is temporarily locked. Wait before trying again.', reviewer: null };
  return { error: null, reviewer };
}
