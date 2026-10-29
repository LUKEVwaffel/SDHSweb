import test from 'node:test';
import assert from 'node:assert/strict';
import { issuePollGuestToken, validPollGuestToken } from '../supabase/functions/_shared/pollGuestToken.ts';
test('Guest sessions authenticate, reject forged values, and expire on password or PIN reset',async()=>{
 const secret='fixture-password-hash|fixture-pin-hash';const token=await issuePollGuestToken(secret);
 assert.equal(await validPollGuestToken(token,secret),true);
 assert.equal(await validPollGuestToken(token,'new-password-hash|fixture-pin-hash'),false);
 assert.equal(await validPollGuestToken(token,'fixture-password-hash|new-pin-hash'),false);
 assert.equal(await validPollGuestToken(token+'x',secret),false);
 assert.equal(await validPollGuestToken('invalid',secret),false);
});
