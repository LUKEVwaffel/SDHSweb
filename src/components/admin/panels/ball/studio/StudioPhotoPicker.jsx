import { useState, useMemo } from 'react';
import { useStudioPhotos } from './useStudioPhotos';
import StudioModal from './StudioModal';
export default function StudioPhotoPicker({ onClose, onAdd, replace = false, usedIds = [] }) {
  const {photos,events,warnings,loading,refresh}=useStudioPhotos();
  const [query,setQuery]=useState('');const [source,setSource]=useState('all');const [team,setTeam]=useState('all');const [event,setEvent]=useState('all');
  const [selected,setSelected]=useState([]);const [visible,setVisible]=useState(80);const [layout,setLayout]=useState('photo');const [onlyUnused,setOnlyUnused]=useState(false);const [sort,setSort]=useState('newest');
  const used=useMemo(()=>new Set(usedIds),[usedIds]);
  const filtered=useMemo(()=>{
    const q=query.toLowerCase().trim();
    return photos.filter(p=>(source==='all'||p.source===source)&&(team==='all'||p.team?.split(' ').includes(team))&&(event==='all'||p.eventId===event)&&(!onlyUnused||!used.has(p.id))&&(!q||`${p.caption} ${p.event} ${p.team} ${p.source}`.toLowerCase().includes(q))).sort((a,b)=>sort==='oldest'?String(a.date).localeCompare(String(b.date)):sort==='event'?a.event.localeCompare(b.event):String(b.date).localeCompare(String(a.date)));
  },[photos,query,source,team,event,onlyUnused,used,sort]);
  const selectedPhotos=selected.map(id=>photos.find(p=>p.id===id)).filter(Boolean);
  function toggle(id){setSelected(s=>s.includes(id)?s.filter(x=>x!==id):replace?[id]:[...s,id]);}
  function change(fn,value){fn(value);setVisible(80);}
  return <StudioModal title={replace?'Choose a replacement photo':'Your photo library'} onClose={onClose} wide>
    <p className="bs-muted">Browse the existing archive. Photos stay in their original collections. Hidden images and video files are excluded.</p>
    <div className="bs-library-filters">
      <input aria-label="Search photos" placeholder="Search event, team, caption or credit…" value={query} onChange={e=>change(setQuery,e.target.value)}/>
      <select aria-label="Photo collection" value={source} onChange={e=>change(setSource,e.target.value)}><option value="all">All collections</option>{['Photo archive','TV collection','Curated gallery','Rafting trip','Ball gallery'].map(s=><option key={s}>{s}</option>)}</select>
      <select aria-label="Photo team" value={team} onChange={e=>change(setTeam,e.target.value)}><option value="all">All teams</option>{['battalion','raiders','rifle','academic','drill'].map(t=><option key={t}>{t}</option>)}</select>
      <select aria-label="Photo event" value={event} onChange={e=>change(setEvent,e.target.value)}><option value="all">All events</option>{events.map(e=><option value={e.id} key={e.id}>{e.title}</option>)}</select>
      <select aria-label="Photo sort order" value={sort} onChange={e=>change(setSort,e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="event">By event</option></select>
    </div>
    <div className="bs-row bs-library-summary"><span>{loading?'Loading every collection…':`${filtered.length.toLocaleString()} photos · ${selected.length} selected`}</span><label className="bs-check"><input type="checkbox" checked={onlyUnused} onChange={e=>setOnlyUnused(e.target.checked)}/>Unused photos only</label><button onClick={refresh} disabled={loading}>Refresh</button>{!replace&&<button onClick={()=>setSelected(s=>[...new Set([...s,...filtered.slice(0,visible).map(p=>p.id)])])}>Select visible</button>}<button onClick={()=>setSelected([])} disabled={!selected.length}>Clear selection</button></div>
    {warnings.length>0&&<details className="bs-warning"><summary>Some library sources could not load</summary>{warnings.map(w=><p key={w}>{w}</p>)}<button onClick={refresh}>Retry collections</button></details>}
    <div className="bs-library-grid">{filtered.slice(0,visible).map(p=>{
      const chosen=selected.includes(p.id);return <button key={p.id} className={`bs-photo-tile ${chosen?'is-selected':''}`} aria-pressed={chosen} onClick={()=>toggle(p.id)} title={`${p.event} · ${p.caption}`}><img src={p.thumb} loading="lazy" alt={p.caption||p.event} onError={e=>{if(e.currentTarget.src!==p.url)e.currentTarget.src=p.url;}}/><span>{chosen?`Selected ${selected.indexOf(p.id)+1}`:used.has(p.id)?'In this deck':p.source}</span><strong>{p.event}</strong><small>{p.caption||p.team}</small></button>;
    })}</div>
    {!loading&&!filtered.length&&<div className="bs-empty">No matching photos. Try another collection, event, or search.</div>}
    {filtered.length>visible&&<button className="bs-load-more" onClick={()=>setVisible(n=>n+80)}>Load 80 more · {filtered.length-visible} remaining</button>}
    <footer className="bs-picker-footer"><div><strong>{selected.length} selected</strong><small>Selection order becomes slide order.</small></div>{!replace&&<label>Create as<select value={layout} onChange={e=>setLayout(e.target.value)}><option value="photo">One photo per slide</option><option value="split">Photo + story</option><option value="duo">Two photos per slide</option><option value="collage">Four photos per slide</option></select></label>}<button className="bs-primary" disabled={!selectedPhotos.length} onClick={()=>onAdd(selectedPhotos,layout)}>{replace?'Use this photo':'Create photo slides'}</button></footer>
  </StudioModal>;
}
