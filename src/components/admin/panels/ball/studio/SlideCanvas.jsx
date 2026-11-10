import { THEMES, LAYOUTS } from '../../../../../lib/ballPresentation';
import './slideCanvas.css';

export default function SlideCanvas({ slide, deck, index = 0, thumbnail = false, presenting = false }) {
  const theme = THEMES[deck.theme] || THEMES.midnight;
  const count = LAYOUTS.find(l => l.id === slide.layout)?.photos || 0;
  return <div className={`bs-slide bs-layout-${slide.layout} ${thumbnail ? 'bs-thumbnail' : ''} ${presenting ? 'bs-presenting' : ''} bs-motion-${slide.motion || 'none'} bs-frame-${slide.frame || 'edge'}`} style={{ '--slide-bg': theme.background, '--slide-fg': theme.foreground, '--slide-accent': theme.accent, '--slide-title-size': `${slide.titleSize / 12.8}cqw`, textAlign: slide.align, '--slide-font': slide.font, '--slide-motion-duration': `${Math.max(8,slide.duration)}s` }}>
    {count > 0 && <div className="bs-slide-images">
      {Array.from({ length: count }, (_, i) => {
        const photo=slide.photos[i];
        if(!photo)return <div className="bs-image-empty" key={i}>{thumbnail?'':'Choose a photo from the library'}</div>;
        const src=thumbnail?(photo.thumb||photo.url):photo.url;
        return <div className="bs-photo-frame" data-fit={slide.fit} key={i}>
          {slide.fit==='contain'&&<img className="bs-photo-backdrop" src={src} alt="" aria-hidden="true" loading={thumbnail?'lazy':'eager'}/>}
          <img className="bs-photo-main" src={src} loading={thumbnail?'lazy':'eager'} alt={photo.caption||''} style={{objectFit:slide.fit,objectPosition:`${slide.focalX}% ${slide.focalY}%`}}/>
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
