import {useEffect,useState,useRef} from 'react';
import QRCode from 'qrcode';
import {remoteUrl} from '../../../../../lib/ballStudioRemote';
export default function StudioPairPanel({host,schedule,onClose}) {
  const panel=useRef();
  useEffect(()=>{panel.current?.querySelector('button')?.focus();},[]);
  const [qr,setQr]=useState(null);const [message,setMessage]=useState('');
  const url=host.token?remoteUrl(window.location.origin,host.token):'';
  useEffect(()=>{let alive=true;if(url)QRCode.toDataURL(url,{width:300,margin:2,errorCorrectionLevel:'M',color:{dark:'#081729',light:'#ffffff'}}).then(data=>{if(alive)setQr({url,data});}).catch(()=>{if(alive)setMessage('QR code unavailable. Copy the link below.');});return()=>{alive=false;};},[url]);
  return <div className="bs-pair-backdrop"><section ref={panel} onKeyDown={e=>{if(e.key!=='Tab')return;const items=[...panel.current.querySelectorAll('button,input')];if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===items.at(-1)){e.preventDefault();items[0]?.focus();}}} className="bs-pair-panel" role="dialog" aria-label="Connect phone remote" aria-modal="true"><div className="bs-row"><h2>Present from your seat.</h2><button onClick={onClose}>Close pairing</button></div><p>Scan with your phone’s camera. Keep this TV presentation open.</p>{schedule&&<p>The preshow starts automatically at {schedule}.</p>}{qr?.url===url&&<img className="bs-pair-qr" src={qr.data} alt="QR code for this playback session’s private phone remote"/>}<strong>{host.status==='READY'?'Ready for your phone':'Connecting remote service…'}</strong><label className="bs-pair-field">Private pairing code<input aria-label="Private pairing code" readOnly value={host.token} onFocus={e=>e.target.select()}/></label>
  <label className="bs-pair-field">Private phone remote link<input aria-label="Private phone remote link" readOnly value={url} onFocus={e=>e.target.select()}/></label>
  <div className="bs-row">
    <button onClick={async()=>{try{await navigator.clipboard.writeText(host.token);setMessage('Pairing code copied.');}catch{setMessage('Select and copy the pairing code above.');}}}>Copy code</button>
    <button onClick={async()=>{try{await navigator.clipboard.writeText(url);setMessage('Link copied.');}catch{setMessage('Select the link above and copy it.');}}}>Copy remote link</button>
    <button onClick={()=>{host.start();setMessage('New code. Scan the updated QR on your phone.');}}>New pairing code</button>
    <button onClick={async()=>{await host.stop();onClose();}}>Stop remote</button>
  </div>{['localhost','127.0.0.1'].includes(window.location.hostname)&&<p className="bs-pair-detail">For a real phone, open the deployed site or a network address your phone can reach. This localhost link works only on this computer.</p>}{message&&<p role="status">{message}</p>}</section></div>;
}
