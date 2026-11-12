import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {supabase as SB} from '../../src/lib/supabaseClient';
import BallLabelQueue from '../../src/components/admin/panels/BallLabelQueue';
if(!import.meta.env.DEV)throw new Error('Local QA only');
SB.rpc=async(name,args)=>name==='ball_ticket_snapshot'?{data:{policy_version:2,version:'qa',checked_at:'now',hosts:[],guests:[],roster:[],deliveries:[]}}:{data:{policy_version:2,snapshot_version:'qa',checked_at:'now',labels:[...args.p_signup_ids].reverse().map(id=>({signupId:id,cadetName:`Cadet ${id}`,letLevel:'2',company:'Alpha'}))}};
function Fixture(){
 const [items,setItems]=useState([]);const [result,setResult]=useState('');
 window.open=()=>{let html='';return {document:{write:s=>{html=s;},close:()=>{}},focus:()=>{},close:()=>{},print:()=>{const doc=new DOMParser().parseFromString(html,'text/html');setResult(`Prepared ${doc.querySelectorAll('.sheet').length} sheet(s). All names: ${[...doc.querySelectorAll('.cadet')].map(n=>n.textContent).join(', ')||doc.body.textContent.trim()}`);}};};
 return <main style={{maxWidth:1000,margin:'24px auto',color:'#fff',fontFamily:'sans-serif'}}><h1>LOCAL QA · Label queue</h1><p>Prints stay in this preview. No production writes.</p>{['A','B','C'].map(id=><button key={id} disabled={items.some(p=>p.id===id)} onClick={()=>setItems(s=>[...s,{id,name:`Cadet ${id}`}])}>Add Cadet {id}</button>)}{items.length>0&&<BallLabelQueue items={items} onRemove={id=>setItems(s=>s.filter(p=>p.id!==id))} onClear={()=>setItems([])}/>}<p role="status">{result}</p></main>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
