import { useEffect, useState } from 'react';
import PdfPreview from './PdfPreview';
import {supabase as SB} from '../../../../lib/supabaseClient';
import {invokeError} from '../../../../lib/supabaseFnError';

// Bytes stay in the owning conversation's RLS-protected message, never a public bucket.
export default function PdfArtifactCard({ artifact }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  const [fresh,setFresh]=useState(null);
  const [refreshing,setRefreshing]=useState(false);
  const receipt=artifact.filename==='military-ball-receipts.pdf';
  const shown=fresh||artifact;
  async function currentReceipt(action){
    if(refreshing)return;
    const popup=action==='print'?window.open('','_blank'):null;
    if(action==='print'&&!popup){setError('Allow popups to print current receipts.');return;}
    setRefreshing(true);setError('');
    try{
      const {data,error:problem}=await SB.functions.invoke('ball-receipts',{body:{filters:artifact.receipt_filters||{}}});
      if(problem||data?.error)throw new Error(await invokeError(data,problem,'Could not refresh receipts. Nothing was printed.'));
      const current=data.artifact;
      const check=await SB.rpc('ball_ticket_snapshot');
      if(check.error||!current.ball_snapshot_version||check.data?.version!==current.ball_snapshot_version)throw new Error('The ledger changed while this packet was generated. Retry to use the latest records. Nothing was printed.');
      const bytes=Uint8Array.from(atob(current.base64),c=>c.charCodeAt(0));
      const liveUrl=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
      setFresh(current);
      if(action==='print')popup.location.href=liveUrl;
      else if(action==='download'){const a=document.createElement('a');a.href=liveUrl;a.download=current.filename;a.click();}
      else setPreview(true);
      setTimeout(()=>URL.revokeObjectURL(liveUrl),120000);
    }catch(e){popup?.close();setError(e.message||'Could not verify live records. Nothing was printed.');}
    finally{setRefreshing(false);}
  }
  useEffect(() => {
    let objectUrl;
    try {
      const binary = atob(artifact.base64);
      const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
      objectUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      setUrl(objectUrl);
    } catch { setError('This attachment could not be opened. Ask Dispatch to regenerate it.'); }
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [artifact.base64]);
  return <article className="dispatch-pdf-card" aria-label={`PDF: ${artifact.title}`}>
    <div className="dispatch-pdf-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8Z"/><path d="M14 3v5h5M8 13h8M8 17h6"/></svg></div>
    <div className="dispatch-pdf-details"><span className="dispatch-pdf-eyebrow">{receipt?"RECEIPT SNAPSHOT · REFRESH BEFORE PRINTING":"GENERATED PDF · READY TO PRINT"}</span><h3>{shown.title}</h3><p>{shown.page_count} {shown.page_count === 1 ? 'page' : 'pages'}{shown.record_count != null && ` · ${shown.record_count} records`} · {Math.max(1, Math.round(shown.byte_size / 1024))} KB</p><p className="dispatch-pdf-source">{shown.source}</p>{receipt&&<p className="dispatch-pdf-source">Snapshot from {new Date(shown.generated_at).toLocaleString()}. Every action below regenerates the packet from the current ledger and excludes delivered or ticket-ready reservations.{!artifact.receipt_filters&&" This older packet has no saved filters; refresh will generate all companies."}</p>}{error && <p role="alert">{error}</p>}
      {receipt?<div className="dispatch-pdf-actions"><button disabled={refreshing} onClick={()=>currentReceipt('preview')}>{refreshing?'Checking live records…':'Refresh & preview'}</button><button disabled={refreshing} onClick={()=>currentReceipt('print')}>Refresh & open to print ↗</button><button disabled={refreshing} onClick={()=>currentReceipt('download')}>Refresh & download ↓</button></div>:url&&<div className="dispatch-pdf-actions"><button onClick={()=>setPreview(p=>!p)} aria-expanded={preview}>{preview?'Close preview':'Preview PDF'}</button><a href={url} target="_blank" rel="noopener noreferrer">Open &amp; print ↗</a><a href={url} download={artifact.filename}>Download PDF ↓</a></div>}
      {preview && <PdfPreview base64={shown.base64} title={shown.title} />}
    </div>
  </article>;
}
