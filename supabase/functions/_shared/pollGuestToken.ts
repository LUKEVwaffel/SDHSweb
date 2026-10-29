const encoder = new TextEncoder();
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const decode = (text: string) => Uint8Array.from(atob(text.replace(/-/g,'+').replace(/_/g,'/')),char=>char.charCodeAt(0));
async function key(secret: string) { return crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']); }
export async function issuePollGuestToken(secret: string) {
 const body=encode(encoder.encode(JSON.stringify({scope:'christmas_music_2026',expires:Date.now()+2*60*60*1000,nonce:crypto.randomUUID()})));
 return body+'.'+encode(new Uint8Array(await crypto.subtle.sign('HMAC',await key(secret),encoder.encode(body))));
}
export async function validPollGuestToken(token: unknown, secret: string) {
 try {
  if(typeof token!=='string'||token.length>4096)return false;
  const parts=token.split('.');if(parts.length!==2)return false;
  if(!await crypto.subtle.verify('HMAC',await key(secret),decode(parts[1]),encoder.encode(parts[0])))return false;
  const body=JSON.parse(new TextDecoder().decode(decode(parts[0])));
  return body.scope==='christmas_music_2026'&&Number.isFinite(body.expires)&&body.expires>Date.now();
 }catch{return false;}
}
