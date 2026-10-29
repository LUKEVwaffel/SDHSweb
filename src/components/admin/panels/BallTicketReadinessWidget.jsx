import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase as SB } from '../../../lib/supabaseClient';
import { getBallTicketReadinessIssues, isBallLabelEligible } from '../../../lib/ballLabelEligibility';
import {invokeError} from '../../../lib/supabaseFnError';
import {readBallLiveSnapshot} from '../../../lib/ballLiveSnapshot';
import { AVERY_5160, printBallEnvelopeLabels } from '../../../lib/ballLabelPrint';
import { P, mono, oswald, inter, radius } from '../theme';

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
const LAST_INDEX_KEY = 'ballLabelLastIndex';
const female = value => ['f', 'female'].includes(String(value || '').trim().toLowerCase());
const male = value => ['m', 'male'].includes(String(value || '').trim().toLowerCase());
function initialLabelIndex() {
  try { const value = Number(localStorage.getItem(LAST_INDEX_KEY)); return Number.isInteger(value) && value >= 0 && value < AVERY_5160.count ? value : 0; }
  catch { return 0; }
}

function recipientFor(host, guest, rosterById) {
  if (guest && guest.guest_type !== 'friend' && female(host.cadet_gender)) {
    const roster = rosterById.get(guest.sdhs_matched_cadet_id);
    const guestGender = roster?.gender || guest.gender;
    if (male(guestGender)) return {
      type: 'guest', id: guest.id, name: guest.name,
      company: roster?.company || host.cadet_company || 'Unassigned',
      letLevel: roster?.let_level || '',
    };
  }
  // Friends' separate ticket goes to the host, regardless of either person's gender.
  return { type: 'host', id: host.id, name: host.cadet_name,
    company: host.cadet_company || 'Unassigned', letLevel: host.cadet_let_level || '' };
}

export default function BallTicketReadinessWidget() {
  const generation=useRef(0);
  const [refreshing,setRefreshing]=useState(false);
  const [checkedAt,setCheckedAt]=useState('');
  const [signups, setSignups] = useState(null);
  const [guests, setGuests] = useState([]);
  const [roster, setRoster] = useState([]);
  const [distribution, setDistribution] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [company, setCompany] = useState('all');
  const [labelIndex, setLabelIndex] = useState(initialLabelIndex);
  const [showNotReady, setShowNotReady] = useState(false);

  const load = useCallback(async () => {
    const sequence=++generation.current;
    setRefreshing(true);
    try {
      const snapshot=await readBallLiveSnapshot();
      if(sequence!==generation.current)return;
      setSignups(snapshot.hosts);setGuests(snapshot.guests);setRoster(snapshot.roster);setDistribution(snapshot.deliveries);setCheckedAt(snapshot.checked_at);setError('');
    } catch (e) {
      if(sequence!==generation.current)return;
      setSignups(previous=>previous||[]);
      setError(`Live refresh failed. Printing and delivery are paused: ${e?.message||'Please retry.'}`);
    }finally{if(sequence===generation.current)setRefreshing(false);}
  }, []);

  useEffect(() => {
    load();
    const timer=setInterval(load,15000);
    const focus=()=>load();
    const visible=()=>{if(document.visibilityState==='visible')load();};
    window.addEventListener('focus',focus);document.addEventListener('visibilitychange',visible);
    const channel = SB.channel('overview-ball-ticket-delivery')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ball_signups' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ball_guests' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ball_ticket_deliveries' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cadet_consent' }, load)
      .subscribe();
    const invalidatePending=()=>{generation.current++;};
    return () => {invalidatePending();clearInterval(timer);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',visible);SB.removeChannel(channel);};
  }, [load]);

  const records = useMemo(() => {
    if (!signups) return [];
    const guestsBySignup = new Map(guests.map(g => [g.signup_id, g]));
    const rosterById = new Map(roster.map(c => [c.id, c]));
    const deliveries = new Map(distribution.map(row => [row.signup_id, row]));
    return signups.flatMap(host => {
      const guest = guestsBySignup.get(host.id) || null;
      if (!isBallLabelEligible(host, guest)) return [];
      const recipient = recipientFor(host, guest, rosterById);
      return [{ key: host.id, host, guest, ...recipient, displayNames: guest ? `${host.cadet_name} + ${guest.name}` : host.cadet_name, distribution: deliveries.get(host.id) || null }];
    }).sort((a, b) => collator.compare(a.company, b.company) || collator.compare(a.name, b.name));
  }, [signups, guests, roster, distribution]);

  // Keep delivered rows visible if a reservation later becomes incomplete or
  // its ticket recipient changes. Otherwise the checkbox disappears and staff
  // cannot use the revoke action even though the database permits it.
  const staleDelivered = useMemo(() => {
    if (!signups) return [];
    const hostsById = new Map(signups.map(host => [host.id, host]));
    const guestsBySignup = new Map(guests.map(g => [g.signup_id, g]));
    return distribution.flatMap(delivery => {
      if (!delivery.distributed) return [];
      const host = hostsById.get(delivery.signup_id);
      if (!host) return [];
      const guest = guestsBySignup.get(host.id) || null;
      const issues = getBallTicketReadinessIssues(host, guest);
      if (!issues.length) return [];
      return [{
        key: host.id, host, guest,
        name: delivery.recipient_name || host.cadet_name,
        company: delivery.recipient_company || host.cadet_company || 'Unassigned',
        displayNames: guest ? `${host.cadet_name} + ${guest.name}` : host.cadet_name,
        distribution: delivery, issues,
      }];
    }).sort((a, b) => collator.compare(a.company, b.company) || collator.compare(a.displayNames, b.displayNames));
  }, [signups, guests, distribution]);

  const companies = useMemo(() => [...new Set([...records, ...staleDelivered].map(r => r.company))].sort(collator.compare), [records, staleDelivered]);
  const visible = company === 'all' ? records : records.filter(r => r.company === company);
  const staleVisible = company === 'all' ? staleDelivered : staleDelivered.filter(r => r.company === company);
  const deliveredCount = visible.filter(r => r.distribution?.distributed).length;
  const blockedRecords = useMemo(() => {
    if (!signups) return [];
    const guestsBySignup = new Map(guests.map(g => [g.signup_id, g]));
    const rosterById = new Map(roster.map(c => [c.id, c]));
    return signups.flatMap(host => {
      const guest = guestsBySignup.get(host.id) || null;
      const issues = getBallTicketReadinessIssues(host, guest);
      if (!issues.length) return [];
      const recipient = recipientFor(host, guest, rosterById);
      return [{ key: host.id, company: recipient.company, names: guest ? `${host.cadet_name} + ${guest.name}` : host.cadet_name, issues }];
    }).sort((a, b) => collator.compare(a.company, b.company) || collator.compare(a.names, b.names));
  }, [signups, guests, roster]);
  const blockedVisible = company === 'all' ? blockedRecords : blockedRecords.filter(r => r.company === company);

  async function markDistributed(record, checked) {
    if (busy || refreshing || error) return;
    setBusy(record.key); setError('');
    try {
      // Revoking a past delivery must remain possible even if this
      // reservation has since become incomplete or its recipient changed.
      // The database trigger permits the false state and clears its metadata.
      if (!checked) {
        const { data, error: revokeError } = await SB.from('ball_ticket_deliveries')
          .update({ distributed: false, distributed_at: null, distributed_by: null })
          .eq('signup_id', record.host.id)
          .eq('distributed', true)
          .select('signup_id')
          .maybeSingle();
        if (revokeError) throw revokeError;
        if (!data) throw new Error('This delivery is no longer marked delivered. Refresh the list.');
        await load();
        return;
      }
      const snapshot=await readBallLiveSnapshot();
      const liveHost=snapshot.hosts.find(row=>row.id===record.host.id);
      const liveGuest=snapshot.guests.find(row=>row.signup_id===record.host.id)||null;
      if (!liveHost || !isBallLabelEligible(liveHost, liveGuest)) {
        throw new Error(`${record.displayNames} no longer meets every ticket requirement. Refresh and review the reservation.`);
      }
      if (record.type === 'guest' && liveGuest?.id !== record.id) {
        throw new Error('This reservation changed. Refresh the page before recording ticket delivery.');
      }
      const recipient = recipientFor(liveHost, liveGuest, new Map(snapshot.roster.map(row=>[row.id,row])));
      if (recipient.type !== record.type || recipient.id !== record.id) {
        throw new Error('The ticket recipient changed. Refresh the list before recording delivery.');
      }
      const { data: authData, error: authError } = await SB.auth.getUser();
      if (authError) throw authError;
      const patch = {
        signup_id: record.host.id,
        recipient_type: recipient.type,
        recipient_guest_id: recipient.type === 'guest' ? recipient.id : null,
        distributed: true,
        distributed_at: new Date().toISOString(),
        distributed_by: authData.user?.email || 'S-6',
      };
      const { error: saveError } = await SB.from('ball_ticket_deliveries').upsert(patch, { onConflict: 'signup_id' });
      if (saveError) throw saveError;
      await load();
    } catch (e) {
      setError(e?.message || 'Could not update ticket delivery.');
    } finally { setBusy(''); }
  }

  async function printReceipts(){
    if(busy||refreshing||error)return;
    const win=window.open('','_blank');
    if(!win){setError('Allow popups to print current receipts.');return;}
    setBusy('receipts');setError('');
    try{
      const {data,error:problem}=await SB.functions.invoke('ball-receipts',{body:{filters:company==='all'?{}:{company}}});
      if(problem||data?.error)throw new Error(await invokeError(data,problem,'Could not read current receipts. Nothing was printed.'));
      const artifact=data.artifact;
      if((await readBallLiveSnapshot()).version!==artifact.ball_snapshot_version)throw new Error('Records changed while generating receipts. Retry to get a current packet. Nothing was printed.');
      const bytes=Uint8Array.from(atob(artifact.base64),c=>c.charCodeAt(0));
      const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
      win.location.href=url;setTimeout(()=>URL.revokeObjectURL(url),120000);
    }catch(e){win.close();setError(e.message||'Could not verify receipts. Nothing was printed.');}
    finally{setBusy('');}
  }

  async function printLabels(undeliveredOnly) {
    const reservations = visible.filter(row => !undeliveredOnly || !row.distribution?.distributed);
    if (!reservations.length || busy || refreshing || error) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) { setError('Allow popups to print Ball labels.'); return; }
    setBusy('printing'); setError('');
    try {
      const snapshot=await readBallLiveSnapshot();
      const hosts=new Map(snapshot.hosts.map(row=>[row.id,row]));
      const guestsBySignup=new Map(snapshot.guests.map(row=>[row.signup_id,row]));
      const rosterById=new Map(snapshot.roster.map(row=>[row.id,row]));
      const delivered=new Set(snapshot.deliveries.filter(row=>row.distributed).map(row=>row.signup_id));
      const live=reservations.filter(row=>!undeliveredOnly||!delivered.has(row.host.id));
      if(!live.length)throw new Error('These tickets have already been delivered. No labels were printed.');
      if(live.some(row=>!hosts.has(row.host.id)||!isBallLabelEligible(hosts.get(row.host.id),guestsBySignup.get(row.host.id))))throw new Error('A selected reservation changed. Refresh and review its current requirements. No labels were printed.');
      const labels=live.map(row=>{
        const host=hosts.get(row.host.id),guest=guestsBySignup.get(row.host.id)||null;
        const recipient=recipientFor(host,guest,rosterById);
        return {cadetName:recipient.name,letLevel:recipient.letLevel,company:recipient.company==='Unassigned'?'':recipient.company,guestName:recipient.type==='guest'?host.cadet_name:guest?.name||''};
      });
      const check=await readBallLiveSnapshot();
      if(check.version!==snapshot.version)throw new Error('Ball records changed while preparing these labels. Retry for current labels. Nothing was printed.');
      if (!printBallEnvelopeLabels(labels, labelIndex, printWindow)) { printWindow.close(); return; }
      const nextIndex = (labelIndex + labels.length) % AVERY_5160.count;
      setLabelIndex(nextIndex);
      try { localStorage.setItem(LAST_INDEX_KEY, String(nextIndex)); } catch { /* optional print preference */ }
    } catch (e) {
      printWindow.close();
      setError(e?.message || 'Could not verify ticket readiness. No labels were printed.');
      await load();
    } finally { setBusy(''); }
  }

  if (signups === null) return <section style={cardStyle}><div style={eyebrow}>MILITARY BALL · TICKET DELIVERY</div><p style={muted}>Loading all reservations…</p></section>;

  return (
    <section style={cardStyle} aria-labelledby="ticket-delivery-title">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div style={eyebrow}>MILITARY BALL</div>
          <h1 id="ticket-delivery-title" style={{ fontFamily: oswald, fontWeight: 500, color: P.cream, fontSize: 29, margin: '4px 0 5px' }}>Ticket delivery</h1>
          <div style={muted}>One row per completed reservation. Each checkbox records delivery of that reservation’s tickets.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select aria-label="Filter by company" value={company} onChange={e => setCompany(e.target.value)} style={selectStyle}>
            <option value="all">All companies</option>
            {companies.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button type="button" onClick={load} disabled={refreshing} style={buttonStyle}>{refreshing?'Checking…':'Refresh'}</button>
          <button type="button" onClick={printReceipts} disabled={refreshing||!!error||!!busy} style={buttonStyle}>{busy==='receipts'?'Generating current receipts…':'Print current receipts'}</button>
          <button type="button" onClick={() => printLabels(true)} disabled={refreshing||!!error||!visible.some(r => !r.distribution?.distributed)} style={goldButtonStyle}>Print undelivered labels</button>
          <button type="button" onClick={() => printLabels(false)} disabled={refreshing||!!error||!visible.length} style={buttonStyle}>Print ready labels</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', margin: '16px 0 4px', fontFamily: mono, fontSize: 11, color: P.mute }}>
        <span><b style={{ color: P.bright }}>{visible.length}</b> eligible reservations</span>
        <span><b style={{ color: P.green }}>{deliveredCount}</b> delivered</span>
        <span><b style={{ color: P.gold }}>{visible.length - deliveredCount}</b> remaining</span>
      </div>
      <div style={{ ...muted, marginBottom: 10 }}>Printing labels never marks tickets delivered. Use the checkbox after handing tickets to the pickup person; revoke a delivery if that record needs to be cleared.</div>
      <p style={muted}>Checks live records every 15 seconds · Last verified {checkedAt?new Date(checkedAt).toLocaleTimeString():'not yet'}</p>
      {error && <div role="alert" style={{ color: '#ff9b8f', fontFamily: mono, fontSize: 11, margin: '10px 0' }}>{error}</div>}
      <div style={{ margin: '12px 0', borderTop: '1px solid rgba(255,255,255,0.08)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <button type="button" aria-expanded={showNotReady} onClick={() => setShowNotReady(value => !value)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '11px 4px', border: 0, background: 'transparent', color: P.cream, textAlign: 'left', cursor: 'pointer' }}>
          <span aria-hidden="true" style={{ color: blockedVisible.length ? P.gold : P.green }}>{showNotReady ? '⌄' : '›'}</span>
          <span style={{ flex: 1, fontFamily: inter, fontSize: 12 }}>Not ready for ticket delivery</span>
          <span style={{ fontFamily: mono, fontSize: 10, color: blockedVisible.length ? P.gold : P.green }}>{blockedVisible.length}</span>
        </button>
        {showNotReady && (blockedVisible.length === 0 ? (
          <div style={{ ...muted, padding: '2px 8px 12px' }}>No blocked reservations in this view.</div>
        ) : (
          <div style={{ maxHeight: 320, overflow: 'auto', padding: '0 6px 8px' }}>
            {blockedVisible.map(record => (
              <div key={record.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 0.8fr) minmax(220px, 1.2fr)', gap: '4px 16px', padding: '9px 6px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: inter, fontSize: 12, color: P.cream }}>{record.names}</div>
                  <div style={{ fontFamily: mono, fontSize: 9, color: P.faint, marginTop: 3 }}>{record.company}</div>
                </div>
                <div style={{ fontFamily: inter, fontSize: 11, lineHeight: 1.55, color: P.mute }}>{record.issues.join(' · ')}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
      {visible.length === 0 ? (
        <div style={{ ...muted, padding: '18px 0 4px' }}>{records.length ? 'No ready reservations in this company.' : 'No fully completed reservations yet. Required payment, forms, verification, and dress approval must all be complete.'}</div>
      ) : (
        <div style={{ marginTop: 8, maxHeight: 520, overflow: 'auto', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          {companies.filter(c => company === 'all' || c === company).map(c => (
            <div key={c}>
              <div style={{ position: 'sticky', top: 0, zIndex: 1, padding: '9px 8px', background: '#101f35', color: P.gold, fontFamily: mono, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase' }}>{c}</div>
              {visible.filter(row => row.company === c).map(record => {
                const delivered = !!record.distribution?.distributed;
                return <div key={record.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 8px', borderBottom: '1px solid rgba(255,255,255,0.055)', opacity: busy && busy !== record.key && busy !== 'printing' ? .65 : 1 }}>
                  <input type="checkbox" checked={delivered} disabled={!!busy || refreshing || !!error || delivered} onChange={e => markDistributed(record, e.target.checked)} style={{ width: 20, height: 20, accentColor: P.green, flex: '0 0 auto' }} aria-label={`Mark tickets delivered for ${record.displayNames}`} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                      <b style={{ color: delivered ? P.green : P.cream, fontFamily: inter, fontSize: 13 }}>{record.displayNames}</b>
                      {record.letLevel && <span style={{ color: P.mute, fontFamily: mono, fontSize: 9 }}>LET {record.letLevel}</span>}
                    </span>
                    <span style={{ display: 'block', color: P.faint, fontFamily: inter, fontSize: 10, marginTop: 3 }}>Ticket pickup: <b style={{ color: P.mute, fontWeight: 500 }}>{delivered ? record.distribution?.recipient_name || record.name : record.name}</b></span>
                    {delivered && <span style={{ display: 'block', color: P.faint, fontFamily: mono, fontSize: 9, marginTop: 3 }}>Delivered{record.distribution?.distributed_at ? ` · ${new Date(record.distribution.distributed_at).toLocaleDateString()}` : ''}</span>}
                  </span>
                  <span style={{ ...statusPill(delivered), flex: '0 0 auto' }}>{delivered ? 'DELIVERED' : 'READY'}</span>
                  {delivered && <button type="button" disabled={!!busy||refreshing||!!error} onClick={() => { if (window.confirm(`Revoke the delivered status for ${record.displayNames}?`)) markDistributed(record, false); }} style={{ ...buttonStyle, padding: '6px 8px', color: P.mute, opacity: busy ? 0.55 : 1, cursor: busy ? 'wait' : 'pointer' }}>Revoke</button>}
                </div>;
              })}
            </div>
          ))}
        </div>
      )}
      {staleVisible.length > 0 && (
        <div style={{ marginTop: 18, borderTop: '1px solid rgba(255,190,95,0.28)', paddingTop: 12 }}>
          <div style={{ fontFamily: mono, fontSize: 10, color: P.gold, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>Delivered tickets · reservation now needs review ({staleVisible.length})</div>
          <div style={{ ...muted, marginBottom: 8 }}>These tickets were previously marked delivered, but the reservation no longer meets the current requirements. Revoke the delivery record if the tickets need to be reissued.</div>
          {staleVisible.map(record => (
            <div key={record.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', borderTop: '1px solid rgba(255,255,255,0.055)' }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <b style={{ color: P.cream, fontFamily: inter, fontSize: 12 }}>{record.displayNames}</b>
                <span style={{ display: 'block', color: P.faint, fontFamily: inter, fontSize: 10, marginTop: 3 }}>Previously delivered to {record.name} · {record.company}</span>
                <span style={{ display: 'block', color: P.gold, fontFamily: inter, fontSize: 10, marginTop: 3 }}>{record.issues.join(' · ')}</span>
              </span>
              <button type="button" disabled={!!busy||refreshing||!!error} onClick={() => { if (window.confirm(`Revoke the delivered status for ${record.displayNames}?`)) markDistributed(record, false); }} style={{ ...buttonStyle, padding: '6px 8px', color: P.mute, opacity: busy ? 0.55 : 1, cursor: busy ? 'wait' : 'pointer' }}>Revoke</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const cardStyle = { borderRadius: radius.lg, background: P.deep, border: `1px solid ${P.hair}`, padding: '20px 22px' };
const eyebrow = { fontFamily: mono, fontSize: 9, color: P.gold, letterSpacing: '0.2em' };
const muted = { fontFamily: inter, fontSize: 11, color: P.mute, lineHeight: 1.6 };
const buttonStyle = { border: '1px solid rgba(255,255,255,.12)', background: 'rgba(5,12,22,.5)', borderRadius: radius.sm, padding: '8px 11px', color: P.cream, font: `11px ${mono}`, cursor: 'pointer' };
const goldButtonStyle = { ...buttonStyle, color: '#101722', border: 'none', background: `linear-gradient(180deg,${P.bright},${P.gold})`, fontWeight: 700 };
const selectStyle = { ...buttonStyle, cursor: 'pointer' };
const statusPill = delivered => ({ fontFamily: mono, fontSize: 8, letterSpacing: '.1em', padding: '4px 7px', borderRadius: 999, color: delivered ? P.green : P.gold, border: `1px solid ${delivered ? P.green : P.gold}`, whiteSpace: 'nowrap' });
