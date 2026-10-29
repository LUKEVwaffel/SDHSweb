import FingerprintJS from '@fingerprintjs/fingerprintjs';
let pending;
export function getPollDeviceId() {
 if(!pending) pending=(async()=>{
  try{const agent=await FingerprintJS.load({monitoring:false});const result=await agent.get();if(/^[a-f0-9]{32}$/i.test(result.visitorId))return `fp_${result.visitorId}`;}catch{/* Fall back to a persistent browser key if fingerprinting is blocked. */}
  const key='tb_christmas_poll_browser';let value=localStorage.getItem(key);if(!value){value=crypto.randomUUID();localStorage.setItem(key,value);}return `browser_${value}`;
 })().catch(error=>{pending=null;throw error;});
 return pending;
}
