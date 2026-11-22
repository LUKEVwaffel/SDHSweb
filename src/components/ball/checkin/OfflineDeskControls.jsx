import { useState } from 'react';
import { checkinActor } from '../../../lib/ballCheckinAuth.js';
import { createReviewerCode } from '../../../../supabase/functions/_shared/doorOfflineProof.js';
import { invokeError } from '../../../lib/supabaseFnError.js';
import { deskTime, prepareCheckinShell, saveOfflineDesk } from './doorOffline.js';

async function send(invoke, body) {
  const response = await invoke({ ...body, sandbox: false });
  if (response.error || response.data?.error) throw new Error(await invokeError(response.data, response.error, 'Could not reach the check-in server.'));
  return response.data;
}

export default function OfflineDeskControls({ desk, setDesk, session, online, busy, run, invoke, prepare, onRenew }) {
  const [enrolling, setEnrolling] = useState(false);
  const [pin, setPin] = useState('');
  const [code, setCode] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showConflict, setShowConflict] = useState(false);
  const email = checkinActor(session);
  const signedIn = Boolean(email && (!desk || email === desk.actor));
  const expired = desk && deskTime(desk) > Date.parse(desk.expiresAt);
  const reviewers = [...new Set(desk?.reviewers.map(reviewer => reviewer.name))];
  const canManage = !busy && online && signedIn && !code;

  function start() {
    return run(async () => {
      await prepareCheckinShell();
      const { data, error } = await prepare();
      if (error) throw error;
      if (!data?.station_id || !Array.isArray(data.people) || data.people.some(person => typeof person.payment_complete !== 'boolean')) {
        throw new Error('The check-in server needs the offline update.');
      }
      if (data.actor !== email) throw new Error('The signed-in account changed. Sign in to prepare the station again.');
      const snapshot = {
        id: data.station_id, actor: data.actor, issuedAt: data.issued_at,
        expiresAt: data.expires_at, clockOffset: Date.parse(data.issued_at) + 1 - Date.now(),
        people: data.people, pending: [], reviewers: [],
      };
      setDesk(await saveOfflineDesk(null, snapshot));
    });
  }

  function enroll(event) {
    event.preventDefault();
    const enteredPin = pin;
    setPin('');
    return run(async () => {
      const { publicKey, code: reviewerCode } = await createReviewerCode();
      const { result } = await send(invoke, { action: 'offline_enroll', station_id: desk.id, pin: enteredPin, public_key: publicKey });
      setDesk(await saveOfflineDesk(desk, { ...desk, reviewers: [...desk.reviewers, result] }));
      setEnrolling(false);
      setCopied(false);
      setCode({ name: result.name, value: reviewerCode });
    });
  }

  async function finish() {
    await run(async () => {
      let current = desk;
      const blocked = new Set();
      for (const entry of desk.pending) {
        const { operation } = entry;
        const key = operation.kind + ':' + operation.person_id;
        if (blocked.has(key)) continue;
        const response = await send(invoke, { action: 'offline_sync', station_id: desk.id, operation });
        if (!response.synced && !response.conflict) throw new Error('The server could not confirm the saved action.');
        if (response.conflict) blocked.add(key);
        const pending = response.synced ? current.pending.filter(row => row.operation.id !== operation.id)
          : current.pending.map(row => row.operation.id === operation.id ? { ...row, conflict: response.conflict } : row);
        current = await saveOfflineDesk(current, { ...current, pending });
        setDesk(current);
      }
      if (blocked.size) {
        setShowConflict(true);
        return;
      }
      setDesk(await saveOfflineDesk(current, null));
      setEnrolling(false);
      setCode(null);
    });
  }

  function exportPending() {
    const backup = new Blob([JSON.stringify({ station: desk.id, operator: desk.actor, pending: desk.pending }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(backup);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ball-checkin-unsynced.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (!desk) return <section className="door-offline-tools door-offline-summary" aria-label="Offline setup">
    <div><strong>Offline check-in</strong><p>Save the guest list here before you lose Wi-Fi.</p></div>
    <button disabled={!canManage} onClick={start}>{busy ? 'Working…' : 'Set up offline check-in'}</button>
  </section>;

  const conflicts = desk.pending.filter(row => row.conflict);
  const waiting = desk.pending.length;
  return <section className="door-offline-tools" aria-label="Offline station">
    <div className="door-offline-summary">
      <div aria-live="polite">
        <strong>{expired ? 'Offline check-in expired' : 'Offline check-in ready'}</strong>
        <p>{expired ? 'Reconnect to upload saved arrivals.' : 'Use this browser to check in guests, with or without Wi-Fi.'}</p>
        <p>{waiting ? `${waiting} saved ${waiting === 1 ? 'action' : 'actions'} to upload.` : 'No saved actions to upload.'}{!online && ' Wi-Fi is offline.'}</p>
        {online && !signedIn && <p>Sign in again below to finish or add a reviewer.</p>}
      </div>
      {online && signedIn && <button className="door-offline-primary" disabled={!canManage || enrolling} onClick={finish}>
        {busy ? 'Working…' : waiting ? 'Upload and return to live' : 'Return to live check-in'}
      </button>}
    </div>
    {!expired && <div className="door-offline-reviewers">
      <div><strong>Offline attire review</strong>
        <p>{reviewers.length ? `Ready for ${reviewers.join(', ')}.` : 'Add anyone who will review outfits without Wi-Fi.'}</p>
      </div>
      {online && signedIn && !code && <button disabled={!canManage} onClick={() => {
        setPin('');
        setEnrolling(value => !value);
      }}>{enrolling ? 'Cancel' : 'Add attire reviewer'}</button>}
    </div>}
    {enrolling && !expired && <form className="door-offline-enroll" onSubmit={enroll}>
      <label>Reviewer’s four-digit attire passcode <input type="password" autoComplete="off" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, ''))} required disabled={!canManage} /></label>
      <button disabled={!canManage || pin.length !== 4}>Create offline code</button>
    </form>}
    {code && <div className="door-rule door-offline-code">
      <strong>{code.name}’s offline code</strong>
      <p>Copy this code somewhere private. Enter it when reviewing attire without Wi-Fi on this station.</p>
      <code className="door-reviewer-code">{code.value}</code>
      <div className="door-offline-buttons">
        <button type="button" onClick={async () => {
          try { await navigator.clipboard.writeText(code.value); setCopied(true); }
          catch { setCopied(false); }
        }}>{copied ? 'Copied' : 'Copy code'}</button>
        <button type="button" onClick={() => setCode(null)}>Done</button>
      </div>
    </div>}
    {(waiting > 0 || (online && signedIn)) && <details className="door-offline-options">
      <summary>More options</summary>
      <div className="door-offline-buttons">
        {online && signedIn && <button disabled={busy} onClick={onRenew}>Sign in again</button>}
        {waiting > 0 && <button disabled={busy} onClick={exportPending}>Export unsynced actions</button>}
      </div>
    </details>}
    {conflicts.length > 0 && <details open={showConflict} onToggle={event => setShowConflict(event.currentTarget.open)}>
      <summary>{conflicts.length} sync {conflicts.length === 1 ? 'conflict needs' : 'conflicts need'} organizer review</summary>
      <p>Export the unsynced actions from More options and give the file to the organizer.</p>
      <ul>{conflicts.map(({ attendee, operation, conflict }) => <li key={operation.id}>{attendee} · {conflict}</li>)}</ul>
    </details>}
  </section>;
}
