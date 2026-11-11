import {LAYOUTS} from '../../../../../lib/ballPresentation';
import {nudgePhoto} from '../../../../../lib/ballPhotoPosition';
import {useState,useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import StudioSlideStage from './StudioSlideStage';
import StudioPairPanel from './StudioPairPanel';
import {useStudioPlayback} from './useStudioPlayback';
import {useStudioHost} from './useStudioHost';
import {usePresentationWake} from './usePresentationWake';
export default function StudioPlayer({deck,startIndex=0,onClose,onPhotoEdit}) {
  const playback=useStudioPlayback(deck,startIndex);const {state,send}=playback;
  const {index,playing,blackout}=state;const slide=deck.slides[index];
  const host=useStudioHost(deck,playback);
  const [notes,setNotes]=useState(false);const [hint,setHint]=useState('');const [fullscreen,setFullscreen]=useState(false);const [pairing,setPairing]=useState(false);
  const [positionSlide,setPositionSlide]=useState(null);
  const [photoIndex,setPhotoIndex]=useState(0);
  const positioning=positionSlide===slide.id;
  const photoSlots=LAYOUTS.find(l=>l.id===slide.layout)?.photos||0;
  const positionable=slide.photos.slice(0,photoSlots).some(Boolean);
  const root=useRef();usePresentationWake();
  function togglePosition() {
    if(positioning){setPositionSlide(null);return;}
    if(!onPhotoEdit||!positionable){setHint('This slide has no photo to position.');return;}
    send({type:'pause'});setPhotoIndex(slide.photos.slice(0,photoSlots).findIndex(Boolean));setPositionSlide(slide.id);setHint('');
  }
  const current=useRef();current.current={slide,photoIndex,positioning,togglePosition,onPhotoEdit};
  useEffect(()=>{
    const previousFocus=document.activeElement;root.current?.focus();
    const key=e=>{
      if(pairing){if(e.key==='Escape'){e.preventDefault();setPairing(false);}return;}
      if(e.key==='Tab'){
        const controls=[...root.current.querySelectorAll('button:not(:disabled),select')];const first=controls[0],last=controls.at(-1);
        if(e.shiftKey&&(document.activeElement===first||document.activeElement===root.current)){e.preventDefault();last?.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
      }
      if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)return;
      if(e.target instanceof HTMLTextAreaElement||e.target.isContentEditable||e.metaKey||e.ctrlKey||e.altKey)return;
      const view=current.current;
      if(e.key.toLowerCase()==='k') {e.preventDefault();if(!e.repeat)view.togglePosition();return;}
      if(view.positioning) {
        if(e.key==='Escape'){e.preventDefault();setPositionSlide(null);return;}
        const photo=view.slide.photos[view.photoIndex];
        if(e.key.startsWith('Arrow')) {
          e.preventDefault();
          const frame=root.current.querySelector(`.bs-stage-incoming .bs-photo-frame[data-photo-index="${view.photoIndex}"]`);
          const image=frame?.querySelector('.bs-photo-main');
          if(!photo||!image)return;
          const {width,height}=frame.getBoundingClientRect();
          const patch=nudgePhoto(photo,view.slide,e.key,{width,height,naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight},e.shiftKey);
          if(Object.keys(patch).length){view.onPhotoEdit(view.slide.id,view.photoIndex,patch);setHint('');}
          else setHint('This direction already fits the frame. Press + to zoom in, then use the arrows.');
          return;
        }
        if(['+','=','-','_'].includes(e.key)&&photo){e.preventDefault();view.onPhotoEdit(view.slide.id,view.photoIndex,{zoom:Math.max(1,Math.min(3,(photo.zoom??1)+(e.key==='-'||e.key==='_'?-.05:.05)))});return;}
        if(/^[1-4]$/.test(e.key)){e.preventDefault();const i=Number(e.key)-1;if(view.slide.photos[i])setPhotoIndex(i);return;}
        if([' ','p','P'].includes(e.key)){e.preventDefault();return;}
      }
      const shortcuts={ArrowRight:'next',PageDown:'next',' ':'next',ArrowLeft:'previous',PageUp:'previous',Home:'restart',End:'goto',b:'blackout',p:'toggle-play'};
      const type=shortcuts[e.key]||shortcuts[e.key.toLowerCase()];if(type){e.preventDefault();send({type,index:deck.slides.length-1});}
      if(e.key.toLowerCase()==='n')setNotes(n=>!n);
      if(e.key==='Escape'&&!document.fullscreenElement)onClose();
    };
    const changed=()=>setFullscreen(!!document.fullscreenElement);
    window.addEventListener('keydown',key);document.addEventListener('fullscreenchange',changed);
    const before=document.body.style.overflow;document.body.style.overflow='hidden';
    return()=>{window.removeEventListener('keydown',key);document.removeEventListener('fullscreenchange',changed);document.body.style.overflow=before;previousFocus?.focus();};
  },[deck.slides.length,onClose,pairing,send]);
  async function toggleFull(){try{if(document.fullscreenElement)await document.exitFullscreen();else await root.current.requestFullscreen();}catch{setHint('Full screen was blocked. Use your browser’s full-screen control.');}}
  useEffect(()=>{const next=deck.slides[(index+1)%deck.slides.length];next.photos.filter(Boolean).forEach(p=>{const img=new Image();img.src=p.url;});},[deck.slides,index]);
  return createPortal(<div className={`bs-player ${blackout?'bs-is-black':''}`} ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Ball presentation playback">
    <div className="bs-player-stage"><StudioSlideStage slide={slide} deck={deck} index={index} visit={state.visit} positioning={positioning}/></div>
    {positioning&&<div className="bs-player-position" role="status"><strong>Positioning photo {photoIndex+1}</strong><span>Arrows move · Shift moves faster · + / − zoom · K or Esc finishes</span>{photoSlots>1&&<select aria-label="Photo to position" value={photoIndex} onChange={e=>{setPhotoIndex(Number(e.target.value));root.current?.focus();}}>{slide.photos.slice(0,photoSlots).map((p,i)=>p&&<option key={i} value={i}>Photo {i+1}</option>)}</select>}<span>{Math.round((slide.photos[photoIndex]?.zoom??1)*100)}% zoom · Changes save automatically</span></div>}
    {blackout&&<div className="bs-blackout-label">Blackout · press B to return</div>}
    <nav className="bs-player-controls" aria-label="Presentation controls">
      <button onClick={onClose}>Exit</button>{onPhotoEdit&&<button aria-pressed={positioning} disabled={!positionable} onClick={togglePosition}>{positioning?'Finish positioning (K)':'Position photo (K)'}</button>}<button onClick={()=>send({type:'previous'})} disabled={index===0}>Previous</button><span>{index+1} / {deck.slides.length}</span><button onClick={()=>send({type:'next'})}>Next</button>
      <button onClick={()=>{setPositionSlide(null);send({type:'toggle-play'});}}>{playing?'Pause':'Autoplay'}</button><button onClick={()=>send({type:'blackout'})}>{blackout?'Show slides':'Blackout'}</button><button onClick={()=>setNotes(n=>!n)}>{notes?'Hide notes':'Notes'}</button><button onClick={toggleFull}>{fullscreen?'Leave full screen':'Full screen'}</button>
      <button onClick={()=>{if(!host.token)host.start();setPairing(true);}}>{host.token?'Phone remote':'Connect phone'}</button>
      <select aria-label="Jump to slide" value={index} onChange={e=>send({type:'goto',index:Number(e.target.value)})}>{deck.slides.map((s,i)=><option key={s.id} value={i}>{i+1}. {s.title||s.layout}</option>)}</select>
      <small>← → advance · K position photo · P play/pause · B blackout · Phone remote {host.status.toLowerCase()}</small>
    </nav>
    {notes&&<aside className="bs-player-notes"><strong>Speaker notes · visible on this screen</strong><p>{slide.notes||'No notes for this slide.'}</p><small>Next: {deck.slides[index+1]?.title||'End of presentation'}</small></aside>}
    {hint&&<div className="bs-player-hint" role="status">{hint} <button onClick={()=>setHint('')}>Dismiss</button></div>}
    {pairing&&host.token&&<StudioPairPanel host={host} onClose={()=>setPairing(false)}/>}
  </div>,document.body);
}
