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
  const [showConflict, setShowConflict] = useState(false);
  const email = checkinActor(session);
  const signedIn = Boolean(email && (!desk || email === desk.actor));
  const expired = desk && deskTime(desk) > Date.parse(desk.expiresAt);
  const needsReviewers = desk && new Set(desk.reviewers.map(reviewer => reviewer.key)).size < 4;

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
      setCode({ name: result.name, value: reviewerCode });
    });
  }

  async function sync() {
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
      if (blocked.size) setShowConflict(true);
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

  if (!desk) return <section className="door-offline-tools" aria-label="Offline setup">
    <p><strong>Venue Wi-Fi uncertain?</strong> While connected, download the latest roster on the computer you’ll use at the welcome desk.</p>
    <button disabled={busy || !online || !signedIn} onClick={start}>Prepare offline station</button>
  </section>;

  const conflicts = desk.pending.filter(row => row.conflict);
  return <section className="door-offline-tools" aria-label="Offline station">
    <div aria-live="polite">
      <strong>{expired ? 'Offline work window ended' : needsReviewers ? 'Offline roster ready · reviewer setup incomplete' : 'Offline station ready'}</strong>
      <p>Roster saved at {new Date(desk.issuedAt).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/New_York' })}. {desk.pending.length ? `${desk.pending.length} action${desk.pending.length === 1 ? '' : 's'} waiting to sync.` : 'No actions waiting to sync.'} {!online && 'No internet connection.'}</p>
      <p>{desk.reviewers.length ? `Reviewers enrolled: ${[...new Set(desk.reviewers.map(reviewer => reviewer.name))].join(', ')}.` : 'Enroll Aubry, Kylie, Luke, and Danielle while connected to enable offline attire reviews.'}</p>
      {needsReviewers && desk.reviewers.length > 0 && <p>Enroll the remaining reviewers while connected.</p>}
      {!signedIn && online && <p>Sign back in as {desk.actor} to sync or enroll a reviewer.</p>}
    </div>
    <div className="door-offline-buttons">
      {!expired && <button disabled={busy || !online || !signedIn || !!code} onClick={() => setEnrolling(value => !value)}>{enrolling ? 'Cancel reviewer setup' : 'Enroll an offline reviewer'}</button>}
      <button disabled={busy || !online || !signedIn || !desk.pending.length} onClick={sync}>Sync saved actions</button>
      {online && signedIn && <button disabled={busy} onClick={onRenew}>Renew sign-in</button>}
      {desk.pending.length > 0 && <button disabled={busy} onClick={exportPending}>Export unsynced actions</button>}
      <button disabled={busy || !online || !signedIn || !!desk.pending.length} onClick={() => run(async () => {
        setDesk(await saveOfflineDesk(desk, null));
        setEnrolling(false);
        setCode(null);
      })}>Return to live &amp; clear device</button>
    </div>
    {enrolling && <form className="door-offline-enroll" onSubmit={enroll}>
      <label>Reviewer’s existing four-digit passcode <input type="password" autoComplete="off" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, ''))} required disabled={busy || !online} /></label>
      <button disabled={busy || !online || !signedIn || pin.length !== 4}>Create offline reviewer code</button>
    </form>}
    {code && <div className="door-rule">
      <strong>{code.name}’s offline reviewer code</strong>
      <p>Have the reviewer save this code privately on their own device. It is shown once and works on this station.</p>
      <code className="door-reviewer-code">{code.value}</code>
      <button type="button" onClick={() => setCode(null)}>Hide code</button>
    </div>}
    {conflicts.length > 0 && <details open={showConflict} onToggle={event => setShowConflict(event.currentTarget.open)}>
      <summary>{conflicts.length} sync {conflicts.length === 1 ? 'conflict needs' : 'conflicts need'} organizer review</summary>
      <p>Export the unsynced actions for the organizer. Later actions for the same attendee stay queued behind the conflict.</p>
      <ul>{conflicts.map(({ attendee, operation, conflict }) => <li key={operation.id}>{attendee} · {conflict}</li>)}</ul>
    </details>}
  </section>;
}
