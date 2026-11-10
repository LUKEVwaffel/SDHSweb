export const REMOTE_STALE_MS = 6500;
export function createRemoteToken() { return Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join(''); }
export const validRemoteToken = token => typeof token === 'string' && /^[a-f0-9]{64}$/.test(token);
export function remoteUrl(origin, token) { return `${origin}/ballremote#${token}`; }
export function readRemoteToken(raw) {
  try {const value=raw.trim();const token=value.includes('#')?value.split('#').at(-1):value;return validRemoteToken(token)?token:'';}catch{return '';}
}
/** Ephemeral broadcast only. No new tables, database writes, or public deck reads. */
export function studioChannel(client, token, onMessage, onStatus) {
  if(!validRemoteToken(token))throw new Error('Invalid private remote link.');
  let live=true;
  const channel=client.channel(`ball-studio:${token}`,{config:{broadcast:{ack:true,self:false}}});
  channel.on('broadcast',{event:'studio'},({payload})=>{if(live&&payload&&typeof payload==='object')onMessage(payload);});
  channel.subscribe(status=>{if(live)onStatus(status);});
  return {
    async send(payload){const result=await channel.send({type:'broadcast',event:'studio',payload});if(result!=='ok')throw new Error('Remote connection interrupted.');},
    close(){live=false;return client.removeChannel(channel);},
  };
}
