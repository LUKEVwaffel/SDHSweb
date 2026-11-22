import {useEffect} from 'react';
export function usePresentationWake(enabled=true) {
  useEffect(()=>{
    if(!enabled)return;
    let disposed=false,lock=null;
    const acquire=async()=>{if(disposed||lock||document.visibilityState!=='visible'||!navigator.wakeLock)return;try{const next=await navigator.wakeLock.request('screen');if(disposed){await next.release();return;}lock=next;next.addEventListener('release',()=>{lock=null;});}catch{/* Full-screen playback still works when the browser denies wake lock. */}};
    document.addEventListener('visibilitychange',acquire);acquire();
    return()=>{disposed=true;document.removeEventListener('visibilitychange',acquire);lock?.release().catch(()=>{});};
  },[enabled]);
}
