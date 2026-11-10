import {useState,useRef,useEffect} from 'react';
import SlideCanvas from './SlideCanvas';
/** Keep the outgoing slide beneath a fade so transitions don't flash black. */
export default function StudioSlideStage({slide,deck,index,visit=0}) {
  const last=useRef({slide,deck,index,visit});const [outgoing,setOutgoing]=useState(null);
  useEffect(()=>{
    if(last.current.visit!==visit||last.current.slide.id!==slide.id){setOutgoing(last.current);last.current={slide,deck,index,visit};const timer=setTimeout(()=>setOutgoing(null),650);return()=>clearTimeout(timer);}
    last.current={slide,deck,index,visit};
  },[slide,deck,index,visit]);
  return <div className="bs-stage-layers">{outgoing&&slide.transition==='fade'&&<div className="bs-stage-outgoing" aria-hidden="true"><SlideCanvas {...outgoing} presenting/></div>}<div key={`${slide.id}:${visit}`} className={`bs-stage-incoming bs-animate-${slide.transition}`}><SlideCanvas slide={slide} deck={deck} index={index} presenting/></div></div>;
}
