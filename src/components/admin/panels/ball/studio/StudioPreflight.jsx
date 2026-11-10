import {useEffect,useState} from 'react';
import StudioModal from './StudioModal';
import {auditPresentation,probePresentationPhoto} from '../../../../../lib/ballStudioAudit';
export default function StudioPreflight({deck,onClose,onSelect}) {
  const [result,setResult]=useState(null);const [error,setError]=useState('');
  useEffect(()=>{let alive=true;auditPresentation(deck,probePresentationPhoto).then(r=>{if(alive)setResult(r);}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[deck]);
  return <StudioModal title="Pre-show check" onClose={onClose}><p className="bs-muted">Checks photo availability, image resolution, empty slots, and long text. Rehearse the finished show on the actual TV to check framing and readability.</p>{error&&<p role="alert">{error}</p>}{!result&&!error?<p className="bs-empty">Checking full-resolution photos…</p>:result&&<><div className="bs-audit-summary"><strong>{result.issues.length?`${result.issues.length} ${result.issues.length===1?'thing':'things'} to review`:'Ready for your rehearsal'}</strong><span>{deck.slides.length} slides · {result.checkedPhotos} unique photos checked</span></div>{result.issues.map((issue,i)=><button className="bs-audit-issue" key={i} onClick={()=>{onSelect(deck.slides[issue.index].id);onClose();}}><strong>Slide {issue.index+1} · {deck.slides[issue.index].title||deck.slides[issue.index].layout}</strong><span>{issue.message}</span><small>Open this slide →</small></button>)}</>}</StudioModal>;
}
