import { supabase as SB } from './supabaseClient';

const base=import.meta.env.VITE_SUPABASE_URL.replace(/\/$/,'');
const api=base+'/functions/v1/ball-photo-central';
export const PHOTO_BUCKET='ball-photo-central';
export const PHOTO_LIMIT=100*1024*1024;
export const BALL_EVENT_ID='e879b7f6-1789-4f72-ab92-21573da9c42a';
export const PHOTO_CENTRAL='/ballphotos';
export const PHOTO_DESK='/ballphotos/upload';
export const photoLink=(action, params={})=>api+'?'+new URLSearchParams({action,...params});

async function read(response) {
  const value=await response.json();
  if (!response.ok) throw new Error(value.error||'The request could not be completed.');
  return value;
}
export async function photoDesk(action, payload={}, uploadToken='') {
  const headers={'Content-Type':'application/json',apikey:import.meta.env.VITE_SUPABASE_ANON_KEY};
  if(uploadToken)headers['x-ball-upload']=uploadToken;
  else if(action!=='unlock'&&action!=='vote'){
    const {data}=await SB.auth.getSession();
    if(data.session?.access_token)headers.Authorization='Bearer '+data.session.access_token;
  }
  return read(await fetch(api,{method:'POST',headers,body:JSON.stringify({action,...payload})}));
}
export async function loadGallery(offset=0, signal) {
  return read(await fetch(photoLink('gallery',{offset}),{signal}));
}

export function zipParts(items) {
  const parts=[];
  let remaining=0;
  for(const item of items){
    if(!parts.length||parts.at(-1).length>=24||remaining+item.bytes>48*1024*1024){parts.push([]);remaining=0;}
    parts.at(-1).push(item.id);
    remaining+=item.bytes;
  }
  return parts;
}
