import { useRef } from 'react';
import { THEMES, LAYOUTS } from '../../../../../lib/ballPresentation';
import './slideCanvas.css';

export default function SlideCanvas({ slide, deck, index = 0, thumbnail = false, presenting = false, onPhotoPosition, selectedPhoto = 0 }) {
  const drag = useRef(null);
  const theme = THEMES[deck.theme] || THEMES.midnight;
  const count = LAYOUTS.find(l => l.id === slide.layout)?.photos || 0;
  return <div className={`bs-slide bs-layout-${slide.layout} ${thumbnail ? 'bs-thumbnail' : ''} ${presenting ? 'bs-presenting' : ''} ${onPhotoPosition ? 'bs-positioning' : ''} bs-motion-${slide.motion || 'none'} bs-frame-${slide.frame || 'edge'}`} style={{ '--slide-bg': theme.background, '--slide-fg': theme.foreground, '--slide-accent': theme.accent, '--slide-title-size': `${slide.titleSize / 12.8}cqw`, textAlign: slide.align, '--slide-font': slide.font, '--slide-motion-duration': `${Math.max(8,slide.duration)}s` }}>
    {count > 0 && <div className="bs-slide-images">
      {Array.from({ length: count }, (_, i) => {
        const photo=slide.photos[i];
        if(!photo)return <div className="bs-image-empty" key={i}>{thumbnail?'':'Choose a photo from the library'}</div>;
        const fit=photo.fit || slide.fit;
        const x=photo.focalX ?? slide.focalX, y=photo.focalY ?? slide.focalY, zoom=photo.zoom ?? 1;
        const eventLabel=photo.eventLabel ?? photo.event ?? '';
        const src=thumbnail?(photo.thumb||photo.url):photo.url;
        return <div className={`bs-photo-frame ${onPhotoPosition?'bs-photo-editable':''} ${onPhotoPosition&&selectedPhoto===i?'bs-photo-selected':''}`} data-fit={fit} key={i}
          onPointerDown={onPhotoPosition ? e=>{
            if(e.button!==0)return;
            const img=e.currentTarget.querySelector('.bs-photo-main');
            if(!img?.naturalWidth)return;
            e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);
            const {width,height}=e.currentTarget.getBoundingClientRect();
            const scale=(fit==='contain'?Math.min:Math.max)(width/img.naturalWidth,height/img.naturalHeight);
            drag.current={id:e.pointerId,index:i,startX:e.clientX,startY:e.clientY,x,y,overflowX:img.naturalWidth*scale*zoom-width,overflowY:img.naturalHeight*scale*zoom-height};
            onPhotoPosition(i,{});
          }:undefined}
          onPointerMove={onPhotoPosition ? e=>{
            const d=drag.current;if(!d||d.id!==e.pointerId||d.index!==i)return;
            const clamp=v=>Math.max(0,Math.min(100,v));
            onPhotoPosition(i,{focalX:Math.abs(d.overflowX)>1?clamp(d.x-(e.clientX-d.startX)/d.overflowX*100):d.x,focalY:Math.abs(d.overflowY)>1?clamp(d.y-(e.clientY-d.startY)/d.overflowY*100):d.y});
          }:undefined}
          onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>

          {fit==='contain'&&<img className="bs-photo-backdrop" src={src} alt="" aria-hidden="true" loading={thumbnail?'lazy':'eager'}/>}
          <div className="bs-photo-placement" style={{transform:`scale(${zoom})`,transformOrigin:`${x}% ${y}%`}}><img draggable={false} className="bs-photo-main" src={src} loading={thumbnail?'lazy':'eager'} alt={photo.caption||''} style={{objectFit:fit,objectPosition:`${x}% ${y}%`}}/></div>
          {eventLabel&&<div className="bs-photo-event">{eventLabel}</div>}
        </div>;
      })}
    </div>}
    {slide.layout === 'photo' && slide.photos.length > 0 && <div className="bs-slide-shade" style={{ opacity: slide.overlay / 100 }} />}
    <div className="bs-slide-copy">
      {slide.eyebrow && <div className="bs-slide-eyebrow">{slide.eyebrow}</div>}
      {slide.title && <div className="bs-slide-title">{slide.layout === 'quote' && <span className="bs-quote-mark">“</span>}{slide.title}</div>}
      {slide.subtitle && (slide.layout === 'agenda' || slide.layout === 'recognition' ? <div className="bs-slide-list">{slide.subtitle.split('\n').filter(Boolean).map((line,i) => <div key={i}><span>{slide.layout === 'agenda' ? String(i + 1).padStart(2,'0') : '✦'}</span>{line}</div>)}</div> : <div className="bs-slide-subtitle">{slide.subtitle}</div>)}
    </div>
    <div className="bs-slide-footer"><span>Trojan Battalion</span>{deck.showNumbers && <span>{String(index + 1).padStart(2,'0')}</span>}</div>
  </div>;
}
