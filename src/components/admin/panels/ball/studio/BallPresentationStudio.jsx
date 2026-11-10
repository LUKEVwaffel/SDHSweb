import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { LAYOUTS, THEMES, makeSlide, makeDeck, moveSlide, totalDuration, uid, readDeck, downloadFile, fileName } from '../../../../../lib/ballPresentation';
import { useStudioDecks } from './useStudioDecks';
import SlideCanvas from './SlideCanvas';
import StudioPhotoPicker from './StudioPhotoPicker';
import StudioPlayer from './StudioPlayer';
import StudioModal from './StudioModal';
import StudioPreflight from './StudioPreflight';
import './ballStudio.css';

const fmt = seconds => `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
function Field({label,children}) {return <label className="bs-field"><span>{label}</span>{children}</label>;}
export default function BallPresentationStudio({ adminId }) {
  const store=useStudioDecks(adminId);
  const {deck,decks,edit,undo,redo}=store;
  const [selectedId,setSelectedId]=useState(deck.slides[0].id);
  const [modal,setModal]=useState(null);
  const [player,setPlayer]=useState(null);
  const [expanded,setExpanded]=useState(false);
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  const [cloudRows,setCloudRows]=useState([]);
  const [savedListError,setSavedListError]=useState('');
  const [savedSearch,setSavedSearch]=useState('');
  const [replaceIndex,setReplaceIndex]=useState(null);
  const [inspector,setInspector]=useState('content');
  const [slideSearch,setSlideSearch]=useState('');
  const [dragId,setDragId]=useState(null);
  const importRef=useRef();
  const index=Math.max(0,deck.slides.findIndex(s=>s.id===selectedId));
  const slide=deck.slides[index];
  const closeModal=useCallback(()=>{setModal(null);setReplaceIndex(null);},[]);
  const closePlayer=useCallback(()=>setPlayer(null),[]);
  const usedIds=useMemo(()=>deck.slides.flatMap(s=>s.photos.filter(Boolean).map(p=>p.id)),[deck.slides]);
  const expectedPhotos=LAYOUTS.find(l=>l.id===slide.layout)?.photos || 0;
  const missing=deck.slides.reduce((n,s)=>n+Math.max(0,(LAYOUTS.find(l=>l.id===s.layout)?.photos||0)-s.photos.filter(Boolean).length),0);
  const hasLongText=slide.title.length>140 || slide.subtitle.split('\n').length>8 || slide.subtitle.length>700;
  const editSlide=patch=>edit(d=>({...d,slides:d.slides.map(s=>s.id===slide.id?{...s,...patch}:s)}));
  function insertSlides(slides) {
    if(deck.slides.length+slides.length>1000){setNotice('A deck supports up to 1,000 slides. Create another deck for additional slides.');return;}
    edit(d=>({...d,slides:[...d.slides.slice(0,index+1),...slides,...d.slides.slice(index+1)]}));setSelectedId(slides[0].id);
  }
  function addSlide(layout){insertSlides([makeSlide(layout)]);closeModal();}
  function duplicateSlide(){insertSlides([{...slide,id:uid(),photos:slide.photos.map(p=>p?({...p}):null)}]);}
  function deleteSlide(){if(deck.slides.length===1)return;edit(d=>({...d,slides:d.slides.filter(s=>s.id!==slide.id)}));setSelectedId(deck.slides[Math.max(0,index-1)].id);}
  function move(from,to){edit(d=>({...d,slides:moveSlide(d.slides,from,to)}));}
  function photosAdded(photos,layout){
    if(replaceIndex!==null){const next=[...slide.photos];next[replaceIndex]=photos[0];editSlide({photos:next});}
    else {const size=LAYOUTS.find(l=>l.id===layout).photos;const slides=[];for(let i=0;i<photos.length;i+=size){const group=photos.slice(i,i+size);slides.push(makeSlide(layout,{photos:group,title:layout==='split'?group[0].event:'',eyebrow:'',subtitle:''}));}insertSlides(slides);}
    closeModal();
  }
  function duplicateDeck(){const next={...readDeck(deck),name:`${deck.name} · copy`};store.addDeck(next);setSelectedId(next.slides[0].id);}
  async function cloudSave(){if(!deck.name.trim()){setNotice('Give your presentation a name before saving.');return;}setBusy(true);try{await store.saveCloud();setNotice('Presentation saved. Open Saved presentations to edit it later, then use Save presentation to update the same deck.');}catch(e){setNotice(e.message);}finally{setBusy(false);}}
  async function cloudOpen(){setModal('cloud');setSavedSearch('');setSavedListError('');setCloudRows([]);setBusy(true);try{setCloudRows(await store.listCloud());}catch(e){setSavedListError(`Saved presentations could not load: ${e.message}. Your browser drafts are available below.`);}finally{setBusy(false);}}
  async function portable(){setBusy(true);try{const {exportPresentation}=await import('./studioExport');await exportPresentation(deck,setNotice);setNotice('Presentation downloaded with photos and fonts included. Open the HTML file in a browser to play offline.');}catch(e){setNotice(`Export stopped: ${e.message} Check the connection or replace the affected image, then retry. No incomplete presentation was downloaded.`);}finally{setBusy(false);}}
  async function importDeck(e){const file=e.target.files[0];e.target.value='';if(!file)return;try{if(file.size>20*1024*1024)throw new Error('Deck backups must be smaller than 20 MB.');const next=readDeck(JSON.parse(await file.text()));store.addDeck(next);setSelectedId(next.slides[0].id);setNotice('Imported as a new deck.');}catch(err){setNotice(`Import failed: ${err.message}`);}}
  useEffect(()=>{
    const key=e=>{
      if(!modal&&player===null&&(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='s'){e.preventDefault();if(!busy)cloudSave();return;}
      if(modal||player!==null||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable)return;
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)redo();else undo();}
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='d'){e.preventDefault();duplicateSlide();}
    };
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  });
  useEffect(()=>{if(!expanded)return;const before=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=before;};},[expanded]);

  const content=<div className={`ball-studio ${expanded?'bs-expanded':''}`}>
    <header className="bs-topbar"><div><div className="bs-eyebrow">Trojan Battalion · Creative studio</div><h1>Ball Studio<span>Make the evening unforgettable.</span></h1></div><div className="bs-row"><button onClick={()=>setExpanded(v=>!v)}>{expanded?'Return to admin':'Expand studio'}</button><button className="bs-primary" onClick={()=>setPlayer(0)}>Present from start</button></div></header>
    <div className="bs-deckbar"><input className="bs-deck-name" aria-label="Presentation name" maxLength={150} value={deck.name} onChange={e=>edit(d=>({...d,name:e.target.value}))}/><div className="bs-row"><span className="bs-save-status">{store.localSaved?'Browser recovery saved':'Saving browser recovery…'}</span><span className={`bs-presentation-save-state ${deck.cloudSavedVersion===deck.updatedAt?'is-saved':''}`}>{deck.cloudSavedVersion===deck.updatedAt?`Saved · ${new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(deck.cloudSavedAt))}`:deck.cloudRevision?'Unsaved changes':'Not saved to site yet'}</span><button className="bs-primary" disabled={busy} title="Save presentation (Ctrl/⌘ S)" onClick={cloudSave}>{busy?'Working…':'Save presentation'}</button><button disabled={busy} onClick={cloudOpen}>Saved presentations</button><button onClick={()=>setModal('files')}>Decks & export</button><button onClick={()=>setModal('preflight')}>Pre-show check</button><button onClick={()=>setModal('help')} aria-label="Studio help">Help</button></div></div>
    {store.storageError&&<div className="bs-warning" role="alert">{store.storageError}</div>}
    {notice&&<div className="bs-notice" role="status"><span>{notice}</span><button onClick={()=>setNotice('')} aria-label="Dismiss message">Dismiss</button></div>}
    <div className="bs-workspace">
      <aside className="bs-filmstrip"><div className="bs-panel-heading"><strong>Sequence</strong><span>{deck.slides.length} slides · {fmt(totalDuration(deck))}</span></div><input aria-label="Find a slide" value={slideSearch} onChange={e=>setSlideSearch(e.target.value)} placeholder="Find a slide…"/><div className="bs-sequence-tools"><button onClick={()=>setModal('templates')}>+ Add slide</button><button onClick={()=>{setReplaceIndex(null);setModal('photos');}}>+ Photos</button></div><div className="bs-slide-list-scroll">
        {deck.slides.map((s,i)=>({s,i})).filter(({s})=>!slideSearch||`${s.title} ${s.layout} ${s.notes}`.toLowerCase().includes(slideSearch.toLowerCase())).map(({s,i})=><button key={s.id} draggable aria-current={s.id===slide.id?'step':undefined} className={`bs-slide-tile ${s.id===slide.id?'is-selected':''}`} onClick={()=>setSelectedId(s.id)} onDragStart={e=>{setDragId(s.id);e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',s.id);}} onDragEnd={()=>setDragId(null)} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const from=deck.slides.findIndex(x=>x.id===(dragId||e.dataTransfer.getData('text/plain')));if(from!==-1&&from!==i)move(from,i);setDragId(null);}}><div className="bs-thumb-wrap"><SlideCanvas slide={s} deck={deck} index={i} thumbnail/></div><div className="bs-tile-caption"><span>{String(i+1).padStart(2,'0')}</span><strong>{s.title||LAYOUTS.find(l=>l.id===s.layout)?.label}</strong><span>{s.duration}s</span></div></button>)}
      </div><small className="bs-strip-hint">Drag to reorder. Arrow buttons work too.</small></aside>
      <section className="bs-stage-area"><div className="bs-stage-toolbar"><div className="bs-row"><button onClick={undo} disabled={!store.canUndo} title="Undo (Ctrl/⌘ Z)">Undo</button><button onClick={redo} disabled={!store.canRedo}>Redo</button></div><span>Slide {index+1} / {deck.slides.length} · 16:9</span><button onClick={()=>setPlayer(index)}>Preview here</button></div><div className="bs-canvas-wrap"><SlideCanvas slide={slide} deck={deck} index={index}/></div><div className="bs-row bs-slide-actions"><button onClick={()=>move(index,index-1)} disabled={index===0}>Move earlier</button><button onClick={()=>move(index,index+1)} disabled={index===deck.slides.length-1}>Move later</button><button onClick={duplicateSlide}>Duplicate slide</button><button className="bs-danger" onClick={deleteSlide} disabled={deck.slides.length===1}>Delete slide</button></div>
        {hasLongText&&<p className="bs-warning">This slide has a lot of text. Reduce the title size or split the content across slides, then check the preview.</p>}
        <div className="bs-notes-editor"><Field label="Speaker notes · never shown on the slide"><textarea value={slide.notes} rows={3} placeholder="Cues, names, pronunciation, and reminders for this moment…" onChange={e=>editSlide({notes:e.target.value})}/></Field></div>
        <div className="bs-deck-summary"><div><strong>{fmt(totalDuration(deck))}</strong><span>Autoplay runtime</span></div><div><strong>{usedIds.length}</strong><span>Photo placements</span></div><div><strong>{missing?`${missing} empty`:'Ready to rehearse'}</strong><span>{missing?'Photo slots still to fill':'Preview before ball night'}</span></div></div>
      </section>
      <aside className="bs-inspector"><div className="bs-inspector-tabs" role="tablist" aria-label="Slide settings">{['content','design','playback'].map(t=><button key={t} role="tab" aria-selected={inspector===t} onClick={()=>setInspector(t)}>{t}</button>)}</div>
      {inspector==='content'&&<div className="bs-inspector-body">
        <Field label="Slide layout"><select value={slide.layout} onChange={e=>editSlide({layout:e.target.value})}>{LAYOUTS.map(l=><option key={l.id} value={l.id}>{l.label}</option>)}</select></Field>
        <Field label="Eyebrow / chapter"><input maxLength={200} value={slide.eyebrow} onChange={e=>editSlide({eyebrow:e.target.value})}/></Field>
        <Field label="Title"><textarea maxLength={500} rows={3} value={slide.title} onChange={e=>editSlide({title:e.target.value})}/></Field>
        <Field label={['agenda','recognition'].includes(slide.layout)?'Program / recipients · one per line':'Subtitle / body'}><textarea rows={5} value={slide.subtitle} onChange={e=>editSlide({subtitle:e.target.value})}/></Field>
        {expectedPhotos>0&&<><div className="bs-panel-heading"><strong>Photos</strong><span>{Math.min(slide.photos.filter(Boolean).length,expectedPhotos)} / {expectedPhotos}</span></div>{Array.from({length:expectedPhotos},(_,i)=><div className="bs-image-slot" key={i}>{slide.photos[i]?<img src={slide.photos[i].thumb||slide.photos[i].url} alt={slide.photos[i].caption||`Photo ${i+1}`}/>:<div className="bs-slot-empty">{i+1}</div>}<div><button onClick={()=>{setReplaceIndex(i);setModal('photos');}}>{slide.photos[i]?'Replace':'Choose photo'}</button>{slide.photos[i]&&<button onClick={()=>{const next=[...slide.photos];next.splice(i,1);editSlide({photos:next});}}>Remove</button>}{i>0&&slide.photos[i]&&<button onClick={()=>{const next=[...slide.photos];[next[i-1],next[i]]=[next[i],next[i-1]];editSlide({photos:next});}}>Swap earlier</button>}</div></div>)}</>}
        <button className="bs-primary" onClick={()=>{setReplaceIndex(null);setModal('photos');}}>Create slides from library</button>
      </div>}
      {inspector==='design'&&<div className="bs-inspector-body">
        <Field label="Deck theme · applies to all slides"><select value={deck.theme} onChange={e=>edit(d=>({...d,theme:e.target.value}))}>{Object.entries(THEMES).map(([id,t])=><option key={id} value={id}>{t.name}</option>)}</select></Field>
        <div className="bs-theme-swatches">{Object.entries(THEMES).map(([id,t])=><button key={id} onClick={()=>edit(d=>({...d,theme:id}))} aria-label={t.name} aria-pressed={deck.theme===id} style={{background:t.background,color:t.accent}}>Aa</button>)}</div>
        <Field label="Title typeface"><select value={slide.font} onChange={e=>editSlide({font:e.target.value})}>{['Oswald','Inter','Fraunces'].map(f=><option key={f}>{f}</option>)}</select></Field>
        <Field label={`Title size · ${slide.titleSize}`}><input type="range" min={30} max={120} value={slide.titleSize} onChange={e=>editSlide({titleSize:Number(e.target.value)})}/></Field>
        <Field label="Text alignment"><select value={slide.align} onChange={e=>editSlide({align:e.target.value})}>{['left','center','right'].map(a=><option key={a}>{a}</option>)}</select></Field>
        {expectedPhotos>0&&<><Field label="Image fit"><select value={slide.fit} onChange={e=>editSlide({fit:e.target.value})}><option value="cover">Fill frame (crop)</option><option value="contain">Show entire photo</option></select></Field><Field label={`Crop focus · horizontal ${slide.focalX}%`}><input type="range" min={0} max={100} value={slide.focalX} onChange={e=>editSlide({focalX:Number(e.target.value)})}/></Field><Field label={`Crop focus · vertical ${slide.focalY}%`}><input type="range" min={0} max={100} value={slide.focalY} onChange={e=>editSlide({focalY:Number(e.target.value)})}/></Field><button onClick={()=>editSlide({focalX:50,focalY:50})}>Center crop</button></>}
        {slide.layout==='photo'&&<Field label={`Photo darkening · ${slide.overlay}%`}><input type="range" min={0} max={90} value={slide.overlay} onChange={e=>editSlide({overlay:Number(e.target.value)})}/></Field>}
        {expectedPhotos>0&&<><Field label="Photo motion · presentation only"><select value={slide.motion||'none'} onChange={e=>editSlide({motion:e.target.value})}><option value="none">Still image</option><option value="zoom">Gentle push in</option><option value="pan">Slow cinematic pan</option></select></Field><p className="bs-muted">Motion applies to cropped images during playback. Fit mode keeps the entire photo visible.</p></>}
        {slide.layout==='photo'&&<Field label="Photo framing"><select value={slide.frame||'edge'} onChange={e=>editSlide({frame:e.target.value})}><option value="edge">Edge to edge</option><option value="matte">Gallery matte</option></select></Field>}
        <label className="bs-check"><input type="checkbox" checked={deck.showNumbers} onChange={e=>edit(d=>({...d,showNumbers:e.target.checked}))}/>Show slide numbers</label>
      </div>}
      {inspector==='playback'&&<div className="bs-inspector-body">
        <Field label="Time on this slide (seconds)"><input type="number" min={1} max={600} value={slide.duration} onChange={e=>editSlide({duration:Math.max(1,Math.min(600,Number(e.target.value)||1))})}/></Field><button onClick={()=>edit(d=>({...d,slides:d.slides.map(s=>({...s,duration:slide.duration}))}))}>Apply timing to every slide</button>
        <Field label="Entrance transition"><select value={slide.transition} onChange={e=>editSlide({transition:e.target.value})}><option value="fade">Fade in</option><option value="rise">Rise in</option><option value="cut">Instant cut</option></select></Field><button onClick={()=>edit(d=>({...d,slides:d.slides.map(s=>({...s,transition:slide.transition}))}))}>Apply transition to all slides</button>
        <label className="bs-check"><input type="checkbox" checked={deck.loop} onChange={e=>edit(d=>({...d,loop:e.target.checked}))}/>Loop presentation continuously</label><p className="bs-muted">Shows open in manual mode. Turn on autoplay when you’re ready. Blackout pauses the timer.</p><button className="bs-primary" onClick={()=>setPlayer(0)}>Rehearse the whole deck</button>
      </div>}
      </aside>
    </div>
    {modal==='preflight'&&<StudioPreflight deck={deck} onClose={closeModal} onSelect={setSelectedId}/>}
    {modal==='templates'&&<StudioModal title="Start with a layout" onClose={closeModal} wide><p className="bs-muted">Every layout is editable. New slides are inserted after the selected slide.</p><div className="bs-template-grid">{LAYOUTS.map(l=><button key={l.id} onClick={()=>addSlide(l.id)}><SlideCanvas slide={makeSlide(l.id)} deck={deck} thumbnail/><strong>{l.label}</strong><small>{l.hint}</small></button>)}</div></StudioModal>}
    {modal==='photos'&&<StudioPhotoPicker onClose={closeModal} onAdd={photosAdded} replace={replaceIndex!==null} usedIds={usedIds}/>}
    {modal==='files'&&<StudioModal title="Decks & export" onClose={closeModal}><div className="bs-modal-section"><Field label="Decks saved in this browser"><select value={deck.id} onChange={e=>{store.switchDeck(e.target.value);}}>{decks.map(d=><option value={d.id} key={d.id}>{d.name}</option>)}</select></Field><div className="bs-row"><button onClick={()=>{const next=makeDeck();store.addDeck(next);setSelectedId(next.slides[0].id);closeModal();}}>New deck</button><button onClick={()=>{duplicateDeck();closeModal();}}>Duplicate deck</button></div></div><div className="bs-modal-section"><h3>Ball-night backup</h3><p>Download a standalone presentation with every photo and font embedded. Play it directly in a browser, even without internet. Use its Print / PDF control for a handout.</p><button className="bs-primary" onClick={portable} disabled={busy}>{busy?'Packing presentation…':'Download offline presentation'}</button></div><div className="bs-modal-section"><h3>Editable deck backup</h3><p>Save the slide structure as JSON. Photo links remain connected to the library. Importing creates a new deck.</p><div className="bs-row"><button onClick={()=>downloadFile(`${fileName(deck.name)}.ball-deck.json`,JSON.stringify(deck,null,2),'application/json')}>Download deck JSON</button><button onClick={()=>importRef.current.click()}>Import deck JSON</button></div></div></StudioModal>}
    {modal==='cloud'&&<StudioModal title="Saved presentations" onClose={closeModal}>
      <p className="bs-muted">Open a presentation, keep editing, and use Save presentation to save changes to the same deck. Any different local work is preserved as a recovery copy.</p>
      <input className="bs-saved-search" aria-label="Search saved presentations" placeholder="Find a presentation…" value={savedSearch} onChange={e=>setSavedSearch(e.target.value)}/>
      <div className="bs-modal-section"><h3>Saved to the site</h3>
        {busy&&<p className="bs-muted" role="status">Loading saved presentations…</p>}
        {savedListError&&<div className="bs-warning" role="alert">{savedListError}<button onClick={cloudOpen}>Retry</button></div>}
        {cloudRows.filter(row=>(row.value?.name||'').toLowerCase().includes(savedSearch.toLowerCase())).map(row=><button className="bs-cloud-deck" key={row.key} onClick={()=>{try{store.openCloud(row);setSelectedId('');setSlideSearch('');setNotice('Opened saved presentation. Edit any slide, then choose Save presentation to save your changes.');closeModal();}catch(e){setSavedListError(e.message);}}}><strong>{row.value?.name||'Untitled presentation'}</strong><span>{row.value?.slides?.length||0} slides · Saved {new Date(row.updated_at).toLocaleString()}</span><small>Open to edit →</small></button>)}
        {!busy&&!savedListError&&!cloudRows.length&&<p className="bs-empty">No presentations saved to the site yet. Name your deck and choose Save presentation.</p>}
        {!busy&&cloudRows.length>0&&!cloudRows.some(row=>(row.value?.name||'').toLowerCase().includes(savedSearch.toLowerCase()))&&<p className="bs-muted">No saved presentations match this search.</p>}
      </div>
      <div className="bs-modal-section"><h3>Drafts in this browser</h3><p className="bs-muted">Automatic recovery copies on this device. Save a draft to the site to reopen it from another S-6 device.</p>
        {decks.filter(d=>d.name.toLowerCase().includes(savedSearch.toLowerCase())).map(d=><button className="bs-cloud-deck" key={d.id} onClick={()=>{store.switchDeck(d.id);setSelectedId(d.slides[0].id);setSlideSearch('');closeModal();}}><strong>{d.name||'Untitled presentation'}</strong><span>{d.slides.length} slides · {d.cloudSavedVersion===d.updatedAt?'Saved to site':d.cloudRevision?'Local changes to save':'Browser draft'}</span><small>Continue editing →</small></button>)}
      </div>
    </StudioModal>}
    {modal==='help'&&<StudioModal title="Your ball-night toolkit" onClose={closeModal}><div className="bs-help"><h3>Build the story</h3><p>Add title, chapter, photo, two-photo, four-photo, quote, program, recognition and closing slides. Drag thumbnails to reorder. Duplicate any slide to reuse its styling.</p><h3>Use the whole photo archive</h3><p>Filter by event, team or collection. Select photos in the order you want. Create individual slides or group them into pairs and collages. Choose replacement photos in the Content panel.</p><h3>Save and recover</h3><p>Browser recovery saves automatically on this device. Choose Save presentation to save your deck to the site. Open Saved presentations to continue editing later, then save again to update the same presentation. Saves detect conflicts; duplicate your deck to preserve a separate version. Download JSON for an editable backup.</p><h3>Run the room</h3><p>Present from the beginning or preview the selected slide. Arrow keys and Space advance; P toggles autoplay; B blacks out the screen; N shows notes. Use Full screen to hide the browser. Controls fade until you move over them.</p><h3>Control the TV from your seat</h3><p>In playback, choose Connect phone. Scan the private QR link on your phone, then close the pairing panel on the TV. The phone has current and next slide previews, private speaker notes, autoplay, blackout, and a slide jump. Both devices need internet. Stop remote revokes the link; closing playback ends the session.</p><h3>Prepare for the evening</h3><p>Fill empty photo slots, check title lengths and crops, and rehearse on the actual projector. Download the offline presentation while online. Speaker notes are visible on the playback screen when enabled; keep them hidden for the audience.</p><p>Editing shortcuts: Ctrl/⌘ Z to undo, Ctrl/⌘ Shift Z to redo, Ctrl/⌘ D to duplicate the selected slide.</p></div></StudioModal>}
    <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={importDeck}/>
    {player!==null&&<StudioPlayer deck={deck} startIndex={player} onClose={closePlayer}/>}
  </div>;
  return expanded?createPortal(content,document.body):content;
}
