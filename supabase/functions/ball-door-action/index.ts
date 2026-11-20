import { json, preflight } from '../_shared/http.ts';
import { getCaller, serviceClient } from '../_shared/supabase.ts';
import { identifyDoorReviewer } from '../_shared/doorReviewer.ts';
import { PIN_RE } from '../_shared/pin.ts';
import { verifyDoorReview } from '../_shared/doorOfflineProof.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function verifyReviewer(svc: ReturnType<typeof serviceClient>, email: string, pin: string) {
  if (!PIN_RE.test(pin)) return { failure: json({ error: 'Aubry or Kylie must enter their four-digit code' }, 400) };
  const attempt = await svc.rpc('ball_reserve_door_pin', { p_actor: email });
  if (attempt.error) return { failure: json({ error: 'Could not verify code. Try again later' }, 503) };
  if (attempt.data?.allowed !== true) return { failure: json({ error: 'Too many code attempts at this station. Wait 15 minutes before trying again.' }, 423) };
  const { data: accounts, error: accountError } = await svc.from('ball_door_approvers').select('key,email').in('key', ['aubry','kylie']);
  if (accountError || !accounts?.length) return { failure: json({ error: 'Reviewers are not configured' }, 403) };
  const { data: staff, error: staffError } = await svc.from('ball_dress_staff').select('email,name,active,pin_hash,pin_locked_until').in('email', accounts.map(account => account.email));
  if (staffError) return { failure: json({ error: 'Could not verify reviewer codes' }, 503) };
  const identity = await identifyDoorReviewer(pin, (staff || []).map(person => ({ ...person, key: accounts.find(account => account.email === person.email)?.key })));
  if (identity.error || !identity.reviewer) return { failure: json({ error: identity.error }, 401) };
  const cleared = await svc.from('ball_door_pin_attempts').update({ fail_count: 0, locked_until: null }).eq('actor', email);
  if (cleared.error) return { failure: json({ error: 'Could not complete code verification. Please retry' }, 503) };
  return { reviewer: identity.reviewer };
}

async function offlineAction(svc: ReturnType<typeof serviceClient>, email: string, body: Record<string, any>) {
  if (body.sandbox !== false || !uuid.test(body.station_id || '')) return json({ error: 'Prepared station required' }, 400);
  if (body.action === 'offline_enroll') {
    const { data: station, error } = await svc.from('ball_offline_stations').select('id,expires_at').eq('id', body.station_id).eq('actor', email).maybeSingle();
    if (error) return json({ error: 'Could not load this station' }, 503);
    if (!station || Date.parse(station.expires_at) <= Date.now()) return json({ error: 'This station is unavailable or expired' }, 403);
    const { kty, crv, x, y } = body.public_key || {};
    if (kty !== 'EC' || crv !== 'P-256' || !/^[\w-]{43}$/.test(x || '') || !/^[\w-]{43}$/.test(y || '')) return json({ error: 'Invalid offline reviewer key' }, 400);
    const publicKey = { kty, crv, x, y };
    try { await crypto.subtle.importKey('jwk', publicKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']); }
    catch { return json({ error: 'Invalid offline reviewer key' }, 400); }
    const { reviewer, failure } = await verifyReviewer(svc, email, String(body.pin ?? ''));
    if (!reviewer) return failure!;
    const hashBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(reviewer.pin_hash));
    const pinFingerprint = Array.from(new Uint8Array(hashBytes), byte => byte.toString(16).padStart(2, '0')).join('');
    const enrollment = await svc.from('ball_offline_reviewers').insert({
      station_id: station.id, approver_key: reviewer.key, pin_fingerprint: pinFingerprint, public_key: publicKey,
    }).select('id').single();
    if (enrollment.error) return json({ error: 'Could not enroll the offline reviewer' }, 503);
    return json({ result: { id: enrollment.data.id, key: reviewer.key, name: reviewer.name, publicKey } });
  }
  const op = body.operation;
  if (!op || !uuid.test(op.id || '') || !uuid.test(op.person_id || '') || !op.payload) return json({ error: 'Invalid saved action' }, 400);
  let verifiedReviewer = null;
  if (op.action === 'attire') {
    const reviewerId = op.payload.reviewer_id;
    if (!uuid.test(reviewerId || '')) return json({ conflict: 'Offline reviewer proof is missing' });
    const { data: enrollment, error } = await svc.from('ball_offline_reviewers')
      .select('public_key').eq('id', reviewerId).eq('station_id', body.station_id).maybeSingle();
    if (error) return json({ error: 'Could not load the offline reviewer' }, 503);
    if (!enrollment || !await verifyDoorReview(enrollment.public_key, op.payload.signature, body.station_id, op)) {
      return json({ conflict: 'Offline reviewer proof could not be verified' });
    }
    verifiedReviewer = reviewerId;
  }
  const { error } = await svc.rpc('ball_apply_offline_operation', {
    p_actor: email, p_station: body.station_id, p_operation: op, p_verified_reviewer: verifiedReviewer,
  });
  if (error?.code === 'P0001') return json({ conflict: error.message });
  return error ? json({ error: 'Could not sync the saved action. Try again.' }, 503) : json({ synced: true });
}


Deno.serve(async req => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const caller = await getCaller(req);
    if (!caller || caller.mustChangePassword) return json({ error: 'Sign in to check-in first' }, 403);
    const svc = serviceClient();
    const actorResult = await svc.rpc('ball_resolve_checkin_actor', { p_auth_email: caller.email });
    const actor = actorResult.data;
    if (actorResult.error || !actor) return json({ error: 'Check-in access required' }, 403);
    const permission = await svc.rpc('ball_door_actor_allowed', { p_actor: actor });
    if (permission.error || permission.data !== true) return json({ error: 'Check-in access required' }, 403);
    const body = await req.json();
    if (body.action === 'offline_enroll' || body.action === 'offline_sync') return await offlineAction(svc, actor, body);
    if (typeof body.sandbox !== 'boolean' || !['cadet','guest','vip','vip_date'].includes(body.kind) || !/^[0-9a-f-]{36}$/i.test(body.person_id || '')) return json({ error: 'Attendee and explicit sandbox mode required' }, 400);
    if (body.action === 'confirm_student') {
      if (body.sandbox || typeof body.sdhs_student !== 'boolean') return json({ error: 'Use local sandbox confirmation or supply school status' }, 400);
      const { data, error } = await svc.rpc('ball_confirm_door_student', { p_actor: actor, p_kind: body.kind, p_person: body.person_id, p_sdhs: body.sdhs_student });
      return error ? json({ error: error.message }, 409) : json({ result: data });
    }
    if (body.action === 'receive_form') {
      // Sandbox form receipts are handled in tab memory, never this writer.
      if (body.sandbox) return json({ error: 'Use local sandbox form receipt' }, 400);
      const { data, error } = await svc.rpc('ball_receive_door_form', { p_actor: actor, p_kind: body.kind, p_person: body.person_id, p_parent: body.parent_name, p_signed: body.parent_present_signed === true });
      return error ? json({ error: error.message }, 409) : json({ result: data });
    }
    if (body.action !== 'attire' || typeof body.approved !== 'boolean') return json({ error: 'Choose an attire decision' }, 400);
    const { reviewer, failure } = await verifyReviewer(svc, actor, String(body.pin ?? ''));
    if (!reviewer) return failure!;
    const { data, error } = await svc.rpc('ball_decide_door_attire', {
      p_actor: actor, p_kind: body.kind, p_person: body.person_id,
      p_approver: reviewer.key, p_hash: reviewer.pin_hash, p_approved: body.approved,
      p_expected: body.expected_attire, p_sandbox: body.sandbox,
    });
    if (error) return json({ error: error.message }, 409);
    return json({ result: data });
  } catch {
    // Never log request bodies, passcodes, hashes or parent details.
    return json({ error: 'Could not record the door decision. Refresh before retrying' }, 500);
  }
});
