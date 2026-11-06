import { useId, useState } from 'react';
import NavIcon from '../../nav/NavIcon';

const KEY='dispatch.ai.history-view';
function compactDate(value) {
  if(!value)return '';
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return '';
  const today=new Date();
  return date.toDateString()===today.toDateString()
    ? date.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})
    : date.toLocaleDateString([], {month:'short',day:'numeric'});
}
export default function ConversationHistory({conversations,onOpenConversation}) {
  const [mode,setMode]=useState(()=>{try{return localStorage.getItem(KEY)||'collapsed';}catch{return 'collapsed';}});
  const [query,setQuery]=useState('');
  const listId=useId();
  const open=mode!=='collapsed';
  const changeMode=next=>{setMode(next);try{localStorage.setItem(KEY,next);}catch{/* Storage may be unavailable. */}};
  const filtered=conversations.filter(conversation=>(conversation.title||'Untitled conversation').toLowerCase().includes(query.toLowerCase()));
  const visible=mode==='all'?filtered:conversations.slice(0,3);
  return <section className={`dispatch-history ${open?'is-open':''}`} aria-label="Conversation history">
    <button className="dispatch-history-toggle" aria-expanded={open} aria-controls={listId} onClick={()=>changeMode(open?'collapsed':'recent')}>
      <span className="dispatch-history-icon"><NavIcon name="history" size={17}/></span>
      <span className="dispatch-history-title"><strong>Conversation history</strong><small>{conversations.length ? `${conversations.length} saved conversation${conversations.length===1?'':'s'}` : 'Your conversations, kept here'}</small></span>
      <span className="dispatch-history-toggle-label">{open?'Collapse':'Expand'}</span><NavIcon className="dispatch-history-chevron" name="chevron" size={14}/>
    </button>
    {open&&<div id={listId} className="dispatch-history-body">
      {mode==='all'&&conversations.length>3&&<div className="dispatch-history-search"><NavIcon name="search" size={15}/><input aria-label="Search conversation history" placeholder="Find a conversation…" value={query} onChange={event=>setQuery(event.target.value)}/></div>}
      {visible.length ? <div className="dispatch-history-list">{visible.map(conversation=><button key={conversation.id} className="dispatch-history-row" onClick={()=>onOpenConversation(conversation.id)} title={conversation.title||'Untitled conversation'}>
        <span>{conversation.title||'Untitled conversation'}</span><time dateTime={conversation.updated_at}>{compactDate(conversation.updated_at)}</time><NavIcon name="arrow" size={14}/>
      </button>)}</div> : <p className="dispatch-history-empty">{query?'No matching conversations.':'Ask something above to start your first conversation.'}</p>}
      {conversations.length>3&&<div className="dispatch-history-footer"><span>{mode==='all'?`${filtered.length} conversation${filtered.length===1?'':'s'}`:'Your three most recent conversations'}</span><button onClick={()=>{setQuery('');changeMode(mode==='all'?'recent':'all');}}>{mode==='all'?'Show recent':`View all ${conversations.length}`}<NavIcon name="arrow" size={13}/></button></div>}
    </div>}
  </section>;
}
