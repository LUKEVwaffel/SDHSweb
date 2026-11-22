import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import { checkinActor, getCheckinAuth } from '../../../lib/ballCheckinAuth';
import { canCheckInBoth, doorGroups, isVip, personKey } from './doorRoster';
import DoorRequirements from './DoorRequirements';
import { invokeError } from '../../../lib/supabaseFnError';
import { createDoorSource } from './doorSource';
import OfflineDeskControls from './OfflineDeskControls';
import { deskTime, loadOfflineDesk, recordOffline, recordOfflinePair, watchOfflineDesk } from './doorOffline';
import './checkin.css';

const mode = new URLSearchParams(window.location.search);
const sandbox = mode.get('sandbox') === '1' || mode.get('demo') === '1';
const time = value => value ? new Date(value).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) : '';
export default function BallCheckin() {
  const checkinAuth = getCheckinAuth();
  const [pinSession, setPinSession] = useState(undefined);
  const [existingSession, setExistingSession] = useState(null);
  const [desk, setDesk] = useState(sandbox ? null : undefined);
  // Previously prepared desks can finish syncing with their original session.
  const existingDeskSession = desk && checkinActor(existingSession) === desk.actor ? existingSession : null;
  const session = pinSession === undefined ? undefined : pinSession || existingDeskSession;
  const client = session && !pinSession ? SB : checkinAuth;
  const accountId = desk === null ? session?.user?.id : undefined;
  const [livePhase, setPhase] = useState('loading');
  const [livePeople, setPeople] = useState([]);
  const people = desk?.people ?? livePeople;
  const phase = desk ? 'ready' : livePhase;
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [browsing, setBrowsing] = useState(false);
  const [confirmUndo, setConfirmUndo] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [fresh, setFresh] = useState(false);
  const [updated, setUpdated] = useState(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [renewLogin, setRenewLogin] = useState(false);
  const search = useRef(null);
  const detail = useRef(null);
  const results = useRef(null);
  const focusPrimary = useCallback(() => {
    const panel = detail.current;
    (panel?.querySelector('.door-checkin-both:not(:disabled)') || panel?.querySelector('.door-checkin:not(:disabled)') || panel?.querySelector('.door-verify-site:not(:disabled)') || panel?.querySelector('.door-person button:not(:disabled)') || panel?.querySelector('button'))?.focus();
  }, []);
  const writeLock = useRef(false);
  const loadVersion = useRef(0);
  const invalidateLoads = useCallback(() => { loadVersion.current += 1; }, []);
  const invoke = useCallback(body => client.functions.invoke('ball-door-action', { body }), [client]);
  const source = useMemo(() => createDoorSource((name, args) => client.rpc(name, args), sandbox, invoke), [client, invoke]);

  useEffect(() => {
    if (sandbox) return;
    let alive = true;
    function refresh() {
      loadOfflineDesk().then(saved => { if (alive) setDesk(saved); }).catch(() => {
        if (alive) setDesk(previous => previous ?? null);
      });
    }
    refresh();
    const unwatch = watchOfflineDesk(refresh);
    return () => { alive = false; unwatch(); };
  }, []);

  useEffect(() => {
    const pin = checkinAuth.auth.onAuthStateChange((_event, next) => setPinSession(next));
    const existing = SB.auth.onAuthStateChange((_event, next) => setExistingSession(next));
    return () => {
      pin.data.subscription.unsubscribe();
      existing.data.subscription.unsubscribe();
    };
  }, [checkinAuth]);

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    try {
      const { data, error: problem } = await source.load();
      if (version !== loadVersion.current) return;
      if (problem) throw problem;
      setPeople(data.people || []); setUpdated(data.server_time); setFresh(true); setPhase('ready'); setError('');
    } catch (problem) {
      if (version !== loadVersion.current) return;
      setFresh(false); setError(problem.message || 'Could not refresh the roster.');
      setPhase(previous => previous === 'ready' ? previous : 'error');
    }
  }, [source]);

  useEffect(() => {
    source.reset();
    setNotice(''); setConfirmUndo(null);
    if (!accountId) { invalidateLoads(); setPeople([]); setFresh(false); setSelected(null); return; }
    setPhase('loading'); load();
    const id = setInterval(load, 15000);
    return () => { clearInterval(id); invalidateLoads(); };
  }, [accountId, load, invalidateLoads, source]); // Token refresh keeps the current desk state.

  useEffect(() => {
    function connected() { setOnline(true); if (accountId) load(); }
    function disconnected() { setOnline(false); setFresh(false); }
    window.addEventListener('online', connected); window.addEventListener('offline', disconnected);
    return () => { window.removeEventListener('online', connected); window.removeEventListener('offline', disconnected); };
  }, [accountId, load]);

  useEffect(() => {
    function key(event) {
      if (event.defaultPrevented || document.querySelector('dialog[open]')) return;
      const editing = ['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName);
      if (!editing && ['ArrowDown','ArrowUp','ArrowLeft','ArrowRight'].includes(event.key) && event.target.closest('.door-detail')) {
        const buttons = [...event.target.closest('.door-detail').querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)')];
        const index = buttons.indexOf(event.target);
        if (index >= 0) { event.preventDefault(); buttons[(index + (['ArrowUp','ArrowLeft'].includes(event.key) ? -1 : 1) + buttons.length) % buttons.length]?.focus(); }
      }
      if (event.key === 'Escape') { setConfirmUndo(null); setSelected(null); search.current?.focus(); }
      if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) { event.preventDefault(); search.current?.focus(); }
    }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  useEffect(() => {
    if (selected) focusPrimary();
    if (selected && window.matchMedia('(max-width: 680px)').matches) detail.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [selected, focusPrimary]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => { if (phase === 'ready') search.current?.focus(); }, [phase]);

  const groups = useMemo(() => doorGroups(people, query, filter), [people, query, filter]);
  const current = useMemo(() => doorGroups(people).find(group => group.id === selected), [people, selected]);
  const arrived = people.filter(person => person.checked_in_at).length;
  const help = people.filter(person => !person.checked_in_at && person.issues.length).length;

  const canWrite = desk ? deskTime(desk) <= Date.parse(desk.expiresAt) : fresh && online;

  async function runOffline(task, { key = 'offline', dialog = false } = {}) {
    if (writeLock.current) return false;
    writeLock.current = true; setBusy(key); setError('');
    try { return await task(); }
    catch (problem) {
      const saved = await loadOfflineDesk().catch(() => desk);
      setDesk(saved);
      const message = problem.message || 'Could not complete the offline action.';
      if (dialog) return { error: message };
      setError(message);
      return false;
    } finally { writeLock.current = false; setBusy(null); }
  }

  async function mark(person, present) {
    if (writeLock.current || !canWrite) return;
    if (desk) return runOffline(async () => {
      const { next: saved } = await recordOffline(desk, person, 'arrival', { present });
      setDesk(saved); setConfirmUndo(null);
      setNotice(present ? `${person.name} is checked in on this device.` : `Check-in undone for ${person.name} on this device.`);
    }, { key: personKey(person) });
    writeLock.current = true; setBusy(personKey(person)); setError(''); setNotice(''); setConfirmUndo(null);
    // Discard a pre-write refresh so it cannot replace the saved arrival state.
    ++loadVersion.current;
    try {
      const { data, error: problem } = await source.mark(person, present);
      if (problem) throw problem;
      setPeople(previous => previous.map(row => personKey(row) === personKey(person) ? { ...row, ...data } : row));
      setNotice(`${sandbox ? 'Sandbox only: ' : ''}${present ? `${person.name} is checked in.` : `Check-in undone for ${person.name}.`}`);
      await load();
    } catch (problem) {
      const message = problem.message || 'Connection lost. Refresh to see whether check-in saved before trying again.';
      await load(); setError(message);
    } finally { writeLock.current = false; setBusy(null); }
  }
  async function checkInBoth(pair) {
    if (writeLock.current || !canWrite || !canCheckInBoth(pair)) return;
    const names = pair.map(person => person.name).join(' and ');
    if (desk) return runOffline(async () => {
      setDesk(await recordOfflinePair(desk, pair));
      setNotice(`${names} are checked in on this device.`);
    }, { key: 'pair' });
    writeLock.current = true; setBusy('pair'); setError(''); setNotice(''); invalidateLoads();
    try {
      const { data, error: problem } = await source.checkInBoth(pair);
      if (problem) throw problem;
      const updated = new Map(data.map(row => [personKey(row), row]));
      setPeople(previous => previous.map(row => updated.has(personKey(row)) ? { ...row, ...updated.get(personKey(row)) } : row));
      setNotice(`${sandbox ? 'Sandbox only: ' : ''}${names} are checked in.`);
      await load();
    } catch (problem) {
      await load();
      setError(problem.message || 'Could not confirm both arrivals. Refresh the roster before retrying.');
    } finally { writeLock.current = false; setBusy(null); }
  }

  async function doorAction(person, action, input) {
    if (writeLock.current || !canWrite) return false;
    if (desk) return runOffline(async () => {
      const { next: saved, changes } = await recordOffline(desk, person, action, input);
      setDesk(saved);
      setNotice(action === 'attire' ? `${changes.attire_by} reviewed ${person.name} on this device.`
        : action === 'school' ? `School status saved on this device for ${person.name}.` : `Signed form receipt saved on this device for ${person.name}.`);
      return action === 'attire' ? changes : true;
    }, { key: personKey(person), dialog: action === 'attire' });
    writeLock.current = true; setBusy(personKey(person)); setError(''); setNotice(''); invalidateLoads();
    try {
      const response = action === 'attire' ? await source.decideAttire(person, input.pin, input.approved)
        : action === 'school' ? await source.confirmStudent(person, input.sdhs)
        : await source.receiveForm(person, input.parent, input.signed);
      if (response.error || response.data?.error) throw new Error(await invokeError(response.data, response.error, 'Could not record this decision.'));
      await load();
      const message = action === 'attire' ? `${response.data.result.attire_by.split(' ')[0]} verified ${person.name}. Attire ${input.approved ? 'approved' : 'denied. Do not admit'}.`
        : action === 'school' ? `School status recorded for ${person.name}.` : `Signed form received for ${person.name}.`;
      setNotice(`${sandbox ? 'Sandbox only: ' : ''}${message}`);
      return action === 'attire' ? response.data.result : true;
    } catch (problem) {
      const message = problem.message || 'Could not record the door decision.';
      if (action === 'attire') return { error: message };
      setError(message); return false;
    }
    finally { writeLock.current = false; setBusy(null); }
  }
  function next() { setSelected(null); setConfirmUndo(null); setQuery(''); setFilter('all'); setBrowsing(false); search.current?.focus(); }
  function changeSearch(value) { setQuery(value); setSelected(null); setConfirmUndo(null); }
  function openGroup(id) {
    setSelected(id); setConfirmUndo(null);
    requestAnimationFrame(focusPrimary);
  }
  function searchKeys(event) {
    if (['ArrowDown','ArrowUp'].includes(event.key)) {
      event.preventDefault(); setSelected(null); setBrowsing(true);
      requestAnimationFrame(() => {
        const rows = results.current?.querySelectorAll('.door-result');
        if (rows?.length) rows[event.key === 'ArrowDown' ? 0 : rows.length - 1].focus();
      });
    } else if (event.key === 'Enter' && groups.length && (query.trim() || browsing)) {
      event.preventDefault(); openGroup(groups[0].id);
    }
  }
  function resultKeys(event, id) {
    const rows = [...(results.current?.querySelectorAll('.door-result') || [])];
    const index = rows.indexOf(event.currentTarget);
    if (['ArrowDown','ArrowUp','Home','End'].includes(event.key)) {
      event.preventDefault();
      const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? rows.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length;
      rows[nextIndex]?.focus();
    } else if (event.key === 'ArrowLeft') { event.preventDefault(); search.current?.focus(); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); openGroup(id); }
  }
  const complete = current?.people.every(person => person.checked_in_at);
  const pairReady = canCheckInBoth(current?.people);
  const showResults = query.trim() || browsing || filter !== 'all';

  return <main className="ball-door">
    <header className="door-top"><a href={sandbox ? "/ball/checkin?sandbox=1" : "/ball/checkin"} className="door-brand">Trojan Battalion <span>2026 SDHS AJROTC Ball</span></a>
      {session && !desk && <div className="door-account"><span>{session.user.app_metadata?.ball_checkin_name || checkinActor(session)}</span><button onClick={() => checkinAuth.auth.signOut({ scope: 'local' })}>Sign out</button></div>}
      {desk && <div className="door-account door-offline-account"><span>{desk.actor}</span></div>}
    </header>
    {sandbox && <div className="door-demo"><strong>Sandbox · Real guest list</strong><span>Real roster. Practice arrivals, attire decisions and form receipts stay in this tab.</span>{session && <button disabled={!!busy} onClick={() => { source.reset(); next(); setNotice('Sandbox practice decisions cleared.'); load(); }}>Reset practice</button>}</div>}
    {desk === undefined || (!desk && session === undefined) ? <div className="door-centered" role="status">Opening check-in…</div> : !desk && !session ? <DoorLogin /> : <>
      <section className="door-intro"><div><h1>Ball check-in</h1><p>{current ? 'Check in only the people standing at the desk.' : 'Start with a cadet, guest or VIP’s name.'}</p></div>
        {phase === 'ready' && <div className="door-total"><b>{arrived}<span> / {people.length}</span></b><span>people checked in</span><progress value={arrived} max={Math.max(1, people.length)} aria-label="Check-in progress" /></div>}
      </section>
      <div aria-live="polite" className="door-announcements">{notice && <div className="door-success">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss check-in confirmation">Dismiss</button></div>}</div>
      {error && <div className="door-error" role="alert">{error}{!desk && <button disabled={!!busy} onClick={load}>Refresh roster</button>}</div>}
      {!sandbox && (desk || phase === 'ready') && <OfflineDeskControls desk={desk} setDesk={setDesk} session={session} online={online} busy={!!busy}
        run={runOffline} invoke={invoke} onRenew={() => setRenewLogin(value => !value)} prepare={() => client.rpc('ball_prepare_offline_station')} />}
      {desk && online && (renewLogin || checkinActor(session) !== desk.actor)
        && <DoorLogin actor={desk.actor} onSignedIn={() => setRenewLogin(false)} />}
      {!desk && !online && <div className="door-error" role="alert">Wi-Fi is offline and the guest list hasn’t been saved to this browser. Reconnect and choose Set up offline check-in.</div>}
      {phase === 'loading' ? <div className="door-centered" role="status">Loading the guest list…</div> : phase === 'error' ? <div className="door-empty"><h2>Check-in isn’t available yet</h2><p>Your account needs check-in access. Ask the organizer to add you under Military Ball → Check-in.</p><button onClick={load}>Try again</button></div> : <>
        <div className="door-entry-policy"><b>Entry rules</b><span>Tickets must already be paid. <strong>No cash at the door.</strong></span><span>Missing field trip form? A parent must come to the venue and sign.</span><span>Review attire only when flagged.</span></div>
        <div className="door-tools"><div className="door-search"><label htmlFor="door-search">Find a cadet, guest or VIP</label><input ref={search} id="door-search" type="search" autoComplete="off" value={query} onChange={event => changeSearch(event.target.value)} onKeyDown={searchKeys} placeholder="Who’s arriving?" /><span>↑ ↓ browse results · Enter opens · Esc returns to search</span></div>
          {!desk && <div className="door-sync"><span>{fresh && online ? `Updated ${time(updated)}` : 'Roster needs refreshing'}</span><button disabled={!!busy} onClick={load}>Refresh</button></div>}</div>
        {!current && <div className="door-filters" role="group" aria-label="Filter arrivals">{[['all', 'Everyone', people.length], ['waiting', 'Not here yet', people.length - arrived], ['arrived', 'Checked in', arrived], ['help', 'Needs attention', help], ['vip', 'VIPs', people.filter(isVip).length]].map(([key, label, count]) => <button key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label} <span>{count}</span></button>)}</div>}
        <div className={`door-workspace ${current ? 'has-detail' : ''}`}>
          {!current && (showResults ? <section ref={results} className="door-results" aria-label="Matching reservations"><div className="door-list-heading"><b>{groups.length} {groups.length === 1 ? 'reservation' : 'reservations'}</b><span>Arrival is recorded for each person</span></div>
            {groups.length ? groups.map(group => {
              const count = group.people.filter(person => person.checked_in_at).length;
              const needsHelp = group.people.some(person => !person.checked_in_at && person.issues.length);
              return <button className={`door-result ${selected === group.id ? 'is-selected' : ''}`} key={group.id} aria-pressed={selected === group.id} onKeyDown={event => resultKeys(event, group.id)} onClick={() => openGroup(group.id)}>
                <div><strong>{group.people[0].name}</strong>{group.people[1] && <span className="door-companion">with {group.people[1].name}</span>}<small>{isVip(group.people[0]) ? 'VIP reservation' : group.people[0].company || 'Cadet'}</small></div>
                <span className={`door-status ${count === group.people.length ? 'arrived' : needsHelp ? 'help' : ''}`}>{count === group.people.length ? 'Checked in' : count ? `${count} of ${group.people.length} here` : needsHelp ? 'Needs attention' : 'Not here yet'}</span>
              </button>;
            }) : <div className="door-empty"><h2>{query ? 'No matching names' : 'No reservations in this view'}</h2><p>{query ? 'Try the other person’s name or check the spelling. If they are still missing, send them to Chief.' : 'Choose Everyone to see the full guest list.'}</p><button onClick={() => { setQuery(''); setFilter('all'); }}>Show everyone</button></div>}
          </section> : <section className="door-start"><h2>Find a reservation</h2><p>Search by either person’s name, including VIPs and their guests.</p><button onClick={() => setBrowsing(true)}>Browse the guest list</button></section>)}
          {current && <aside ref={detail} className="door-detail" aria-label="Selected reservation">
            <div className="door-detail-heading"><div><p className="door-eyebrow">{complete ? 'Arrival complete' : 'Confirm the names below'}</p><h2>{complete ? 'You’re all set.' : 'Who is here?'}</h2></div><button onClick={() => { setSelected(null); setConfirmUndo(null); search.current?.focus(); }}>Back to results</button></div>
            {current.people.map(person => {
              const key = personKey(person); const checked = !!person.checked_in_at;
              return <article className="door-person" key={key}><div className="door-person-heading"><div><h3>{person.name}</h3><p>{person.person_kind === 'cadet' ? 'Cadet' : person.person_kind === 'guest' ? 'Guest' : person.person_kind === 'vip' ? 'VIP' : 'VIP guest'}{person.company && !isVip(person) ? ` · ${person.company}` : ''}</p></div><span className={`door-status ${checked ? 'arrived' : person.issues.length ? 'help' : ''}`}>{checked ? 'Checked in' : person.attire_status === 'denied' || person.payment_complete === false ? 'Do not admit' : person.issues.length ? 'Not cleared' : 'Ready'}</span></div>
                {checked ? <><p className="door-arrival-time">Arrived at {time(person.checked_in_at)}</p>{confirmUndo === key ? <div className="door-undo-confirm"><p>Undo check-in for {person.name}?</p><button disabled={!!busy || !canWrite} onClick={() => mark(person, false)}>Yes, undo check-in</button><button disabled={!!busy} onClick={() => setConfirmUndo(null)}>Keep checked in</button></div> : <button className="door-undo" disabled={!!busy || !canWrite} onClick={() => setConfirmUndo(key)}>Undo check-in</button>}</> : <><DoorRequirements offline={!!desk} attireReady={!desk || desk.reviewers.length > 0} person={person} busy={busy === key} disabled={!!busy || !canWrite} onAction={doorAction} />{!person.issues.length && <><p className="door-ready">Ready for entry</p><button className="door-checkin" aria-label={`Check in ${person.name}`} disabled={!!busy || !canWrite} onClick={() => mark(person, true)}>{busy === key ? 'Saving check-in…' : `Check in ${person.name.split(' ')[0]}`}</button></>}</>}
              </article>;
            })}
            {pairReady && <div className="door-pair"><p>Use this when both people are at the desk.</p><button className="door-checkin door-checkin-both" disabled={!!busy || !canWrite} onClick={() => checkInBoth(current.people)}>{busy === 'pair' ? 'Saving both arrivals…' : 'Check in both'}</button></div>}
            <div className="door-next"><p>{complete ? 'Everyone on this reservation is checked in.' : 'Someone arriving later? Leave them unchecked.'}</p><button className={complete ? 'door-checkin' : ''} disabled={!!busy} onClick={next}>Next arrival →</button></div>
          </aside>}
        </div>
      </>}
    </>}
  </main>;
}

function DoorLogin({ actor, onSignedIn }) {
  const checkinAuth = getCheckinAuth();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    if (busy || pin.length !== 4) return;
    setBusy(true);
    setError('');
    try {
      const { data, error: problem } = await checkinAuth.functions.invoke('ball-checkin-pin-login', {
        body: { pin, ...(actor ? { expected_actor: actor } : {}) },
      });
      if (problem || !data?.token_hash) {
        throw new Error(await invokeError(data, problem, 'Could not open check-in. Try again.'));
      }
      const { error: sessionError } = await checkinAuth.auth.verifyOtp({ token_hash: data.token_hash, type: 'magiclink' });
      if (sessionError) throw new Error('Could not open check-in. Enter your PIN again.');
      onSignedIn?.();
    } catch (problem) {
      setError(problem.message);
    } finally {
      setPin('');
      setBusy(false);
    }
  }

  return <section className="door-login">
    <p className="door-eyebrow">Welcome desk</p>
    <h1>{actor ? 'Sign in to sync' : 'Ball check-in'}</h1>
    <p>Enter your four-digit check-in PIN.</p>
    <form onSubmit={submit}>
      <label htmlFor="door-staff-pin">Check-in PIN</label>
      <input id="door-staff-pin" type="password" inputMode="numeric" autoComplete="off"
        pattern="[0-9]{4}" maxLength={4} required value={pin}
        onChange={event => setPin(event.target.value.replace(/\D/g, ''))} />
      {error && <p role="alert" className="door-login-error">{error}</p>}
      <button className="door-checkin" disabled={busy || pin.length !== 4}>
        {busy ? 'Signing in…' : actor ? 'Sign in' : 'Open check-in'}
      </button>
    </form>
    <p className="door-login-note">Need a PIN? Ask the Ball organizer.</p>
  </section>;
}
