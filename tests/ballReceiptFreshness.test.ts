import {buildBallReceipt} from '../supabase/functions/_shared/pdf/ballReceipts.ts';
import {buildPdfPlan} from '../supabase/functions/_shared/pdf/tools.ts';
import {isBallReceiptEligible} from '../supabase/functions/_shared/ballTicketEligibility.js';
const assert=(value:unknown,message:string)=>{if(!value)throw new Error(message);};
const host={id:'host',cadet_name:'Test Cadet',cadet_gender:'female',cadet_company:'Alpha',status:'fully_verified',amount_due:35,amount_paid:35,cash_received:true,field_trip_form_required:true,field_trip_form_received:true,dress_approved:null};
Deno.test('paid forms stay complete while unknown attire is distinct from denial',()=>{
 const r=buildBallReceipt(host);
 assert(r.paperwork_payment_complete,'Paid paperwork incorrectly marked incomplete');
 assert(r.requirements.filter(x=>x.label.includes('form')||x.label.includes('payment')).every(x=>x.checked),'Completed requirements unchecked');
 assert(r.requirements.find(x=>x.label.includes('attire'))?.detail.includes('on site'),'On-site review omitted');
 assert(buildBallReceipt({...host,dress_approved:false}).requirements.find(x=>x.label.includes('attire'))?.detail.includes('NOT APPROVED'),'Denied attire blurred into pending');
});
Deno.test('all current completions and delivered tickets are excluded without reusing prior rows',async()=>{
 let version='one';let current:Record<string,unknown>={...host};let distributed=false;
 const client={rpc:async()=>({data:{hosts:[current],guests:[],deliveries:[{signup_id:'host',distributed}],roster:[],version,checked_at:'2026-10-29T13:00:00Z'},error:null})};
 const initial=await buildPdfPlan('generate_ball_receipts_pdf',{company:'Alpha'},client as never,'s6');
 assert(initial.ball_snapshot_version==='one','Snapshot version missing');
 assert(initial.receipt_filters?.company==='Alpha','Regeneration scope lost');
 current={...host,dress_approved:true};version='two';
 let blocked=false;try{await buildPdfPlan('generate_ball_receipts_pdf',{},client as never,'s6');}catch{blocked=true;}
 assert(blocked,'Newly complete reservation received a stale receipt');
 assert(!isBallReceiptEligible(host,undefined,{distributed:true}),'Delivered booking received a receipt');
 current={...host};distributed=true;blocked=false;
 try{await buildPdfPlan('generate_ball_receipts_pdf',{},client as never,'s6');}catch{blocked=true;}
 assert(blocked,'Delivery change was ignored');
});
Deno.test('snapshot read failure never falls back to cached receipt data',async()=>{
 let failed=false;try{await buildPdfPlan('generate_ball_receipts_pdf',{}, {rpc:async()=>({error:{message:'offline'},data:null})} as never,'s6');}catch{failed=true;}
 assert(failed,'A packet was generated despite a failed live read');
});
