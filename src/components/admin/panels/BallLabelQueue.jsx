import {useState} from 'react';
import {AVERY_5160,printBallEnvelopeLabels} from '../../../lib/ballLabelPrint';
import {readBallLabelBatch} from '../../../lib/ballLiveSnapshot';
import {orderQueuedLabelBatch} from '../../../lib/ballLabelQueue';
import {P,mono,inter,radius} from '../theme';

export default function BallLabelQueue({items,onRemove,onClear,disabled}) {
  const [start,setStart]=useState(0);
  const [page,setPage]=useState(0);
  const [printing,setPrinting]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const sheets=Math.max(1,Math.ceil((start+items.length)/AVERY_5160.count));
  const visiblePage=Math.min(page,sheets-1);
  async function printQueue(){
    if(disabled||printing||!items.length)return;
    const ids=items.map(item=>item.id);
    const win=window.open('','_blank');
    if(!win){setError('Allow popups to print the selected labels.');return;}
    setPrinting(true);setError('');setNotice('');
    try{
      const batch=orderQueuedLabelBatch(await readBallLabelBatch(ids,false),ids);
      if(!printBallEnvelopeLabels(batch,start,win)){win.close();return;}
      setNotice('Print window opened. After printing, clear this queue. If you cancel printing, your selections stay here to retry.');
    }catch(e){win.close();setError(e.message||'Could not prepare selected labels. Nothing was printed.');}
    finally{setPrinting(false);}
  }
  const blocked=disabled||printing;
  return <section aria-label="Next label sheet" style={{margin:'18px 0',padding:18,border:`1px solid ${P.gold}66`,borderRadius:radius.md,background:P.ink}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}><div><h2 style={{margin:0,color:P.cream,font:`600 18px ${inter}`}}>Next label sheet · {items.length} selected</h2><p style={{color:P.mute,font:`12px ${inter}`}}>Add people from any company. Labels print in the order you select them.</p></div><button type="button" disabled={blocked} onClick={onClear} style={button}>Clear queue</button></div>
    <div style={{display:'flex',gap:14,alignItems:'center',flexWrap:'wrap',marginBottom:14}}>
      <label style={{color:P.cream,font:`12px ${inter}`}}>Start at label <select aria-label="Starting label on sheet" disabled={printing} value={start} onChange={e=>{setStart(Number(e.target.value));setPage(0);setNotice('');}} style={button}>{Array.from({length:AVERY_5160.count},(_,i)=><option key={i} value={i}>{i+1} · Row {Math.floor(i/3)+1}, column {i%3+1}</option>)}</select></label>
      <button type="button" disabled={printing} onClick={()=>{setStart(0);setPage(0);setNotice('');}} style={button}>Use a fresh sheet</button>
      <span style={{color:P.mute,font:`11px ${mono}`}}>{sheets} sheet{sheets===1?'':'s'} · Avery 5160 · 30 labels per sheet</span>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:20}}>
      <div><label style={{color:P.mute,font:`11px ${mono}`}}>Sheet preview <select aria-label="Preview label sheet" value={visiblePage} onChange={e=>setPage(Number(e.target.value))} style={button}>{Array.from({length:sheets},(_,i)=><option key={i} value={i}>{i+1} of {sheets}</option>)}</select></label><div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:5,background:'#faf8f2',padding:10,marginTop:8,borderRadius:6}}>{Array.from({length:AVERY_5160.count},(_,i)=>{
        const item=items[visiblePage*AVERY_5160.count+i-start];
        return <div key={i} title={item?.name||'Blank label'} style={{aspectRatio:'2.625 / 1',padding:5,border:`1px solid ${item?'#b49751':'#ddd8cc'}`,borderRadius:3,background:item?'#fff4d6':'#fff',color:item?'#1e293b':'#bbb4a8',font:`${item?'600':'400'} 10px/1.2 ${inter}`,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',textAlign:'center',overflowWrap:'anywhere'}}>{item?item.name:i+1}</div>;
      })}</div></div>
      <div><ol style={{paddingLeft:24,margin:'8px 0',maxHeight:340,overflowY:'auto',color:P.cream,font:`12px/1.6 ${inter}`}}>{items.map(item=><li key={item.id} style={{padding:'6px 0'}}><span>{item.name}</span> <button type="button" aria-label={`Remove ${item.name} from label sheet`} disabled={printing} onClick={()=>onRemove(item.id)} style={{...button,padding:'3px 7px',marginLeft:8}}>Remove</button></li>)}</ol><button type="button" disabled={blocked||!items.length} onClick={printQueue} style={{...button,background:P.gold,color:P.ink,fontWeight:700,padding:'12px 16px',marginTop:12}}>{printing?'Preparing labels…':`Print ${items.length} selected label${items.length===1?'':'s'} together`}</button><p style={{color:P.mute,font:`11px/1.6 ${inter}`}}>Earlier label positions stay blank on a partly used sheet. Printing does not mark tickets delivered.</p></div>
    </div>
    {error&&<p role="alert" style={{color:P.red,font:`12px ${inter}`}}>{error}</p>}{notice&&<p role="status" style={{color:P.gold,font:`12px/1.5 ${inter}`}}>{notice}</p>}
  </section>;
}
const button={border:`1px solid ${P.hair}`,background:P.deep,color:P.cream,borderRadius:5,padding:'7px 10px',font:`11px ${inter}`,cursor:'pointer'};
