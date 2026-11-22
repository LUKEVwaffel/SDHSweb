import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { NAV_GROUPS, groupIcon } from './navItems';
import NavIcon from './NavIcon';
import ToolSearch from './ToolSearch';
import './sidebar.css';

const ROLE_TAG={s6:'S-6 · Net control',s5:'S-5 · Operations',bc:'Battalion command'};

export default function Sidebar({active,allowed=null,role='s6',adminId,onLogout,band='desktop',manualCollapsed=false,onToggleCollapsed,drawerOpen=false,onCloseDrawer}) {
  const navigate=useNavigate();
  const [menu,setMenu]=useState(null);
  const [searchOpen,setSearchOpen]=useState(false);
  const panelRef=useRef(null);
  const menuRef=useRef(null);
  const triggerRef=useRef(null);
  const searchRef=useRef(null);
  const collapsed=band!=='phone' && manualCollapsed;
  const mode=band==='phone'?'drawer':collapsed?'rail':'expanded';
  const groups=(allowed ? NAV_GROUPS.map(group=>({...group,items:group.items.filter(item=>allowed.includes(item.id))})).filter(group=>group.items.length) : NAV_GROUPS).filter(group=>group.heading!=='ACCOUNT');
  const canAccount=!allowed || allowed.includes('account');
  const goTo=id=>{setMenu(null);setSearchOpen(false);navigate(`/admin/${id}`);if(mode==='drawer')onCloseDrawer?.();};
  useEffect(()=>{
    const onKey=event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();setMenu(null);setSearchOpen(open=>!open);}if(event.key==='Escape'){setMenu(null);onCloseDrawer?.();triggerRef.current?.focus();}};
    window.addEventListener('keydown',onKey);
    return()=>window.removeEventListener('keydown',onKey);
  },[onCloseDrawer]);
  useEffect(()=>{
    if(!menu)return;
    const outside=event=>{if(!menuRef.current?.contains(event.target)&&!panelRef.current?.contains(event.target))setMenu(null);};
    const resize=()=>setMenu(null);
    window.addEventListener('pointerdown',outside);
    window.addEventListener('resize',resize);
    menuRef.current?.querySelector('[role="menuitem"]')?.focus();
    return()=>{window.removeEventListener('pointerdown',outside);window.removeEventListener('resize',resize);};
  },[menu]);
  const openGroup=(group,event)=>{
    if(menu?.heading===group.heading){setMenu(null);return;}
    triggerRef.current=event.currentTarget;
    const rect=event.currentTarget.getBoundingClientRect();
    const height=68+group.items.length*46;
    const mobile=mode==='drawer';
    setMenu({...group,top:Math.max(12,Math.min(rect.top,window.innerHeight-height-12)),left:mobile?20:(collapsed?96:280),mobile});
  };
  const displayName=(adminId || role).split('@')[0];
  const searchGroups=canAccount?[...groups,{heading:'ACCOUNT',items:[{id:'account',label:'My Account'}]}]:groups;
  return <>
    {mode==='drawer'&&drawerOpen&&<button className="dispatch-sidebar-scrim" aria-label="Close navigation" onClick={onCloseDrawer}/>}
    <aside ref={panelRef} className={`dispatch-sidebar is-${mode} ${drawerOpen?'is-open':''}`} aria-label="Dispatch navigation" inert={mode==='drawer'&&!drawerOpen?true:undefined}>
      <header className="dispatch-sidebar-brand">
        <button className="dispatch-brand-mark" aria-label={collapsed?'Expand sidebar':'Go to Dispatch AI'} title={collapsed?'Expand sidebar':'Dispatch AI'} onClick={()=>{setMenu(null);if(collapsed)onToggleCollapsed?.();else goTo(allowed?.includes('ai')||!allowed?'ai':allowed[0]);}}><span/></button>
        {!collapsed&&<><div className="dispatch-brand-copy"><strong>DISPATCH</strong><span>Trojan Battalion</span></div><button className="dispatch-icon-button dispatch-collapse" aria-label={mode==='drawer'?'Close navigation':'Collapse sidebar'} title={mode==='drawer'?'Close navigation':'Collapse sidebar'} onClick={()=>{setMenu(null);if(mode==='drawer')onCloseDrawer?.();else onToggleCollapsed?.();}}><NavIcon name={mode==='drawer'?'close':'panel'} size={17}/></button></>}
      </header>
      <button ref={searchRef} className="dispatch-sidebar-search" aria-label="Search tools" title="Search tools (⌘K / Ctrl+K)" onClick={()=>{setMenu(null);setSearchOpen(true);}}><NavIcon name="search"/>{!collapsed&&<><span>Search tools</span><kbd>⌘ K</kbd></>}</button>
      <nav className="dispatch-sidebar-navigation" aria-label="Tools">
        {groups.filter(group=>!group.heading).flatMap(group=>group.items).map(item=><button key={item.id} className={`dispatch-nav-item ${active===item.id?'is-active':''}`} aria-label={item.label} aria-current={active===item.id?'page':undefined} title={collapsed?item.label:undefined} onClick={()=>goTo(item.id)}><NavIcon name={item.id}/>{!collapsed&&<span>{item.label}</span>}{!collapsed&&active===item.id&&<i/>}</button>)}
        <div className="dispatch-nav-divider"/>
        {!collapsed&&<div className="dispatch-nav-caption">WORKSPACE</div>}
        {groups.filter(group=>group.heading).map(group=>{
          const activeItem=group.items.find(item=>item.id===active);
          return <button key={group.heading} className={`dispatch-nav-item dispatch-nav-group ${activeItem?'is-active-group':''} ${menu?.heading===group.heading?'is-menu-open':''}`} aria-label={group.heading.toLowerCase().replace(/\b\w/g,char=>char.toUpperCase())} aria-haspopup="menu" aria-expanded={menu?.heading===group.heading} title={collapsed?`${group.heading}${activeItem?`: ${activeItem.label}`:''}`:undefined} onClick={event=>openGroup(group,event)}><NavIcon name={groupIcon(group.heading)}/>{!collapsed&&<><span>{group.heading.toLowerCase().replace(/\b\w/g,char=>char.toUpperCase())}{activeItem&&<small>{activeItem.label}</small>}</span><NavIcon name="chevron" size={13}/></>}</button>;
        })}
      </nav>
      <footer className="dispatch-sidebar-footer">
        <button className={`dispatch-profile ${active==='account'?'is-active':''}`} aria-label="My Account" title={collapsed?`${displayName} · My Account`:undefined} disabled={!canAccount} onClick={()=>goTo('account')}><span className="dispatch-avatar">{role.toUpperCase().replace('S','S-')}</span>{!collapsed&&<span className="dispatch-profile-copy"><strong>{displayName}</strong><small>{ROLE_TAG[role]||role}</small></span>}</button>
        <button className="dispatch-signout" aria-label="Sign out" title="Sign out" onClick={onLogout}><NavIcon name="signout" size={17}/>{!collapsed&&<span>Sign out</span>}</button>
      </footer>
    </aside>
    {menu&&createPortal(<section ref={menuRef} className={`dispatch-section-menu ${menu.mobile?'is-mobile':''}`} style={{top:menu.top,left:menu.left}} aria-label={`${menu.heading.toLowerCase()} tools`} onKeyDown={event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setMenu(null);triggerRef.current?.focus();}
      if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();const buttons=[...event.currentTarget.querySelectorAll('[role="menuitem"]')];const index=buttons.indexOf(document.activeElement);buttons[(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}
    }}><header><div><span>WORKSPACE</span><strong>{menu.heading.toLowerCase().replace(/\b\w/g,char=>char.toUpperCase())}</strong></div><button className="dispatch-icon-button" aria-label="Close section menu" onClick={()=>{setMenu(null);triggerRef.current?.focus();}}><NavIcon name="close" size={16}/></button></header><div role="menu">{menu.items.map(item=><button role="menuitem" key={item.id} className={`dispatch-section-link ${active===item.id?'is-active':''}`} onClick={()=>goTo(item.id)}><span>{item.label}</span><NavIcon name="arrow" size={16}/></button>)}</div></section>,document.body)}
    {searchOpen&&<ToolSearch groups={searchGroups} onNavigate={goTo} onClose={()=>{setSearchOpen(false);searchRef.current?.focus();}}/>}
  </>;
}
