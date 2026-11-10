import { renderToStaticMarkup } from 'react-dom/server';
import SlideCanvas from './SlideCanvas';
import slideCss from './slideCanvas.css?raw';
import playbackSource from '../../../../../lib/ballPlayback.js?raw';
import { downloadFile, fileName } from '../../../../../lib/ballPresentation';

const escape = s => s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function dataUrl(url) {
  const response=await fetch(url);
  if(!response.ok)throw new Error(`Could not download a photo (${response.status}).`);
  const blob=await response.blob();
  if(!blob.type.startsWith('image/') || blob.type==='image/svg+xml')throw new Error('A library item is not a supported image. Replace it before exporting.');
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Could not read a photo.'));reader.readAsDataURL(blob);});
}
export async function exportPresentation(deck,onProgress) {
  const images=new Map();
  const urls=[...new Set(deck.slides.flatMap(s=>s.photos.filter(Boolean).map(p=>p.url)))];
  for(let i=0;i<urls.length;i+=4){await Promise.all(urls.slice(i,i+4).map(async url=>{images.set(url,await dataUrl(url));onProgress(`Packing photos ${images.size}/${urls.length}…`);}));}
  const fontFiles=[['Oswald','/fonts/oswald-600.woff2'],['Inter','/fonts/inter-400.woff2'],['Fraunces','/fonts/fraunces-var.woff2'],['JetBrains Mono','/fonts/jbmono-400.woff2']];
  const fonts=await Promise.all(fontFiles.map(async([family,url])=>{const response=await fetch(url);if(!response.ok)throw new Error('A presentation font could not be downloaded.');const blob=await response.blob();const encoded=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});return `@font-face{font-family:'${family}';src:url('${encoded}') format('woff2');font-weight:100 900;font-display:swap;}`;}));
  const slides=deck.slides.map((s,i)=>`<section class="bs-export-slide" data-duration="${s.duration}" data-transition="${s.transition}"${i?' hidden':''}>${renderToStaticMarkup(<SlideCanvas slide={{...s,photos:s.photos.map(p=>p?({...p,url:images.get(p.url)}):null)}} deck={deck} index={i} presenting/>)}</section>`).join('');
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(deck.name)}</title><style>${fonts.join('')}\n${slideCss}
html,body{margin:0;background:#000;color:white;font-family:Inter,sans-serif}body{height:100dvh;display:grid;place-items:center;overflow:hidden}.bs-export-slide{width:min(100vw,177.7778dvh)}[hidden]{display:none!important}.bs-export-controls{position:fixed;bottom:10px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:8px;background:#111e;padding:10px;border-radius:8px;opacity:0;transition:opacity .2s;max-width:95vw;flex-wrap:wrap}.bs-export-controls:hover,.bs-export-controls:focus-within{opacity:1}button{padding:10px;background:#26334a;color:#fff;border:1px solid #667;cursor:pointer}#status{font-size:12px}.blackout .bs-export-slide{visibility:hidden}@media print{body{display:block;height:auto;overflow:visible}.bs-export-slide[hidden]{display:block!important}.bs-export-slide{width:100vw;page-break-after:always}.bs-export-controls{display:none!important}}
</style></head><body>${slides}<nav class="bs-export-controls" aria-label="Presentation controls"><button id="prev">Previous</button><span id="status"></span><button id="next">Next</button><button id="play">Autoplay</button><button id="black">Blackout</button><button id="full">Full screen</button><button id="print">Print / PDF</button></nav><script>
${playbackSource.replace(/^export /gm,'')}
const slides=[...document.querySelectorAll('.bs-export-slide')];let state=createPlayback(slides.map(s=>Number(s.dataset.duration)),0,${JSON.stringify(deck.loop)}),timer,lastVisit=-1;
function schedule(){clearTimeout(timer);if(state.playing&&!state.blackout)timer=setTimeout(()=>send({type:'tick'}),Math.max(1,remainingTime(state)))}
function render(){slides.forEach((s,i)=>{s.hidden=i!==state.index;if(i===state.index&&lastVisit!==state.visit){s.classList.remove('bs-animate-fade','bs-animate-rise');void s.offsetWidth;s.classList.add('bs-animate-'+s.dataset.transition)}});lastVisit=state.visit;document.body.classList.toggle('blackout',state.blackout);document.getElementById('status').textContent=(state.index+1)+' / '+slides.length;document.getElementById('play').textContent=state.playing?'Pause':'Autoplay';document.getElementById('black').textContent=state.blackout?'Show slides':'Blackout';schedule()}
function send(action){state=playbackAction(state,action);render()}
document.getElementById('prev').onclick=()=>send({type:'previous'});document.getElementById('next').onclick=()=>send({type:'next'});document.getElementById('play').onclick=()=>send({type:'toggle-play'});document.getElementById('black').onclick=()=>send({type:'blackout'});document.getElementById('full').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});else document.documentElement.requestFullscreen().catch(()=>alert('Use your browser full-screen control.'))};document.getElementById('print').onclick=()=>window.print();document.addEventListener('keydown',e=>{if(['ArrowRight','PageDown',' '].includes(e.key)){e.preventDefault();send({type:'next'})}if(['ArrowLeft','PageUp'].includes(e.key)){e.preventDefault();send({type:'previous'})}if(e.key.toLowerCase()==='p')send({type:'toggle-play'});if(e.key.toLowerCase()==='b')send({type:'blackout'});if(e.key==='Home')send({type:'restart'});if(e.key==='End')send({type:'goto',index:slides.length-1})});render();
</script></body></html>`;
  downloadFile(`${fileName(deck.name)}.html`,html,'text/html');
}
