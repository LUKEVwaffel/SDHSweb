import { useEffect, useRef, useState } from 'react';
import { loadGallery, photoLink, PHOTO_DESK, zipParts } from '../../../lib/ballPhotoApi';
import { photoTime } from '../../../lib/ballPhotoTime';
import './ballPhotoCentral.css';

function PhotoDialog({ photo, index, total, move, onClose }) {
  const dialog=useRef(null);
  useEffect(()=>{ dialog.current?.showModal(); },[]);
  return <dialog ref={dialog} className="bp-lightbox" aria-label="Photo viewer"
    onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}}
    onKeyDown={e=>{if(e.key==='ArrowLeft')move(-1);if(e.key==='ArrowRight')move(1);}}>
    <div className="bp-viewer">
      <div className="ball-photo-row bp-between"><span>{index+1} of {total} · {photoTime(photo.captured_at)}</span><button onClick={onClose} autoFocus>Close</button></div>
      <img key={photo.id} src={photoLink('view',{id:photo.id})} alt="Military Ball photograph"/>
      <div className="ball-photo-row bp-between"><button onClick={()=>move(-1)} disabled={index===0}>Previous</button><a className="bp-button bp-gold" href={photoLink('download',{id:photo.id})}>Download photo</a><button onClick={()=>move(1)} disabled={index===total-1}>Next</button></div>
    </div>
  </dialog>;
}

function DownloadDialog({ selection, onClose }) {
  const dialog=useRef(null);
  const parts=zipParts(selection);
  useEffect(()=>{ dialog.current?.showModal(); },[]);
  return <dialog ref={dialog} className="bp-download" onCancel={onClose} aria-labelledby="bp-download-title">
    <div className="ball-photo-row bp-between"><h2 id="bp-download-title">Download photos</h2><button onClick={onClose} autoFocus>Close</button></div>
    <p>{selection.length} selected · {parts.length} {parts.length===1?'ZIP file':'ZIP files'}</p>
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
  const [viewer,setViewer]=useState(null);
  const [selecting,setSelecting]=useState(false);
  const [selected,setSelected]=useState(new Set());
  const [downloads,setDownloads]=useState(false);
  const batch=photos.filter(photo=>selected.has(photo.id));

  useEffect(()=>{
    const ctrl=new AbortController();
    loadGallery(0,ctrl.signal).then(({photos,total})=>{setPhotos(photos);setTotal(total);}).catch(e=>{
      if(!ctrl.signal.aborted)setError(e.message);
    });
    return ()=>ctrl.abort();
  },[]);

  async function more(reset=false){
    if(busy)return;
    setError('');setBusy(true);
    try{
      const page=await loadGallery(reset?0:photos.length);
      setPhotos(old=>reset?page.photos:[...new Map([...old,...page.photos].map(photo=>[photo.id,photo])).values()]);
      setTotal(page.total);
    }catch(e){setError(e.message);}
    finally{setBusy(false);}
  }
  function toggle(id){
    setSelected(old=>{
      const next=new Set(old);if(next.has(id))next.delete(id);else next.add(id);
      return next;
    });
  }
  const cover=photos[0];
  return <main className="bp-root">
    <header className="bp-bar bp-width">
      <a href="/ball" className="bp-brand">Trojan Battalion</a>
      <nav aria-label="Ball links"><a href="/ballfeedback">Give feedback <span aria-hidden="true">↗</span></a><a href={PHOTO_DESK}>Upload desk</a></nav>
    </header>
    <section className={`bp-hero bp-width${cover?' has-cover':''}`}>
      <div className="bp-hero-copy">
        <p className="bp-kicker">SDHS Military Ball · November 21, 2026</p>
        <h1>Ball Photo<br className="bp-desktop-break"/> Central</h1>
        <p>Find your moments from the evening. Pick the photos you want and take them home.</p>
        {cover&&<a className="bp-button bp-gold" href="#photos">Browse photos <span aria-hidden="true">↓</span></a>}
      </div>
      <div className="bp-hero-frame">{cover?<button onClick={()=>setViewer(0)} aria-label="Open the first photo"><img src={photoLink('view',{id:cover.id})} alt="A moment from the Military Ball"/></button>
        : <img className="bp-hero-mark" src="/assets/trojan-helmet.png" alt=""/>}</div>
    </section>
    <section className="bp-width bp-gallery" id="photos" aria-labelledby="bp-gallery-title">
      <div className="bp-gallery-heading">
        <div><h2 id="bp-gallery-title">The Gallery</h2>
          {total!==null&&<p className="bp-muted">{total} {total===1?'photo':'photos'} · In capture-time order</p>}
        </div>
        {photos.length>0&&<div className="ball-photo-row">
          {selecting&&<button onClick={()=>setSelected(new Set(photos.map(photo=>photo.id)))}>Select visible</button>}
          <button className={selecting?'bp-active':''} aria-pressed={selecting} onClick={()=>{setSelecting(!selecting);if(selecting)setSelected(new Set());}}>
            {selecting?'Cancel selection':'Select photos'}
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
          <img src={photo.thumb||photoLink('view',{id:photo.id})} alt="" loading={index<8?'eager':'lazy'}/>
          <span className="bp-tile-time">{photo.captured_at?photoTime(photo.captured_at):'Time unavailable'}</span>
          {selecting&&<span className="bp-check" aria-hidden="true">{selected.has(photo.id)?'✓':''}</span>}
        </button>)}
      </div>}
      {photos.length>0&&photos.length<total&&<div className="bp-more"><button onClick={()=>more()} disabled={busy}>{busy?'Loading…':`Load more · ${photos.length} of ${total}`}</button></div>}
      {selecting&&<div className="bp-selection" role="region" aria-label="Download selection"><strong>{selected.size} selected</strong><button className="bp-gold" disabled={!selected.size} onClick={()=>setDownloads(true)}>Download selected</button></div>}
    </section>
    <footer className="bp-width bp-footer">
      <div><h2>How was the Ball?</h2><p>Tell us what you enjoyed and what we can improve for next year.</p></div>
      <a className="bp-button bp-gold" href="/ballfeedback">Share feedback <span aria-hidden="true">↗</span></a>
    </footer>
    {viewer!==null&&<PhotoDialog photo={photos[viewer]} index={viewer} total={photos.length}
      move={direction=>setViewer(index=>Math.max(0,Math.min(photos.length-1,index+direction)))} onClose={()=>setViewer(null)}/>}
    {downloads&&<DownloadDialog selection={batch} onClose={()=>setDownloads(false)}/>}
  </main>;
}
