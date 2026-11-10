import {LAYOUTS} from './ballPresentation.js';
export async function auditPresentation(deck, probe) {
  const issues=[];
  const photos=new Map();
  deck.slides.forEach((s,index)=>{
    const count=LAYOUTS.find(l=>l.id===s.layout)?.photos||0;
    for(let i=0;i<count;i++){if(!s.photos[i]?.url)issues.push({index,kind:'missing',message:`Photo slot ${i+1} is empty.`});else{const url=s.photos[i].url;if(!photos.has(url))photos.set(url,[]);photos.get(url).push(index);}}
    if(['title','section','quote','agenda','recognition','closing'].includes(s.layout)&&!s.title.trim())issues.push({index,kind:'text',message:'This text layout has no title.'});
    if(s.title.length>140||s.subtitle.length>700||s.subtitle.split('\n').length>8)issues.push({index,kind:'text',message:'Long text may overflow. Review the title size and line breaks.'});
  });
  const urls=[...photos.keys()];
  for(let i=0;i<urls.length;i+=4)await Promise.all(urls.slice(i,i+4).map(async url=>{try{const {width,height}=await probe(url);if(width<1000&&height<1000)photos.get(url).forEach(index=>issues.push({index,kind:'resolution',message:`Small photo (${width} × ${height}); check sharpness on the TV.`}));}catch{photos.get(url).forEach(index=>issues.push({index,kind:'unavailable',message:'A photo could not load. Replace it or check your connection.'}));}}));
  return {issues:issues.sort((a,b)=>a.index-b.index),checkedPhotos:urls.length};
}
export function probePresentationPhoto(url) {
  return new Promise((resolve,reject)=>{const image=new Image();const timer=setTimeout(()=>{image.onload=null;image.onerror=null;image.src='';reject(new Error('Photo timed out'));},12000);image.onload=()=>{clearTimeout(timer);resolve({width:image.naturalWidth,height:image.naturalHeight});};image.onerror=()=>{clearTimeout(timer);reject(new Error('Photo unavailable'));};image.src=url;});
}
