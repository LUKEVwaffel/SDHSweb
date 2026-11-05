// DEV-only isolated UI fixture. Never contacts the live backend or sends mail.
import {ballOpsTicketsFromSnapshot} from '../../supabase/functions/_shared/ballOpsTickets.ts';
import React from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import {supabase as SB} from '../../src/lib/supabaseClient';
import BallOpsPortal from '../../src/components/ball/ops/BallOpsPortal';
if (!import.meta.env.DEV) throw new Error('This preview is development-only.');
const cfg={price_cadet:35,price_couple:50,ball_date:'2026-12-05',event_time_text:'6:00 PM',venue_address:'Event venue · confirm with Chief',site_origin:'https://example.invalid'};
const names=['Avery Bennett','Marcus Ellis','Camila Torres','Ethan Wallace','Naomi Brooks','Adrian Foster','Isabella Reed'];
const rows=names.map((name,i)=>({id:`preview-${i}`,cadet_name:name,cadet_let_level:String(i%4+1),cadet_company:['alpha','bravo','charlie'][i%3],cadet_gender:i%2?'male':'female',cadet_school_email:`preview${i}@example.invalid`,status:i===2?'guest_pending':'fully_verified',amount_due:i===0?50:35,amount_paid:[50,0,35,35,20,35,35][i],cash_received:[true,false,true,true,false,true,true][i],field_trip_form_required:true,field_trip_form_received:i!==1&&i!==4,created_at:`2026-11-0${i+1}T12:00:00Z`}));
const guests=[{id:'guest-0',signup_id:rows[0].id,name:'Jordan Mitchell',gender:'male',guest_type:'date',verified_at:'2026-11-01T12:00:00Z',field_trip_form_required:true,field_trip_form_received:false,verification_token:'preview-token',personal_email:''},{id:'guest-2',signup_id:rows[2].id,name:'Riley Parker',gender:'female',guest_type:'friend',verified_at:null,field_trip_form_required:false,school_attended:'Another high school',field_trip_form_received:false,friend_amount_due:35,friend_payment_method:'self_pays',friend_cash_received:false,verification_token:'preview-token-2',personal_email:'guest@example.invalid'}];
rows[5].cadet_company='staff';rows[6].cadet_company='bravo';rows[6].dress_approved=true;
let ticketRevision=0;
const historicalIds=new Set([rows[0].id,rows[3].id,rows[5].id]);
const receipts=new Map([rows[0],rows[3],rows[5]].map(row=>[row.id,{signup_id:row.id,distributed:true,recipient_name:row.id===rows[0].id?'Jordan Mitchell':row.cadet_name,recipient_company:row.cadet_company,distributed_at:'2026-11-05T14:00:00Z',distributed_by:'Preview historical record'}]));
function tickets(){const data=ballOpsTicketsFromSnapshot({hosts:rows,guests,roster:[],deliveries:[...receipts.values()],version:`preview-${ticketRevision}`,checked_at:new Date().toISOString()});return {...data,tracking_available:!new URLSearchParams(window.location.search).has('ticket_setup_missing'),tickets:data.tickets.map(ticket=>({...ticket,historical:historicalIds.has(ticket.signup_id)}))};}
let failRefresh=false;
SB.auth.getSession=async()=>({data:{session:{user:{email:new URLSearchParams(window.location.search).has('birthday')?'birthday-preview@example.invalid':'chief@example.invalid'}}},error:null});
SB.auth.signOut=async()=>({error:null});
SB.channel=()=>{const channel={on:()=>channel,subscribe:()=>channel};return channel;};
SB.removeChannel=async()=>{};
SB.from=table=>{
 let filters=[],patch=null;
 const chain={select:()=>chain,order:()=>chain,eq:(key,value)=>{filters.push([key,value]);return chain;},update:value=>{patch=value;return chain;},maybeSingle:()=>chain,then:(resolve,reject)=>Promise.resolve().then(()=>{
  if(table==='email_reviewers')return {data:{email:'chief@example.invalid'},error:null};
  if(failRefresh)return {data:null,error:{message:'Simulated connection failure'}};
  const source=table.includes('guests')?guests:rows;
  const matches=source.filter(r=>filters.every(([key,value])=>r[key]===value));
  if(patch)ticketRevision++;
  if(patch)for(const r of matches){Object.assign(r,patch);if('cash_received'in patch)r.amount_paid=r.cash_received?r.amount_due:0;}
  return {data:structuredClone(matches),count:matches.length,error:null};
 }).then(resolve,reject)};
 return chain;
};
window.fetch=async(url,options={})=>{
 const path=String(url);if(!path.includes('/functions/v1/'))throw new Error('Network disabled in local preview');
 const body=JSON.parse(options.body||'{}');let result={ok:true};
 if(path.includes('ball-ops-reservation')){
  const signup=rows.find(r=>r.id===body.signup_id);const guest=guests.find(g=>g.signup_id===body.signup_id);
  if(body.action==='tickets')result=tickets();
  else if(body.action==='receive_tickets'){
   const ticket=tickets().tickets.find(t=>t.signup_id===body.signup_id);
   if(!ticket||!ticket.ready)return new Response(JSON.stringify({error:'Complete reservation requirements first.'}),{status:400,headers:{'Content-Type':'application/json'}});
   receipts.set(ticket.signup_id,{signup_id:ticket.signup_id,distributed:true,recipient_name:ticket.recipient_name,recipient_company:ticket.recipient_company,distributed_at:new Date().toISOString(),distributed_by:'Preview Chief'});ticketRevision++;result={ticket:tickets().tickets.find(t=>t.signup_id===ticket.signup_id),already_received:false};
  }
  else if(body.action==='pricing')result=cfg;
  else if(body.action==='search')result={cadets:[{id:'new-cadet',name:'Sofia Mendoza',company:'delta',let_level:'2'}].filter(c=>c.name.toLowerCase().includes(body.query.toLowerCase()))};
  else if(body.action==='remove_guest'){
   if(!guest)return new Response(JSON.stringify({error:'Guest changed. Refresh and review again.'}),{status:409,headers:{'Content-Type':'application/json'}});
   if(guest.guest_type==='date')signup.amount_due=35;signup.status='fully_verified';guests.splice(guests.indexOf(guest),1);result={signup,guest:null,config:cfg};
  }else if(body.action==='complete_guest') {guest.verified_at=new Date().toISOString();signup.status='fully_verified';result={signup,guest,config:cfg};}
  else if(body.action==='create'){
   const created={id:crypto.randomUUID(),cadet_name:'Sofia Mendoza',cadet_gender:body.gender,cadet_company:'delta',cadet_let_level:'2',amount_due:body.guest_type==='date'?50:35,amount_paid:Number(body.amount_paid),cash_received:Number(body.amount_paid)>=(body.guest_type==='date'?50:35),field_trip_form_required:true,field_trip_form_received:body.host_form,status:body.guest_type==='none'||body.guest_complete?'fully_verified':'guest_pending'};rows.push(created);
   let g=null;if(body.guest_type!=='none'){g={id:crypto.randomUUID(),signup_id:created.id,name:body.guest_name,gender:body.guest_gender,guest_type:body.guest_type,personal_email:body.guest_email,verification_token:'preview-only',field_trip_form_required:body.guest_form_required,field_trip_form_received:body.guest_form,school_attended:body.guest_school,friend_amount_due:body.guest_type==='friend'?35:null,friend_payment_method:body.guest_type==='friend'?'self_pays':null,friend_cash_received:body.guest_paid,verified_at:body.guest_complete?new Date().toISOString():null};guests.push(g);}result={signup:created,guest:g,config:cfg};
  }else result={signup,guest,config:cfg};
 }
 return new Response(JSON.stringify(result),{headers:{'Content-Type':'application/json'}});
};
function Preview(){return <MemoryRouter><style>{`.bo-portal { --bo-viewport-offset: 28px; }`}</style><div style={{background:'#e9eee1',color:'#4b5b3d',padding:'7px 24px',font:'11px -apple-system,sans-serif',display:'flex',justifyContent:'space-between',gap:16}}><span>LOCAL PREVIEW · Sample reservations · Changes stay in this tab</span><button style={{font:'inherit',border:0,background:'none',color:'inherit',cursor:'pointer',textDecoration:'underline'}} onClick={()=>{failRefresh=!failRefresh;}}>Toggle connection failure for testing</button></div>{new URLSearchParams(window.location.search).has('race')&&<button onClick={()=>{rows[1].cash_received=true;rows[1].amount_paid=35;}}>Simulate another cashier receiving payment</button>}<BallOpsPortal/></MemoryRouter>;}
const root = import.meta.hot?.data.root || createRoot(document.getElementById('root'));
if(import.meta.hot)import.meta.hot.data.root=root;
root.render(<Preview/>);
