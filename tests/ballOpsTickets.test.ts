import {ballOpsTicketsFromSnapshot} from '../supabase/functions/_shared/ballOpsTickets.ts';
const assert=(v:unknown,m:string)=>{if(!v)throw new Error(m);};
const host={id:'host',cadet_name:'Host',cadet_company:'alpha',cadet_gender:'male',status:'fully_verified',amount_due:35,amount_paid:35,cash_received:true,field_trip_form_received:true,field_trip_form_required:true};
const snapshot={hosts:[host],guests:[],roster:[],deliveries:[],version:'one',checked_at:'2026-11-05T14:00:00Z'};
Deno.test('Alpha company alone never invents ticket receipt or enables a write without SQL',()=>{
 const data=ballOpsTicketsFromSnapshot(snapshot);
 assert(data.tickets[0].ready&&!data.tickets[0].distributed,'Ready Alpha reservation was silently marked received');
 assert(data.tracking_available===false,'Read-only fallback enabled writes');
});
Deno.test('Historical delivery remains received even when reservation requirements are outstanding',()=>{
 const data=ballOpsTicketsFromSnapshot({...snapshot,hosts:[{...host,status:'guest_pending',amount_paid:0,field_trip_form_received:false}],deliveries:[{signup_id:'host',distributed:true,recipient_name:'Original recipient'}]});
 assert(data.tickets[0].distributed&&!data.tickets[0].ready,'Receipt changed completion status');
 assert(data.tickets[0].received_by_name==='Original recipient','Saved pickup identity was replaced');
});
Deno.test('Date pickup follows the current recipient rules, independently of historical host-company selection',()=>{
 const data=ballOpsTicketsFromSnapshot({...snapshot,hosts:[{...host,cadet_gender:'female'}],guests:[{id:'guest',signup_id:'host',name:'Date',guest_type:'date',gender:'male',sdhs_matched_cadet_id:'cadet'}],roster:[{id:'cadet',gender:'male',company:'bravo'}]});
 assert(data.tickets[0].recipient_name==='Date'&&data.tickets[0].recipient_company==='bravo','Wrong pickup name/company');
 assert(data.tickets[0].ticket_count===2,'Companion ticket missing');
 const friend=ballOpsTicketsFromSnapshot({...snapshot,guests:[{id:'friend',signup_id:'host',name:'Friend',guest_type:'friend',gender:'male'}]});
 assert(friend.tickets[0].recipient_name==='Host','Friend incorrectly became pickup person');
});
