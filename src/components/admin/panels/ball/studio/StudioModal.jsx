import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
export default function StudioModal({ title, children, onClose, wide = false }) {
  const ref=useRef();
  useEffect(()=>{
    const previous=document.activeElement;
    ref.current?.querySelector('button,input,select,textarea')?.focus();
    const key=e=>{
      if(e.key==='Escape'){e.stopPropagation();onClose();}
      if(e.key==='Tab'){
        const items=[...ref.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')];
        const first=items[0],last=items.at(-1);
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
      }
    };
    document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);previous?.focus();};
  },[onClose]);
  return createPortal(<div className="bs-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section ref={ref} className={`ball-studio bs-modal ${wide?'bs-modal-wide':''}`} role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button onClick={onClose} aria-label="Close dialog">Close</button></header>{children}</section></div>,document.body);
}
