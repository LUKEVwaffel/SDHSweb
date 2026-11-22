import { useEffect, useRef, useState } from 'react';
import { inviteLink, photoDesk, PHOTO_CENTRAL, PHOTO_LIMIT } from '../../../lib/ballPhotoApi';
import { droppedPhotos, SUPPORTED_PHOTO, uploadBallPhoto } from '../../../lib/ballPhotoUpload';
import { photoTime } from '../../../lib/ballPhotoTime';
import './ballPhotoCentral.css';

const desktop = window.matchMedia('(min-width: 800px) and (any-pointer: fine)');
const failed = error => error instanceof Error ? error.message : String(error?.message || error);
const sessionKey = invite => 'ball-photo-session:'+invite;

function InvitationForm({ invite, onAuth }) {
  const [phone,setPhone]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  async function submit(event) {
    event.preventDefault();
    if(busy)return;
    setBusy(true);setError('');
    try{
      const {token,name}=await photoDesk('unlock',{invite,phone});
      try { sessionStorage.setItem(sessionKey(invite),token); } catch { /* Upload still works in this tab. */ }
      onAuth({name,admin:false,token});
    }catch(error){setError(failed(error));}
    finally{setBusy(false);}
  }
  return <form className="bp-panel bp-form" onSubmit={submit}>
    <h2>Photographer sign-in</h2>
    <label>Phone number<input type="password" inputMode="tel" autoComplete="off" required maxLength={20} value={phone} onChange={e=>setPhone(e.target.value)}/></label>
    {error&&<p role="alert">{error}</p>}
    <button className="bp-gold" disabled={busy}>{busy?'Signing in…':'Open upload desk'}</button>
  </form>;
}

function UploadQueue({ token }) {
  const [queue,setQueue]=useState([]);
  const [skipped,setSkipped]=useState(0);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [drag,setDrag]=useState(false);
  const fileInput=useRef();
  const folderInput=useRef();
  const controller=useRef(null);

  useEffect(()=>{
    if(!busy)return;
    const warn=event=>{event.preventDefault();event.returnValue='';};
    window.addEventListener('beforeunload',warn);
    return ()=>window.removeEventListener('beforeunload',warn);
  },[busy]);

  function add(list){
    const items=[...list];
    const accepted=items.filter(file=>SUPPORTED_PHOTO.test(file.name)&&file.size>0&&file.size<=PHOTO_LIMIT);
    setSkipped(number=>number+items.length-accepted.length);
    setQueue(old=>[...old,...accepted.map(file=>({id:crypto.randomUUID(),file,status:'Waiting',progress:0,done:false}))]);
  }
  async function drop(e){
    e.preventDefault();setDrag(false);setError('');
    if(busy)return;
    try{add(await droppedPhotos(e.dataTransfer));}
    catch{setError('Could not open a dropped folder. Try Choose folder.');}
  }
  async function upload(){
    if(controller.current)return;
    const ctrl=new AbortController();
    controller.current=ctrl;setBusy(true);setError('');
    const pending=queue.filter(item=>!item.done);
    let next=0;
    const patch=(id,changes)=>setQueue(old=>old.map(item=>item.id===id?{...item,...changes}:item));
    async function worker(){
      while(!ctrl.signal.aborted&&next<pending.length){
        const {id,file}=pending[next++];
        patch(id,{error:''});
        try{
          const preview=await uploadBallPhoto(file,token,(status,progress)=>patch(id,{status,progress}),ctrl.signal);
          patch(id,{status:preview?'Delivered for review':'Original delivered · preview unavailable',progress:1,done:true});
        }catch(error){
          patch(id,{status:ctrl.signal.aborted?'Paused':'Retry needed',error:ctrl.signal.aborted?'':failed(error)});
        }
      }
    }
    try{await Promise.all([worker(),worker()]);}
    finally{setBusy(false);controller.current=null;}
  }
  const completed=queue.filter(item=>item.done).length;
  return <section className="bp-upload">
    <div className={`bp-drop${drag?' is-drag':''}`} onDragOver={e=>{e.preventDefault();if(!busy)setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={drop}>
      <h2>Drop your photos here</h2>
      <p>Drop the DCIM folder or choose individual photos. Originals stay with the Ball team.</p>
      <div className="ball-photo-row">
        <button className="bp-gold" disabled={busy} onClick={()=>folderInput.current.click()}>Choose folder</button>
        <button disabled={busy} onClick={()=>fileInput.current.click()}>Choose files</button>
      </div>
      <input ref={folderInput} type="file" multiple webkitdirectory="" hidden onChange={e=>{add(e.target.files);e.target.value='';}}/>
      <input ref={fileInput} type="file" multiple hidden onChange={e=>{add(e.target.files);e.target.value='';}}/>
    </div>
    {skipped>0&&<p className="bp-muted">{skipped} files skipped. Only supported photos up to 100 MB are accepted.</p>}
    {error&&<p role="alert">{error}</p>}
    {queue.length>0&&<div className="bp-panel">
      <div className="ball-photo-row bp-between"><div><h2>Upload queue</h2><p className="bp-muted" role="status">{completed} of {queue.length} delivered</p></div>
        <div className="ball-photo-row">{busy?<button onClick={()=>controller.current.abort()}>Pause upload</button>:<>
          <button className="bp-gold" disabled={completed===queue.length} onClick={upload}>{queue.some(item=>item.error||item.status==='Paused')?'Resume or retry':'Upload photos'}</button>
          <button onClick={()=>setQueue([])}>Clear queue</button>
        </>}</div>
      </div>
      <ol className="bp-queue">{queue.map(item=><li key={item.id}>
        <div><strong>{item.file.name}</strong><p className="bp-muted">{item.status}</p>{item.error&&<p className="bp-error">{item.error}</p>}</div>
        <progress max={1} value={item.progress} aria-label={item.file.name+' upload progress'}/>
      </li>)}</ol>
    </div>}
  </section>;
}

function Invites() {
  const [items,setItems]=useState([]);
  const [name,setName]=useState('');
  const [phone,setPhone]=useState('');
  const [link,setLink]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);

  useEffect(()=>{photoDesk('invites').then(data=>setItems(data.invites)).catch(e=>setError(failed(e)));},[]);
  async function create(event){
    event.preventDefault();setBusy(true);setError('');
    try{
      const entry=await photoDesk('create-invite',{name,phone});
      setItems(old=>[entry,...old]);setName('');setPhone('');setLink(inviteLink(entry.id));
    }catch(e){setError(failed(e));}
    finally{setBusy(false);}
  }
  async function copy(id){
    const url=inviteLink(id);
    setLink(url);
    try{await navigator.clipboard.writeText(url);}catch{ /* The link below can be selected manually. */ }
  }
  async function disable(id){
    try{await photoDesk('disable-invite',{id});setItems(old=>old.map(item=>item.id===id?{...item,active:false}:item));}
    catch(e){setError(failed(e));}
  }
  return <section className="bp-panel">
    <h2>Photographer invitations</h2>
    <p className="bp-muted">Create one private link per photographer. They sign in using their phone number.</p>
    <form className="bp-invite-form bp-form" onSubmit={create}>
      <label>Name for photo credit<input value={name} onChange={e=>setName(e.target.value)} maxLength={100} required/></label>
      <label>Phone number<input type="password" inputMode="tel" autoComplete="off" maxLength={20} value={phone} onChange={e=>setPhone(e.target.value)} required/></label>
      <button className="bp-gold" disabled={busy}>Create private link</button>
    </form>
    {error&&<p className="bp-error" role="alert">{error}</p>}
    {link&&<label className="bp-link-field">Private upload link<input readOnly value={link} onFocus={e=>e.target.select()}/></label>}
    <ul className="bp-invites">{items.map(item=><li className="ball-photo-row bp-between" key={item.id}>
      <strong>{item.name} {item.active?'':'· Disabled'}</strong>
      {item.active&&<div className="ball-photo-row"><button onClick={()=>copy(item.id)}>Copy link</button><button onClick={()=>disable(item.id)}>Disable</button></div>}
    </li>)}</ul>
  </section>;
}

function ReviewDialog({ url, onClose }) {
  const ref=useRef(null);
  useEffect(()=>{ ref.current.showModal(); },[]);
  return <dialog ref={ref} className="bp-lightbox" onCancel={onClose} aria-label="Review photo"><div className="bp-viewer">
    <button onClick={onClose} autoFocus>Close preview</button><img alt="Photo awaiting review" src={url}/>
  </div></dialog>;
}

function PhotoReview() {
  const [tab,setTab]=useState('review');
  const [items,setItems]=useState([]);
  const [total,setTotal]=useState(0);
  const [selection,setSelection]=useState(new Set());
  const [confirm,setConfirm]=useState(false);
  const [busy,setBusy]=useState(true);
  const [error,setError]=useState('');
  const [preview,setPreview]=useState('');
  const [refresh,setRefresh]=useState(0);
  useEffect(()=>{
    let active=true;
    photoDesk('inbox',{status:tab}).then(data=>{
      if(active){setItems(data.photos);setTotal(data.total);}
    }).catch(e=>{if(active)setError(failed(e));}).finally(()=>{if(active)setBusy(false);});
    return ()=>{active=false;};
  },[tab,refresh]);
  async function fetchMore(){
    setBusy(true);setError('');
    try{
      const data=await photoDesk('inbox',{status:tab,offset:items.length});
      setItems(old=>[...new Map([...old,...data.photos].map(item=>[item.id,item])).values()]);setTotal(data.total);
    }catch(e){setError(failed(e));}
    finally{setBusy(false);}
  }
  function change(next){setTab(next);setItems([]);setSelection(new Set());setConfirm(false);setError('');setBusy(true);}
  function reload(){setSelection(new Set());setConfirm(false);setError('');setBusy(true);setRefresh(n=>n+1);}
  function toggle(id){setSelection(old=>{const next=new Set(old);if(next.has(id))next.delete(id);else next.add(id);return next;});}
  async function act(){
    setBusy(true);setError('');
    try{
      const ids=[...selection];
      for(let i=0;i<ids.length;i+=60)await photoDesk(tab==='review'?'publish':'unpublish',{ids:ids.slice(i,i+60),confirm});
      reload();
    }catch(e){setError(failed(e));setBusy(false);}
  }
  async function open(item, action) {
    try{
      const {url}=await photoDesk(action,{id:item.id});
      if(action==='original')location.assign(url);
      else setPreview(url);
    }catch(e){setError(failed(e));}
  }
  return <section className="bp-panel">
    <div className="ball-photo-row bp-between"><h2>Review photos</h2><button onClick={reload} disabled={busy}>Refresh inbox</button></div>
    <div className="ball-photo-row bp-review-tabs">
      <button aria-pressed={tab==='review'} disabled={busy} onClick={()=>change('review')}>Awaiting review</button>
      <button aria-pressed={tab==='published'} disabled={busy} onClick={()=>change('published')}>Published</button>
      <p className="bp-muted">{total} photos</p>
    </div>
    {error&&<p className="bp-error" role="alert">{error}</p>}
    {busy&&!items.length&&<p role="status">Loading photos…</p>}
    {!busy&&!items.length&&<p className="bp-muted">There are no photos in this view.</p>}
    {items.length>0&&<>
      <div className="ball-photo-row bp-review-actions">
        <button disabled={busy} onClick={()=>setSelection(new Set(items.filter(item=>item.bytes).map(item=>item.id)))}>Select visible previews</button>
        <span>{selection.size} selected</span>
        {tab==='review'&&<label><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/> Cleared for public sharing</label>}
        <button className="bp-gold" disabled={busy||!selection.size||(tab==='review'&&!confirm)} onClick={act}>{tab==='review'?'Publish selected':'Unpublish selected'}</button>
      </div>
      <div className="bp-review-grid">{items.map(item=><article key={item.id} className="bp-review-card">
        {item.thumb?<button className="bp-review-image" aria-label={'Preview '+item.filename} onClick={()=>open(item,'review-image')}><img src={item.thumb} loading="lazy" alt=""/></button>
          : <div className="bp-preview-missing">Original only</div>}
        <div className="bp-review-meta"><strong>{item.filename}</strong><p className="bp-muted">{item.credit} · {photoTime(item.captured_at)}</p>
          <div className="ball-photo-row bp-between"><label><input type="checkbox" disabled={!item.bytes||busy} checked={selection.has(item.id)} onChange={()=>toggle(item.id)}/> Select</label>
            <button onClick={()=>open(item,'original')}>Original</button>
          </div>
        </div>
      </article>)}</div>
      {items.length<total&&<button className="bp-load-inbox" disabled={busy} onClick={fetchMore}>Load more</button>}
    </>}
    {preview&&<ReviewDialog url={preview} onClose={()=>setPreview('')}/>}
  </section>;
}

export default function BallPhotoDesk() {
  const [isDesktop,setIsDesktop]=useState(desktop.matches);
  const [auth,setAuth]=useState(null);
  const [loading,setLoading]=useState(true);
  const [view,setView]=useState('upload');
  const invite=new URLSearchParams(location.hash.slice(1)).get('invite')||'';
  useEffect(()=>{
    const change=()=>setIsDesktop(desktop.matches);
    desktop.addEventListener('change',change);
    return ()=>desktop.removeEventListener('change',change);
  },[]);
  useEffect(()=>{
    if(!isDesktop)return;
    let active=true;
    let token='';
    try{if(invite)token=sessionStorage.getItem(sessionKey(invite))||'';}catch { /* Storage is optional. */ }
    if(invite&&!token){setLoading(false);return;}
    photoDesk('whoami',{},token).then(data=>{if(active)setAuth({...data,token});})
      .catch(()=>{if(active)setAuth(null);}).finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[invite,isDesktop]);
  return <main className="bp-root bp-desk">
    <header className="bp-bar bp-width"><a href={PHOTO_CENTRAL} className="bp-brand">Ball Photo Central</a><nav><a href={PHOTO_CENTRAL}>View gallery</a></nav></header>
    <section className="bp-width bp-desk-main">
      <div className="bp-desk-heading"><p className="bp-kicker">Military Ball · November 21, 2026</p><h1>Photo upload desk</h1>{auth&&<p className="bp-muted">Signed in as {auth.name}</p>}</div>
      {!isDesktop?<div className="bp-panel"><h2>Open the upload desk on a computer</h2><p>Browse and download Ball photos on your phone.</p><a className="bp-button bp-gold" href={PHOTO_CENTRAL}>View gallery</a></div>
        : loading?<p role="status">Opening the upload desk…</p>
        : !auth?invite?<InvitationForm invite={invite} onAuth={setAuth}/>:<div className="bp-panel"><h2>Sign in to upload</h2><p>Staff use their DISPATCH account. Photographers open their private invitation.</p><a className="bp-button bp-gold" href="/admin">Sign in to DISPATCH</a></div>
        : <>
          {auth.admin&&<div className="ball-photo-row bp-desk-tabs" role="group" aria-label="Upload desk sections">
            {[['upload','Upload files'],['review','Review gallery'],['invites','Photographer invites']].map(([id,label])=><button key={id} aria-pressed={view===id} onClick={()=>setView(id)}>{label}</button>)}
          </div>}
          <div hidden={view!=='upload'}><UploadQueue token={auth.token}/></div>
          {view==='invites'&&auth.admin&&<Invites/>}
          {view==='review'&&auth.admin&&<PhotoReview/>}
        </>}
    </section>
  </main>;
}
