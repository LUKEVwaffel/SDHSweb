import { signDoorReview, verifyDoorReview } from '../../../../supabase/functions/_shared/doorOfflineProof.js';
import { withDoorOverride } from './doorAdmission.js';
import { personKey } from './doorRoster.js';

let database;
let changes;
function changeChannel() {
  if (typeof BroadcastChannel === 'function') changes ??= new BroadcastChannel('ball-checkin-2026');
  return changes;
}

export function watchOfflineDesk(listener) {
  const channel = changeChannel();
  channel?.addEventListener('message', listener);
  return () => channel?.removeEventListener('message', listener);
}
function openDatabase() {
  database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('ball-checkin-2026', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('desk');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch(error => { database = undefined; throw error; });
  return database;
}

export async function loadOfflineDesk() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction('desk').objectStore('desk').get('active');
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

// Roster and outbox commit together. A second tab cannot overwrite either.
export async function saveOfflineDesk(previous, next) {
  const db = await openDatabase();
  const saved = next && { ...next, version: (previous?.version ?? 0) + 1 };
  return new Promise((resolve, reject) => {
    const tx = db.transaction('desk', 'readwrite', { durability: 'strict' });
    const store = tx.objectStore('desk');
    let changed = false;
    const request = store.get('active');
    request.onsuccess = () => {
      const current = request.result;
      if (current?.id !== previous?.id || current?.version !== previous?.version) {
        changed = true;
        tx.abort();
      } else if (saved) store.put(saved, 'active');
      else store.delete('active');
    };
    tx.oncomplete = () => {
      changeChannel()?.postMessage('updated');
      resolve(saved);
    };
    tx.onabort = () => reject(new Error(changed ? 'The offline station changed in another tab. Try again here.' : 'Could not save on this device. Keep this page open and try again.'));
  });
}

export async function prepareCheckinShell() {
  if (!('serviceWorker' in navigator)) throw new Error('This browser cannot prepare an offline station.');
  await navigator.serviceWorker.register('/ball-checkin-sw.js', { scope: '/ball/checkin' });
  const worker = (await navigator.serviceWorker.ready).active;
  const channel = new MessageChannel();
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { channel.port1.close(); reject(new Error('The offline download timed out. Try again while connected.')); }, 30000);
    channel.port1.onmessage = ({ data }) => {
      clearTimeout(timer);
      channel.port1.close();
      if (data.ready) resolve();
      else reject(new Error(data.error));
    };
    worker.postMessage({ type: 'prepare-ball-checkin' }, [channel.port2]);
  });
  // Where available, ask the browser to keep the desk through storage pressure.
  await navigator.storage?.persist?.().catch(() => {});
}

export function deskTime(desk) {
  return Date.now() + desk.clockOffset;
}

export async function recordOffline(desk, person, action, input) {
  const now = deskTime(desk);
  if (now > Date.parse(desk.expiresAt) || now < Date.parse(desk.issuedAt)) throw new Error('The offline work window has ended or the device clock changed. Reconnect to sync saved actions.');
  const current = desk.people.find(row => personKey(row) === personKey(person));
  if (!current || current !== person) throw new Error('The attendee changed. Review the roster and try again.');
  const operation = { id: crypto.randomUUID(), action, kind: person.person_kind, person_id: person.person_id, occurred_at: new Date(now).toISOString() };
  let changes;
  if (action === 'arrival') {
    if (input.present && person.issues.length) throw new Error('Entry requirements are incomplete. Do not admit.');
    if (Boolean(person.checked_in_at) === input.present) throw new Error('Arrival has already been recorded.');
    operation.payload = { present: input.present, revision: person.revision || null };
    changes = { checked_in_at: input.present ? operation.occurred_at : null, revision: operation.id };
  } else if (action === 'school') {
    if (!person.student_status_unknown || typeof input.sdhs !== 'boolean') throw new Error('Confirm current SDHS enrollment.');
    operation.payload = { sdhs: input.sdhs };
    changes = { student_status_unknown: false, form_required: input.sdhs };
  } else if (action === 'form') {
    const parent = input.parent.trim();
    if (!person.form_required || person.form_received || !input.signed || parent.length < 2 || parent.length > 120) throw new Error('Record the parent’s name after receiving their signed paper form.');
    operation.payload = { parent, signed: true };
    changes = { form_received: true };
  } else if (action === 'attire') {
    if (person.checked_in_at) throw new Error('Undo check-in before recording an attire decision.');
    for (const reviewer of desk.reviewers) {
      operation.payload = { reviewer_id: reviewer.id, approved: input.approved, expected: person.attire_status };
      const signature = await signDoorReview(reviewer.publicKey, input.pin.trim(), desk.id, operation).catch(() => null);
      if (signature && await verifyDoorReview(reviewer.publicKey, signature, desk.id, operation)) {
        operation.payload.signature = signature;
        changes = { attire_status: input.approved ? 'approved' : 'denied', attire_by: reviewer.name };
        break;
      }
    }
    if (!changes) throw new Error('This reviewer code does not match an enrolled reviewer on this station.');
  } else throw new Error('Unknown door action.');
  const next = await saveOfflineDesk(desk, {
    ...desk,
    people: desk.people.map(row => row === person ? withDoorOverride(row, changes) : row),
    pending: [...desk.pending, { operation, attendee: person.name }],
  });
  return { next, changes };
}
