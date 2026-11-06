import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import NavIcon from './NavIcon';
import { groupIcon } from './navItems';

const KEYWORDS = { ball:'reservation guest date payment cancellation dinner', ballallergy:'food dietary', portalaccess:'login credentials staff', advanced:'settings accounts', tvremote:'television emergency broadcast', photos:'optic gallery', people:'roster cadets consent', email:'mail newsletters', boards:'rank promotions', aars:'after action reports' };
export default function ToolSearch({ groups, onNavigate, onClose }) {
  const [query,setQuery] = useState('');
  const [selected,setSelected] = useState(0);
  const inputRef = useRef(null);
  const resultRefs = useRef([]);
  const titleId = useId();
  const tools = groups.flatMap(group => group.items.map(item => ({ ...item, group:group.heading || 'DISPATCH', groupIcon:groupIcon(group.heading) })));
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const results = tools.filter(item => terms.every(term => `${item.label} ${item.group} ${KEYWORDS[item.id] || ''}`.toLowerCase().includes(term)));
  useEffect(() => { const previous=document.activeElement; inputRef.current?.focus(); return () => previous?.focus?.(); },[]);
  useEffect(() => { resultRefs.current[selected]?.scrollIntoView({block:'nearest'}); },[selected]);
  const pick = item => { if(item) { onNavigate(item.id); onClose(); } };
  return createPortal(<div className="dispatch-search-backdrop" onMouseDown={event => { if(event.target === event.currentTarget) onClose(); }}>
    <section className="dispatch-tool-search" role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={event => {
      if(event.key==='Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
      if(event.key==='ArrowDown') { event.preventDefault(); setSelected(index => Math.min(index+1,results.length-1)); }
      if(event.key==='ArrowUp') { event.preventDefault(); setSelected(index => Math.max(0,index-1)); }
      if(event.key==='Enter' && event.target===inputRef.current) { event.preventDefault(); pick(results[selected]); }
      if(event.key==='Tab') {
        const controls=[...event.currentTarget.querySelectorAll('input,button')];
        if(event.shiftKey && document.activeElement===controls[0]) {event.preventDefault(); controls.at(-1)?.focus();}
        else if(!event.shiftKey && document.activeElement===controls.at(-1)) {event.preventDefault(); controls[0]?.focus();}
      }
    }}>
      <div className="dispatch-search-input-row"><NavIcon name="search" size={21}/><input ref={inputRef} value={query} onChange={event => {setQuery(event.target.value);setSelected(0);}} aria-label="Search tools" placeholder="Where do you want to go?" autoComplete="off"/><button className="dispatch-icon-button" onClick={onClose} aria-label="Close tool search"><NavIcon name="close"/></button></div>
      <div className="dispatch-search-heading"><span id={titleId}>{query ? 'Matching tools' : 'All tools'}</span><span>{results.length}</span></div>
      <div className="dispatch-search-results">
        {results.map((item,index) => <button ref={element => {resultRefs.current[index]=element;}} key={item.id} className={`dispatch-search-result ${selected===index?'is-selected':''}`} onMouseEnter={()=>setSelected(index)} onFocus={()=>setSelected(index)} onClick={()=>pick(item)}>
          <span className="dispatch-result-icon"><NavIcon name={item.id==='ai'?'ai':item.groupIcon}/></span><span className="dispatch-result-copy"><strong>{item.label}</strong><small>{item.group==='DISPATCH'?'Workspace':item.group.toLowerCase()}</small></span><NavIcon name="arrow" size={16}/>
        </button>)}
        {!results.length && <div className="dispatch-search-empty">No tools found for “{query}”.<span>Try “ball”, “email”, or “people”.</span></div>}
      </div>
      <footer className="dispatch-search-footer"><span><kbd>↑</kbd><kbd>↓</kbd> to move <kbd>↵</kbd> to open</span><span><kbd>esc</kbd> to close</span></footer>
    </section>
  </div>,document.body);
}
