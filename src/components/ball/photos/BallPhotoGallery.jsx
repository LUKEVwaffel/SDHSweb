import { useEffect, useRef, useState } from 'react';
import { loadGallery, photoDesk, photoLink, PHOTO_DESK, zipParts } from '../../../lib/ballPhotoApi';
import { photoTime } from '../../../lib/ballPhotoTime';
import './ballPhotoCentral.css';

const BALLOT_KEY = 'ball-photo-ballot';

function savedBallot() {
  try { return JSON.parse(localStorage.getItem(BALLOT_KEY)) || {}; }
  catch { return {}; }
}

function ReelImage({ photo, active }) {
  const [ready,setReady]=useState(false);
  return <div className="bp-reel-image">
    {photo.thumb&&<img src={photo.thumb} alt="" decoding="async" draggable="false"/>}
    {active&&<img className={ready?'is-ready':''} src={photoLink('view',{id:photo.id})}
      alt="Military Ball photograph" decoding="async" draggable="false" onLoad={()=>setReady(true)}/>}
  </div>;
}

function PhotoReel({ photos, start, total, selection, onToggle, onDownload, ballot, onVote, voting, error, more, onClose }) {
  const dialog=useRef(null);
  const reel=useRef(null);
  const frame=useRef(0);
  const requestedAt=useRef(0);
  const [index,setIndex]=useState(start);
  const photo=photos[index];

  useEffect(()=>{
    dialog.current.showModal();
    reel.current.scrollTop=start*reel.current.clientHeight;
    const overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    return ()=>{document.body.style.overflow=overflow;cancelAnimationFrame(frame.current);};
  },[start]);

  useEffect(()=>{
    if(index<photos.length-3||photos.length>=total||requestedAt.current===photos.length)return;
    requestedAt.current=photos.length;
    more();
  },[index,photos.length,total,more]);

  function trackScroll() {
    if(frame.current)return;
    frame.current=requestAnimationFrame(()=>{
      frame.current=0;
      const el=reel.current;
      if(el?.clientHeight)setIndex(Math.min(photos.length-1,Math.max(0,Math.round(el.scrollTop/el.clientHeight))));
    });
  }
  function move(direction) {
    const el=reel.current;
    const next=index+direction;
    if(next>=photos.length&&photos.length<total){more();return;}
    if(next<0||next>=photos.length)return;
    el.scrollTo({top:next*el.clientHeight,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  }
  return <dialog ref={dialog} className="bp-lightbox bp-photo-reel" aria-label="Photo reel" onCancel={onClose}
    onKeyDown={event=>{
      if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)){
        event.preventDefault();
        move(['ArrowDown','ArrowRight'].includes(event.key)?1:-1);
      }
    }}>
    <header className="bp-reel-header">
      <button onClick={onClose} autoFocus>Back to gallery</button>
      <span aria-live="polite">{index+1} / {total}</span>
      <button className="bp-gold" disabled={!selection.size} onClick={onDownload}>Batch{selection.size>0?` · ${selection.size}`:''}</button>
    </header>
    <div className="bp-reel-scroll" ref={reel} onScroll={trackScroll}>
      {photos.map((item,i)=><div className="bp-reel-slide" key={item.id}>
        {Math.abs(i-index)<=1&&<ReelImage key={i===index?'active':'near'} photo={item} active={i===index}/>}
      </div>)}
    </div>
    <footer className="bp-reel-footer">
      <div className="bp-reel-meta"><span>{photo.credit}</span><span>{photoTime(photo.captured_at)}</span></div>
      <div className="bp-reel-actions">
        <button aria-pressed={selection.has(photo.id)} onClick={()=>onToggle(photo.id)}>{selection.has(photo.id)?'✓ In batch':'+ Add to batch'}</button>
        <button disabled={voting||ballot.photoId===photo.id} aria-pressed={ballot.photoId===photo.id} onClick={()=>onVote(photo.id)}>
          {ballot.photoId===photo.id?'★ Voted':ballot.photoId?'☆ Change vote':'☆ Vote for photo'}
        </button>
        <a className="bp-button" aria-label="Download this photo" href={photoLink('download',{id:photo.id})}>↓ Save</a>
      </div>
      {error&&<p className="bp-error" role="alert">{error}</p>}
      <div className="bp-reel-nav"><button disabled={index===0} onClick={()=>move(-1)} aria-label="Previous photo">↑</button><span>Swipe up for the next photo</span><button disabled={index===total-1} onClick={()=>move(1)} aria-label="Next photo">↓</button></div>
    </footer>
  </dialog>;
}

function DownloadDialog({ selection, onClose }) {
  const dialog=useRef(null);
  const parts=zipParts(selection);
  useEffect(()=>{ dialog.current?.showModal(); },[]);
  return <dialog ref={dialog} className="bp-download" onCancel={onClose} aria-labelledby="bp-download-title">
    <div className="ball-photo-row bp-between"><h2 id="bp-download-title">Download photos</h2><button onClick={onClose} autoFocus>Close</button></div>
    <p>{selection.length} high-quality JPEGs · {parts.length} {parts.length===1?'ZIP file':'ZIP files'}</p>
    <div className="bp-download-links">{parts.map((ids,i)=><a key={ids[0]} className="bp-button bp-gold"
      href={photoLink('zip',{ids:ids.join(','),part:parts.length>1?i+1:0})}>
      {parts.length===1?'Download ZIP':`Download ZIP ${i+1} of ${parts.length}`} · {ids.length} {ids.length===1?'photo':'photos'}
    </a>)}</div>
    <p className="bp-muted">On iPhone, open the ZIP in <strong>Files → Downloads</strong> and tap it to unpack the photos.</p>
  </dialog>;
}

export default function BallPhotoGallery() {
  const [photos,setPhotos]=useState([]);
  const [total,setTotal]=useState(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const pageOffset=useRef(0);
  const fetching=useRef(false);
  const [viewer,setViewer]=useState(null);
  const [selecting,setSelecting]=useState(false);
  const [selected,setSelected]=useState(new Set());
  const [downloads,setDownloads]=useState(false);
  const [ballot,setBallot]=useState(savedBallot);
  const [voting,setVoting]=useState(false);
  const [voteError,setVoteError]=useState('');
  const batch=photos.filter(photo=>selected.has(photo.id));

  useEffect(()=>{
    const ctrl=new AbortController();
    loadGallery(0,ctrl.signal).then(({photos,total})=>{pageOffset.current=photos.length;setPhotos(photos);setTotal(total);}).catch(e=>{
      if(!ctrl.signal.aborted)setError(e.message);
    });
    return ()=>ctrl.abort();
  },[]);

  async function more(reset=false){
    if(fetching.current)return;
    fetching.current=true;setError('');setBusy(true);
    try{
      const offset=reset?0:pageOffset.current;
      const page=await loadGallery(offset);
      pageOffset.current=offset+page.photos.length;
      setPhotos(old=>reset?page.photos:[...new Map([...old,...page.photos].map(photo=>[photo.id,photo])).values()]);
      setTotal(page.total);
    }catch(e){setError(e.message);}
    finally{fetching.current=false;setBusy(false);}
  }
  function toggle(id){
    setSelected(old=>{
      const next=new Set(old);if(next.has(id))next.delete(id);else next.add(id);
      return next;
    });
  }
  async function vote(photoId) {
    if(voting)return;
    const voter=ballot.voter||crypto.randomUUID();
    const pending={...ballot,voter};
    setBallot(pending);
    try { localStorage.setItem(BALLOT_KEY,JSON.stringify(pending)); } catch { /* Keep the vote in this tab. */ }
    setVoting(true);
    setVoteError('');
    try{
      await photoDesk('vote',{voter,photoId});
      const saved={voter,photoId};
      setBallot(saved);
      try { localStorage.setItem(BALLOT_KEY,JSON.stringify(saved)); } catch { /* Keep the vote in this tab. */ }
    }catch(e){setVoteError(e.message);}
    finally{setVoting(false);}
  }
  const cover=photos.find(photo=>photo.thumb);
  return <main className="bp-root bp-public-gallery">
    <header className="bp-bar bp-width">
      <a href="/ball" className="bp-brand">Trojan Battalion</a>
      <nav aria-label="Ball links"><a href="/ballfeedback">Give feedback <span aria-hidden="true">↗</span></a><a href={PHOTO_DESK}>Upload desk</a></nav>
    </header>
    <section className="bp-album-intro bp-width">
      <div>
        <p className="bp-kicker">SDHS Military Ball · Nov 21, 2026</p>
        <h1>Ball Photo Central</h1>
        <p>Browse the evening, build a batch, and vote for your favorite.</p>
      </div>
      {cover&&<button className="bp-album-cover" onClick={()=>setViewer(photos.indexOf(cover))} aria-label="Open photo reel">
        <img src={cover.thumb} alt="" decoding="async"/>
      </button>}
    </section>
    <section className="bp-width bp-gallery" id="photos" aria-labelledby="bp-gallery-title">
      <div className="bp-gallery-heading">
        <div><h2 id="bp-gallery-title">The Gallery</h2>
          {total!==null&&<p className="bp-muted">{total} {total===1?'photo':'photos'} · In capture-time order</p>}
        </div>
        {photos.length>0&&<div className="ball-photo-row bp-gallery-tools">
          {!selecting&&<button className="bp-gold" onClick={()=>setViewer(Math.max(0,photos.findIndex(photo=>photo.id===ballot.photoId)))}>{ballot.photoId?'★ Your vote':'☆ Vote for best photo'}</button>}
          {selecting&&<button onClick={()=>setSelected(old=>new Set([...old,...photos.map(photo=>photo.id)]))}>Select visible</button>}
          <button className={selecting?'bp-active':''} aria-pressed={selecting} onClick={()=>setSelecting(!selecting)}>
            {selecting?'Done selecting':'Select photos'}
          </button>
        </div>}
      </div>
      {error&&<div role="alert" className="bp-message"><p>{error}</p><button disabled={busy} onClick={()=>more(total===null)}>Try again</button></div>}
      {total===null&&!error&&<p className="bp-message" role="status">Loading the gallery…</p>}
      {total===0&&<div className="bp-message"><h3>Photos are on the way</h3><p>Check back as the photographers’ photos are reviewed and added.</p></div>}
      {photos.length>0&&<div className="bp-grid">
        {photos.map((photo,index)=><button className={`bp-tile${selected.has(photo.id)?' is-selected':''}`} key={photo.id}
          aria-label={`${selecting?'Select':'Open'} photo ${index+1}, ${photoTime(photo.captured_at)}`}
          aria-pressed={selecting?selected.has(photo.id):undefined} onClick={()=>selecting?toggle(photo.id):setViewer(index)}>
          <img src={photo.thumb||undefined} alt="" decoding="async" loading={index<4?'eager':'lazy'}/>
          <span className="bp-tile-time">{photo.captured_at?photoTime(photo.captured_at):'Time unavailable'}</span>
          {(selecting||selected.has(photo.id))&&<span className="bp-check" aria-hidden="true">{selected.has(photo.id)?'✓':''}</span>}
        </button>)}
      </div>}
      {photos.length>0&&photos.length<total&&<div className="bp-more"><button onClick={()=>more()} disabled={busy}>{busy?'Loading…':`Load more · ${photos.length} of ${total}`}</button></div>}
      {(selecting||selected.size>0)&&<div className="bp-selection" role="region" aria-label="Download selection"><strong>{selected.size} selected</strong>{selected.size>0&&<button onClick={()=>setSelected(new Set())}>Clear</button>}<button className="bp-gold" disabled={!selected.size} onClick={()=>setDownloads(true)}>Download selected</button></div>}
    </section>
    <footer className="bp-width bp-footer">
      <div><h2>How was the Ball?</h2><p>Tell us what you enjoyed and what we can improve for next year.</p></div>
      <a className="bp-button bp-gold" href="/ballfeedback">Share feedback <span aria-hidden="true">↗</span></a>
    </footer>
    {viewer!==null&&<PhotoReel photos={photos} start={viewer} total={total} selection={selected} onToggle={toggle}
      ballot={ballot} onVote={vote} voting={voting} error={voteError||error} more={more}
      onDownload={()=>setDownloads(true)} onClose={()=>setViewer(null)}/>}
    {downloads&&<DownloadDialog selection={batch} onClose={()=>setDownloads(false)}/>}
  </main>;
}
