import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { pinErrorText } from '../boardApi';
import { Modal, PinPad } from '../ui';
import MeetingGuide from './MeetingGuide';
import { downloadCsv } from '../results/csv';
import LeaderLogin from './LeaderLogin';
import SharedCadetBoard from './SharedCadetBoard';
import { sharedDraftKey } from './sharedFields';
import { meetingApi, identityApi } from './meetingApi';
import { requiresPinSetup } from './identityState';
import { createRefreshQueue } from './refreshQueue';
import { clearDraft, draftKey, readDraft } from './draftRecovery';
import { CATEGORIES } from '../../../lib/boardRules';
import '../boards.css';
import './meeting.css';
const COMPANIES=['alpha','bravo','charlie','delta'];
const ROLE={co:'Commander',xo:'Executive officer','1sg':'First sergeant'};
const EMPTY={sessions:[],rounds:[],sheets:[],signatures:[],presence:[]};
function SignatureSeats({session,signatures,presence=[]}) {
  return <div>{['co','xo','1sg'].map((seat) => {
    const holder=session?.required_signers.find((m) => m.seat===seat);
    const sig=signatures.find((s) => s.session_id===session?.id&&s.seat===seat);
    const online=presence.some((p) => p.email===holder?.email && Date.now()-new Date(p.last_seen).getTime()<45000);
    return <div className="bm-seat" key={seat}><div><b>{holder?.name??ROLE[seat]}</b><small>{ROLE[seat]}</small></div><span className={`bm-seat-state${sig||online?' ready':''}`}>{sig?'✓ Signed':online?'Online':'Waiting'}</span></div>;
  })}</div>;
}
function ReviewTable({sheets,onDetail}) {
  return <div className="bm-table-scroll"><table className="bm-review-table"><thead><tr><th>Cadet</th><th>LET / Rank</th><th>Score</th><th>Decision</th><th>Record</th></tr></thead><tbody>{sheets.map((s) => <tr key={s.id}><td><button type="button" className="bm-text-button" style={{margin:0,padding:0}} onClick={() => onDetail(s)}>{s.cadet_name}</button></td><td>{s.let_level??'—'} · {s.rank_before}</td><td>{s.decision==='absent'?'Absent':`${s.total} / 20`}</td><td>{s.decision==='promote'?`Promote → ${s.promote_to}`:s.decision==='no_promote'?'Do not promote':s.decision==='absent'?'Absent':'Unfinished draft'}</td><td>{s.simulated?'Simulated example':s.status==='draft'?'Practice draft':'Practice evaluation'}</td></tr>)}</tbody></table></div>;
}
export default function MeetingApp({ api = meetingApi, identity = identityApi, authClient = supabase.auth, realtime = supabase, questionLoader } = {}) {
  const companyPractice=window.location.pathname.replace(/\/$/,'').endsWith('/practice');
  const [auth,setAuth]=useState('checking');
  const [me,setMe]=useState(null);
  const [data,setData]=useState(EMPTY);
  const [directory,setDirectory]=useState([]);
  const [connectionError,setConnectionError]=useState('');
  const [now,setNow]=useState(Date.now());
  const [editorActivity,setEditorActivity]=useState({dirty:false,busy:false});
  const [leaveAction,setLeaveAction]=useState(null);
  const [notice,setNotice]=useState('');
  const [unlockMember,setUnlockMember]=useState(null);
  const [cancelRound,setCancelRound]=useState(null);
  const [cancelReason,setCancelReason]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [loaded,setLoaded]=useState(false);
  const [freshAt,setFreshAt]=useState(null);
  const [editing,setEditing]=useState(null);
  const [tab,setTab]=useState('roster');
  const [search,setSearch]=useState('');
  const [detail,setDetail]=useState(null);
  const [signOpen,setSignOpen]=useState(false);
  const [reviewed,setReviewed]=useState(false);
  const [signError,setSignError]=useState('');
  const [pinReset,setPinReset]=useState(0);
  const [endConfirm,setEndConfirm]=useState(null);
  const [copied,setCopied]=useState(false);
  const [guide,setGuide]=useState(false);
  const refreshQueue=useRef(null);
  const actionLock=useRef(false);
  const authEpoch=useRef(0);
  const init=useCallback(async()=>{
    const epoch=++authEpoch.current;
    try {
      const timedSession=Promise.race([authClient.getSession(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Sign-in connection timed out. Please retry.')),15000))]);
      const {data:{session}}=await timedSession;
      if(epoch!==authEpoch.current)return;
      if(!session){setAuth('login');return;}
      const [rows,names]=await Promise.all([identity.whoami(),identity.directory()]);
      if(epoch!==authEpoch.current)return;
      if(!rows.length){setMe(null);setData(EMPTY);setAuth('denied');return;}
      setMe(rows[0]);setAuth(requiresPinSetup(rows[0],names)?'login':'ready');setConnectionError('');
    }catch(e){if(epoch===authEpoch.current){setError(e.message);setAuth('error');}}
  },[authClient,identity]);
  if(!refreshQueue.current)refreshQueue.current=createRefreshQueue(api.load,(next)=>{
    if(!next.identity?.length){authEpoch.current+=1;setMe(null);setData(EMPTY);setAuth('denied');return;}
    if(requiresPinSetup(next.identity[0],next.directory??[])){authEpoch.current+=1;setMe(null);setData(EMPTY);setAuth('login');return;}
    setMe((current)=>JSON.stringify(current)===JSON.stringify(next.identity[0])?current:next.identity[0]);
    setDirectory(next.directory??[]);setData(next);setConnectionError('');setLoaded(true);setFreshAt(Date.now());
  },(e)=>setConnectionError(e.message),()=>authEpoch.current);
  const load=useCallback((force=false)=>refreshQueue.current.refresh(force===true),[]);
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{init();const {data:{subscription}}=authClient.onAuthStateChange((event)=>{if(event==='SIGNED_OUT'){authEpoch.current+=1;setLoaded(false);setFreshAt(null);setEditing(null);setMe(null);setAuth('login');setData(EMPTY);refreshQueue.current.abort();}else if(event==='SIGNED_IN'||event==='TOKEN_REFRESHED'){setTimeout(init,0);}});return()=>subscription.unsubscribe();},[init,authClient]);
  useEffect(()=>{
    if(auth!=='ready')return undefined;
    let cancelled=false; let pending;
    const refresh=()=>{clearTimeout(pending);pending=setTimeout(()=>{if(!cancelled)load();},150);};
    load(true);
    const heartbeat=()=>api.heartbeat().catch(()=>{});
    heartbeat();const beat=setInterval(heartbeat,20000);const poll=setInterval(load,3000);
    const channel=realtime.channel(`board-meeting-${me.email}`);
    ['board_practice_rounds','board_practice_sessions','board_practice_sheets','board_practice_signatures','board_practice_presence'].forEach((table)=>channel.on('postgres_changes',{event:'*',schema:'public',table},refresh));
    channel.subscribe();
    const onReturn=()=>{if(document.visibilityState==='visible'){load();heartbeat();}};
    document.addEventListener('visibilitychange',onReturn);window.addEventListener('online',refresh);
    return()=>{cancelled=true;clearTimeout(pending);clearInterval(beat);clearInterval(poll);realtime.removeChannel(channel);refreshQueue.current.abort();document.removeEventListener('visibilitychange',onReturn);window.removeEventListener('online',refresh);};
  },[auth,me?.email,load,api,realtime]);
  const host=!!me?.is_s6||me?.board_role==='sai';
  const overview=host||me?.board_role==='viewer';
  const session=data.sessions.find((s)=>s.company===me?.company)??null;
  const round=data.rounds.find((r)=>r.id===session?.round_id);
  const activeCadet=session?.roster.find((c)=>c.id===session.active_cadet_id)??null;
  const activeRound=data.rounds.filter((r)=>r.host_controlled).sort((a,b)=>b.started_at.localeCompare(a.started_at))[0]??null;
  const activeSessions=data.sessions.filter((s)=>s.round_id===activeRound?.id);
  const pendingCompanyRounds=data.rounds.filter((r)=>!r.host_controlled&&['running','review'].includes(r.status));
  const seatsReady=COMPANIES.every((company)=>['co','xo','1sg'].every((role)=>directory.some((m)=>m.company===company&&m.board_role===role)));
  const savedSheets=data.sheets.filter((s)=>s.session_id===session?.id).sort((a,b)=>a.cadet_name.localeCompare(b.cadet_name));
  const companySheets=session?.status!=='running'&&session?.review_snapshot?session.review_snapshot:savedSheets;
  const cancelled=round?.status==='cancelled'||session?.status==='cancelled';
  const ownSignature=data.signatures.find((s)=>s.session_id===session?.id&&s.signed_by===me?.email);
  const syncHealthy=!!freshAt&&!connectionError&&now-freshAt<12000;
  useEffect(()=>{
    setEditing(null);setEditorActivity({dirty:false,busy:false});setReviewed(false);setSignOpen(false);setDetail(null);setLeaveAction(null);setEndConfirm(null);setError('');setNotice('');setSearch('');
    setTab(session?.status==='running'?'roster':'review');
  },[me?.email,me?.board_role,me?.company,session?.id,session?.status]);
  useEffect(()=>{
    if(session?.status&&session.status!=='running'){
      if(editorActivity.dirty)setNotice('The presenter ended this session before your open sheet was saved. Your unfinished changes were not added to the review list.');
      setEditing(null);setEditorActivity({dirty:false,busy:false});setTab('review');setReviewed(false);setSignOpen(false);setDetail(null);
    }
  },[session?.id,session?.status,editorActivity.dirty]);
  useEffect(()=>{setGuide(false);setDetail(null);setEditing(null);setEditorActivity({dirty:false,busy:false});setLeaveAction(null);setError('');},[session?.active_cadet_revision,session?.id,me?.email]);
  async function action(fn){if(actionLock.current)return;actionLock.current=true;setBusy(true);setError('');try{await fn();await load(true);}catch(e){setError(e.message);await load(true);}finally{actionLock.current=false;setBusy(false);}}
  async function sign(pin){if(actionLock.current)return;actionLock.current=true;setBusy(true);setSignError('');try{await api.sign(session.id,pin);setSignOpen(false);await load(true);}catch(e){setSignError(pinErrorText(e));setPinReset((r)=>r+1);await load(true);}finally{actionLock.current=false;setBusy(false);}}
  async function signOut(){authEpoch.current+=1;setLoaded(false);setFreshAt(null);setEditing(null);refreshQueue.current.abort();await authClient.signOut();setMe(null);setData(EMPTY);setAuth('login');}
  function navigate(kind){setEditing(null);setEditorActivity({dirty:false,busy:false});if(kind==='guide')setGuide((v)=>!v);if(kind==='signout')signOut();}
  function requestNavigation(kind){if(editorActivity.busy)return;if(editorActivity.dirty){setLeaveAction(kind);return;}navigate(kind);}
  function leaveWithoutSaving(){try{if(activeCadet&&session)clearDraft(sessionStorage,sharedDraftKey(me.email,session.id,activeCadet.id,session.active_cadet_revision));if(editing&&session)clearDraft(sessionStorage,draftKey(me.email,session.id,editing.id));}catch{}const kind=leaveAction;setLeaveAction(null);navigate(kind);}
  function recoveryFor(cadetId){try{return readDraft(sessionStorage,draftKey(me.email,session.id,cadetId));}catch{return null;}}
  if(auth==='checking')return <main className="tb bm-empty"><span className="tb-spin"/><p>Preparing company boards…</p></main>;
  if(auth==='login')return <LeaderLogin identity={identity} authClient={authClient} onSignedIn={init}/>;
  if(auth!=='ready')return <main className="tb bm-empty"><h2>{auth==='denied'?'Board access is not assigned':'Could not connect'}</h2><p>{auth==='denied'?'Choose your company leadership name, or use the S-6 presenter account.':error}</p>{auth==='error'&&<button className="tb-btn tb-btn--gold" onClick={()=>{setAuth('checking');init();}}>Retry connection</button>}<button className="tb-btn" onClick={signOut}>Choose another account</button></main>;
  return <main className="tb bm">
    <header className="bm-header"><a href="/boards/meeting" className="bm-brand"><img src="/assets/trojan-helmet.png" width="40" height="40" alt=""/><span>Trojan Battalion<br/><b>Company boards</b></span></a><div className="bm-header-actions"><span className="bm-badge">Shared practice · No real promotions</span><span className="bm-small">{me.display_name}<br/>{host?'Presenter':me.company?`${me.company} · ${ROLE[me.board_role]??'Viewer'}`:'Results viewer'}</span><button type="button" className="tb-btn tb-btn--sm" disabled={busy||editorActivity.busy} onClick={()=>requestNavigation('guide')}>{guide?'Back to practice':'Leadership guide'}</button><button type="button" className="tb-btn tb-btn--ghost tb-btn--sm" disabled={busy||editorActivity.busy} onClick={()=>requestNavigation('signout')}>Sign out</button></div></header>
    {guide?<MeetingGuide/>:<div className="bm-shell">
      <div className="bm-status" role="status"><span className={`bm-dot${syncHealthy?'':' stale'}`}/>{syncHealthy?'Connected · Changes are shared across computers':freshAt?'Reconnecting · Keep this page open':'Connecting to your company…'}{freshAt&&<span> · Last updated {new Date(freshAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit',second:'2-digit'})}</span>}</div>
      {connectionError&&<div role="alert" className="tb-banner tb-banner--error" style={{marginTop:20}}>{connectionError}<button type="button" className="bm-text-button" onClick={()=>load(true)}>Retry connection</button></div>}
      {notice&&<div role="status" className="bm-callout">{notice}</div>}
      {error&&<div role="alert" className="tb-banner tb-banner--error" style={{marginTop:20}}>{error}<button type="button" className="bm-text-button" style={{margin:0,paddingLeft:12}} onClick={()=>setError('')}>Dismiss</button></div>}
      {overview?<>
        <div className="bm-hero"><div><div className="tb-eyebrow">{host?'Presenter control':'Read-only workshop overview'}</div><h1>{host?<>Your meeting.<br/>Your command.</>:'Workshop overview.'}</h1><p className="bm-muted">Everyone signs in on their own computer. Start practice when you’re ready, then end it to send each company its review list and signature request.</p></div><div className="bm-session-controls"><button type="button" className="tb-btn" onClick={async()=>{try{await navigator.clipboard.writeText(`${window.location.origin}/boards/meeting`);setCopied(true);}catch{setError(`Share this link: ${window.location.origin}/boards/meeting`);}}}>{copied?'Leader link copied ✓':'Copy leader link'}</button>{!host?<span className="bm-badge">Read-only overview</span>:(!activeRound||['complete','cancelled'].includes(activeRound.status))?<button type="button" className="tb-btn tb-btn--gold tb-btn--lg" disabled={busy||!syncHealthy||!host||!seatsReady||pendingCompanyRounds.length>0} onClick={()=>action(()=>api.start('Company leadership workshop'))}>{busy?'Starting…':activeRound?'Start another practice session':'Start meeting practice →'}</button>:activeRound.status==='running'?<button type="button" className="tb-btn tb-btn--gold tb-btn--lg" disabled={busy||!syncHealthy||!host} onClick={()=>setEndConfirm({roundId:activeRound.id})}>End practice & request signatures</button>:<span className="bm-badge">Waiting for company signatures</span>}</div></div>
        {host&&!seatsReady&&loaded&&<div role="alert" className="bm-callout">Assign all three leadership seats for each company in DISPATCH before starting the workshop.</div>}
        {host&&pendingCompanyRounds.length>0&&<div className="bm-callout"><h2>Company rehearsal is still open</h2><p>Cancel the separate rehearsal rounds below before starting a shared workshop. Their records will be retained.</p>{pendingCompanyRounds.map((r)=><div className="bm-seat" key={r.id}><span>{data.sessions.filter((s)=>s.round_id===r.id).map((s)=>s.company).join(', ')} · {r.title}</span><button type="button" className="tb-btn tb-btn--sm" disabled={busy} onClick={()=>{setCancelReason('');setCancelRound(r.id);}}>Cancel company rehearsal</button></div>)}</div>}
        {activeRound&&<div className="bm-callout"><h2>{activeRound.status==='running'?'Practice is open':activeRound.status==='review'?'Review & signoff in progress':activeRound.status==='cancelled'?'Practice round cancelled':'All companies signed'}</h2><p>{activeRound.status==='cancelled'?`Cancelled: ${activeRound.cancellation_reason}. Existing records and signatures were retained. You can start a fresh round.`:activeRound.status==='running'?'Leaders can now board cadets together. You decide when practice ends.':activeRound.status==='review'?'All screens have been asked to review and sign. The next session opens once all signatures are complete.':'The workshop round is complete. Practice results remain available to their companies.'}</p>{host&&['running','review'].includes(activeRound.status)&&<button type="button" className="bm-text-button" disabled={busy} onClick={()=>{setCancelReason('');setCancelRound(activeRound.id);}}>Cancel this practice round and allow a restart</button>}</div>}
        <div className="bm-metrics"><div className="bm-metric"><b>{data.presence.filter((p)=>p.company&&Date.now()-new Date(p.last_seen).getTime()<45000).length} / 12</b><span>Leaders online</span></div><div className="bm-metric"><b>{directory.filter((m)=>!m.needs_setup).length} / 12</b><span>PIN setup complete</span></div><div className="bm-metric"><b>{data.signatures.filter((sig)=>activeSessions.some((s)=>s.id===sig.session_id)).length} / 12</b><span>Signatures received</span></div><div className="bm-metric"><b>{activeSessions.filter((s)=>s.status==='signed').length} / 4</b><span>Companies signed</span></div></div>
        {host&&<details className="bm-panel" style={{marginBottom:20}}><summary>Leader setup &amp; account help</summary><p className="bm-small">{data.account_status?.filter((a)=>a.has_dob).length??0} of 12 leaders have a DOB on file. Unlocking permits another attempt; it does not change a PIN or bypass DOB verification. For a forgotten PIN, use Board accounts in <a href="/admin" target="_blank" rel="noopener noreferrer">DISPATCH</a>.</p>{data.account_status?.map((a)=><div className="bm-seat" key={a.member_id}><div><b>{a.display_name}</b><small>{a.company} · {a.has_dob?'DOB on file':'DOB missing'} · {a.has_pin?'PIN set':'Setup pending'}</small></div><button type="button" className="tb-btn tb-btn--sm" disabled={busy} onClick={()=>{setError('');setUnlockMember(a);}}>Allow another attempt</button></div>)}</details>}
        <div className="bm-columns">{COMPANIES.map((company)=>{const s=activeSessions.find((s)=>s.company===company);const members=directory.filter((m)=>m.company===company);return <section className="bm-company-card" key={company}><h2>{company} company</h2>{s?<><p className="bm-small">{s.roster.length} cadets · {data.sheets.filter((b)=>b.session_id===s.id).length} practice sheets · {s.status}</p>{s.active_cadet_id&&<p className="bm-small">On the board: <b>{s.roster.find((c)=>c.id===s.active_cadet_id)?.name}</b></p>}<SignatureSeats session={s} signatures={data.signatures} presence={data.presence}/></>:members.map((m)=>{const online=data.presence.some((p)=>p.company===company&&p.board_role===m.board_role&&Date.now()-new Date(p.last_seen).getTime()<45000);return <div className="bm-seat" key={m.member_id}><div><b>{m.display_name}</b><small>{ROLE[m.board_role]} · {m.needs_setup?'PIN not set':'PIN ready'}</small></div><div><span className={`bm-seat-state${online?' ready':''}`}>{online?'Online':'Not online yet'}</span>{host&&data.account_status?.find((a)=>a.member_id===m.member_id&&(new Date(a.pin_locked_until).getTime()>now||new Date(a.dob_locked_until).getTime()>now))&&<button type="button" className="bm-text-button" disabled={busy} onClick={()=>{setError('');setUnlockMember(m);}}>Unlock verification attempts</button>}</div></div>;})}</section>;})}</div>
      </>:!loaded?<div className="bm-empty"><span className="tb-spin"/><p>Loading your company…</p></div>:activeCadet&&session?.status==='running'?<SharedCadetBoard key={`${session.id}:${session.active_cadet_revision}`} api={api} loadQuestions={questionLoader} session={session} accountEmail={me.email} canSave={syncHealthy} onActivity={setEditorActivity} cadet={activeCadet} sheet={savedSheets.find((s)=>s.cadet_id===activeCadet.id)} onSharedChange={load}/>:<>
        <div className="bm-hero"><div><div className="tb-eyebrow">{me.company} company · {ROLE[me.board_role]}</div><h1>{cancelled?'Practice round cancelled.':session?.status==='running'?'Your company. Your board.':session?.status==='review'?'Review. Then sign.':session?.status==='signed'?'Session signed.':'Ready when you are.'}</h1><p className="bm-muted">{cancelled?`The presenter cancelled this round: ${round?.cancellation_reason??'Workshop restart'}. Your real cadet records are unchanged. Wait for the next round.`:session?.status==='running'?'Agree who will begin. When that leader clicks the arriving cadet’s name, all three screens open the same questions and shared grading sheet.':session?.status==='review'?'The session has ended. Review your company’s frozen practice results and sign for your own position.':session?.status==='signed'?'All three company leaders have signed this practice session.':'You’re signed in. Keep this page open—the presenter will start the workshop for everyone.'}</p></div>{session&&<span className="bm-badge">{new Date(session.started_at).toLocaleDateString()} · {session.status}</span>}</div>
        {!session?<div className="bm-empty"><h2>Waiting for the presenter</h2><p>Your setup is complete. You won’t need to enter your DOB again. The practice roster will appear here when the presenter starts the meeting.</p>{companyPractice&&<button type="button" className="tb-btn tb-btn--gold" disabled={busy||!syncHealthy} onClick={()=>action(()=>api.start('Company practice',me.company))}>Start company practice session</button>}</div>:<>
          {session.status==='review'&&<div className="bm-callout" role="alert"><h2>{ownSignature?'Your signature is recorded':'Your signature is required'}</h2><p>{ownSignature?'Your signature is recorded. Waiting for your company’s other leaders.':`${session.company} company’s practice session has ended. Review the list below, then sign as ${ROLE[me.board_role]}.`}</p><p className="bm-small">Simulated examples use your company’s real cadet names. They are practice results and cannot apply a promotion.</p></div>}
          {session.status==='running'&&<div className="bm-session-controls"><span className="bm-small">{session.roster.length} company cadets · {companySheets.filter((s)=>s.status==='complete').length} completed practice sheets</span>{round?.host_controlled?<span className="bm-badge">Presenter controls the end</span>:<button type="button" className="tb-btn" disabled={busy||!syncHealthy} onClick={()=>setEndConfirm({roundId:session.round_id,sessionId:session.id})}>End today’s practice & request signatures</button>}</div>}
          <div className="bm-tabs" role="tablist"><button role="tab" aria-selected={tab==='roster'} onClick={()=>setTab('roster')}>Company roster</button><button role="tab" aria-selected={tab==='review'} onClick={()=>setTab('review')}>Review & signatures</button></div>
          {tab==='roster'&&session.status==='running'?<><input className="tb-input" aria-label="Search company cadets" placeholder="Find a cadet…" value={search} onChange={(e)=>setSearch(e.target.value)} style={{marginBottom:16}}/><div className="bm-roster">{session.roster.filter((c)=>c.name.toLowerCase().includes(search.toLowerCase())).map((c)=>{const row=savedSheets.find((s)=>s.cadet_id===c.id);const recovered=recoveryFor(c.id);return <button type="button" className="bm-roster-row" key={c.id} disabled={!syncHealthy||busy} onClick={()=>row?.status==='complete'?setDetail(row):action(()=>api.openCadet(session.id,c.id,session.active_cadet_revision))}><span><b>{c.name}</b><small>LET {c.let_level??'not recorded'} · {row?.rank_before??c.cadet_rank}{c.leadership_position?' · Evaluation only':''}</small></span><span className="bm-small">{recovered?'Unsaved work on this tab →':row?row.status==='complete'?`${row.total} / 20 · Review completed board`:'Draft saved':'Begin board →'}</span></button>;})}</div></>:<section className="bm-panel bm-sign-review"><h2>Company review list</h2>{session.review_snapshot&&savedSheets.some((s)=>s.status==='draft')&&<p className="bm-small">Unfinished practice drafts are retained separately and are not included in this signed review.</p>}{companySheets.length>0&&<button type="button" className="tb-btn tb-btn--sm" onClick={()=>downloadCsv(companySheets.map((s)=>({...s,...s.scores,quarter_label:'PRACTICE — NOT AN OFFICIAL RECORD',final_decision:s.decision,final_promote_to:s.promote_to,comment:`${s.simulated?'SIMULATED EXAMPLE':'PRACTICE EVALUATION'} — ${s.comment}`})),`practice-${session.company}-${session.id.slice(0,8)}.csv`)}>Export practice list</button>}{!companySheets.length?<p className="bm-muted">No practice sheets saved yet. Choose a cadet from the roster to begin.</p>:<ReviewTable sheets={companySheets} onDetail={setDetail}/>}<SignatureSeats session={session} signatures={data.signatures} presence={data.presence}/>{session.status==='review'&&!ownSignature&&<><label className="bm-confirm"><input type="checkbox" checked={reviewed} onChange={(e)=>setReviewed(e.target.checked)}/>I have reviewed my company’s practice list. I am signing as {ROLE[me.board_role]}.</label><button type="button" className="tb-btn tb-btn--gold tb-btn--lg" disabled={!reviewed||busy||!syncHealthy} onClick={()=>{setSignOpen(true);setSignError('');}}>Sign as {ROLE[me.board_role]} →</button></>}{ownSignature&&<p className="bm-muted">✓ Your signature was recorded at {new Date(ownSignature.signed_at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}.</p>}</section>}
          {(session.status==='signed'||cancelled)&&companyPractice&&<div className="bm-session-controls"><button type="button" className="tb-btn tb-btn--gold" disabled={busy||!syncHealthy} onClick={()=>action(()=>api.start('Company practice',me.company))}>Start next company practice session</button></div>}
        </>}
      </>}
    </div>}
    {unlockMember&&<Modal label="Unlock leader verification" onClose={busy?undefined:()=>setUnlockMember(null)}><h2>Allow another attempt?</h2><p className="bm-muted">This clears DOB/PIN attempt lockouts for {unlockMember.display_name}. Their date of birth and PIN will stay unchanged.</p>{error&&<p role="alert">{error}</p>}<div className="bm-session-controls"><button type="button" className="tb-btn" disabled={busy} onClick={()=>setUnlockMember(null)}>Keep current lockout</button><button type="button" className="tb-btn tb-btn--gold" disabled={busy||!syncHealthy} onClick={()=>action(async()=>{await api.unlock(unlockMember.member_id);setUnlockMember(null);})}>Allow another attempt</button></div></Modal>}
    {leaveAction&&<Modal label="Unsaved practice changes" onClose={()=>setLeaveAction(null)}><h2>Keep your practice changes?</h2><p className="bm-muted">This sheet has unsaved changes. Keep editing to save a draft, or discard these changes before leaving.</p><div className="bm-session-controls"><button type="button" className="tb-btn tb-btn--gold" onClick={()=>setLeaveAction(null)}>Keep editing</button><button type="button" className="tb-btn" onClick={leaveWithoutSaving}>Discard changes & leave</button></div></Modal>}
    {cancelRound&&<Modal label="Cancel workshop round" onClose={busy?undefined:()=>setCancelRound(null)}><h2>Cancel this practice round?</h2>{error&&<p role="alert" className="bm-muted">{error}</p>}<p className="bm-muted">Use this if a leader is absent or you need to restart the demonstration. Existing results and signatures remain recorded. Missing signatures will not be filled in.</p><label className="tb-field"><span>Reason</span><input className="tb-input" value={cancelReason} maxLength={500} onChange={(e)=>setCancelReason(e.target.value)} placeholder="For example: restart the workshop demonstration"/></label><div className="bm-session-controls"><button type="button" className="tb-btn" disabled={busy} onClick={()=>setCancelRound(null)}>Keep this round</button><button type="button" className="tb-btn tb-btn--gold" disabled={busy||cancelReason.trim().length<5||!syncHealthy} onClick={()=>action(async()=>{await api.cancel(cancelRound,cancelReason);setCancelRound(null);})}>Cancel round</button></div></Modal>}
    {signOpen&&<Modal label="Sign company practice" onClose={busy?undefined:()=>setSignOpen(false)}><div className="tb-eyebrow">Your signature · {me.company} company</div><h2 style={{fontSize:28}}>Sign as {ROLE[me.board_role]}</h2><p className="bm-muted">{me.display_name} · Enter your own PIN to sign the practice results.</p><PinPad onComplete={sign} busy={busy} resetKey={pinReset} error={signError}/></Modal>}
    {endConfirm&&<Modal label="End practice session" onClose={busy?undefined:()=>setEndConfirm(null)}><h2>End this practice session?</h2>{error&&<p role="alert" className="bm-muted">{error}</p>}<p className="bm-muted">Scoring will close on the leaders’ computers. {endConfirm.sessionId?'Your company will':'Each company will'} receive its review list and a request for each leader’s signature. Saved practice is preserved.</p><div className="bm-session-controls"><button type="button" className="tb-btn" disabled={busy} onClick={()=>setEndConfirm(null)}>Keep practicing</button><button type="button" className="tb-btn tb-btn--gold" disabled={busy} onClick={()=>action(async()=>{await api.end(endConfirm.roundId,endConfirm.sessionId??null);setEndConfirm(null);})}>End & request signatures</button></div></Modal>}
    {detail&&<Modal wide label={`Practice result for ${detail.cadet_name}`} onClose={()=>setDetail(null)}><div className="bm-modal-content"><div className="tb-eyebrow">{detail.simulated?'Simulated example':'Practice sheet'} · {detail.company}</div><h2>{detail.cadet_name}</h2>{CATEGORIES.map((c)=><div className="bm-score-row" key={c.key}><b>{c.label}</b><span>{detail.scores[c.key]??'—'} / {c.max}</span></div>)}<p>{detail.comment||'No board comment.'}</p><p className="bm-small">This practice record cannot change the cadet’s real rank.</p><button type="button" className="tb-btn" onClick={()=>setDetail(null)}>Back to review</button></div></Modal>}
  </main>;
}
