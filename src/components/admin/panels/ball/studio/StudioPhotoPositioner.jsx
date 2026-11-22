import { useState } from 'react';
import { LAYOUTS } from '../../../../../lib/ballPresentation';
import StudioModal from './StudioModal';
import SlideCanvas from './SlideCanvas';

export default function StudioPhotoPositioner({ slide, deck, index, initialPhoto = 0, onClose, onApply }) {
  const [draft,setDraft]=useState(slide);
  const [selected,setSelected]=useState(initialPhoto);
  const photo=draft.photos[selected];
  const count=LAYOUTS.find(l=>l.id===slide.layout)?.photos || 0;
  function update(i,patch) {
    setSelected(i);
    setDraft(s=>({...s,photos:s.photos.map((p,n)=>n===i&&p?{...p,...patch}:p)}));
  }
  return <StudioModal title="Position photos & event labels" onClose={onClose} wide>
    <p className="bs-muted">Drag a photo to move it inside its frame. Select each photo to adjust its zoom, fit, and event label. This preview shows the presentation framing.</p>
    <div className="bs-position-preview"><SlideCanvas slide={draft} deck={deck} index={index} selectedPhoto={selected} onPhotoPosition={update}/></div>
    <div className="bs-row">{draft.photos.slice(0,count).map((p,i)=>p&&<button key={i} aria-pressed={selected===i} onClick={()=>setSelected(i)}>Photo {i+1}</button>)}</div>
    {photo&&<div className="bs-position-controls">
      <label className="bs-field"><span>Event label · bottom left (leave blank to hide)</span><input maxLength={200} value={photo.eventLabel ?? photo.event ?? ''} onChange={e=>update(selected,{eventLabel:e.target.value})}/></label>
      <label className="bs-field"><span>Image fit</span><select value={photo.fit||draft.fit} onChange={e=>update(selected,{fit:e.target.value})}><option value="cover">Fill frame (crop)</option><option value="contain">Show entire photo</option></select></label>
      <label className="bs-field"><span>Zoom · {Math.round((photo.zoom??1)*100)}%</span><input type="range" min={1} max={3} step={0.01} value={photo.zoom??1} onChange={e=>update(selected,{zoom:Number(e.target.value)})}/></label>
      <label className="bs-field"><span>Horizontal position · {Math.round(photo.focalX??draft.focalX)}%</span><input type="range" min={0} max={100} value={photo.focalX??draft.focalX} onChange={e=>update(selected,{focalX:Number(e.target.value)})}/></label>
      <label className="bs-field"><span>Vertical position · {Math.round(photo.focalY??draft.focalY)}%</span><input type="range" min={0} max={100} value={photo.focalY??draft.focalY} onChange={e=>update(selected,{focalY:Number(e.target.value)})}/></label>
      <button onClick={()=>update(selected,{focalX:50,focalY:50,zoom:1})}>Reset position & zoom</button>
    </div>}
    <footer className="bs-row"><button onClick={onClose}>Cancel</button><button className="bs-primary" onClick={()=>onApply(draft.photos)}>Apply changes</button></footer>
  </StudioModal>;
}
