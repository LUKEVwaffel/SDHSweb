import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPin, verifyPin, PIN_RE } from '../supabase/functions/_shared/pin.ts';
// Synthetic code/hash only; these tests never call a live approver account.
test('Attire code verifier accepts only the matching protected code', async () => {
  const hash = await hashPin('0937');
  assert.equal(await verifyPin('0937', hash), true);
  assert.equal(await verifyPin('0938', hash), false);
  assert.equal(await verifyPin('0937', null), false);
  assert.equal(await verifyPin('0937', 'corrupt-hash'), false);
  for (const value of ['', '937', '09370', '09x7']) assert.equal(PIN_RE.test(value), false);
  assert.equal(PIN_RE.test('0937'), true);
});
