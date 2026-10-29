// Run against the disposable fixture DB only. No production writes or email.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {isBallStatusReceiptCurrent,isBallLabelEligible} from '../supabase/functions/_shared/ballTicketEligibility.js';
import {printBallEnvelopeLabels} from '../src/lib/ballLabelPrint.js';
const host={id:'00000000-0000-0000-0000-000000000001',cadet_name:'Test Host',status:'fully_verified',cadet_gender:'female',standalone_guest:false,amount_due:35,amount_paid:35,cash_received:true,field_trip_form_required:true,field_trip_form_received:true,dress_approved:true};
const guest={id:'00000000-0000-0000-0000-000000000002',name:'Test Guest',guest_type:'date',verified_at:'2026-10-29T12:00:00Z',field_trip_form_required:true,field_trip_form_received:true,dress_approved:true};
const cases=[];
function add(h,g,label){cases.push({h,g,label});}
add(host,null,'complete solo');add(host,guest,'complete couple');
for(const [key,values]of Object.entries({status:[null,'guest_pending','fully_verified'],field_trip_form_received:[null,false,true],amount_due:[null,0,35,-1,'NaN'],amount_paid:[null,0,20,35,-1,'NaN'],cash_received:[null,false,true],dress_approved:[null,false,true],cadet_gender:[null,'male','female'],standalone_guest:[null,false,true]}))for(const value of values)add({...host,[key]:value},guest,`host ${key} ${value}`);
for(const [key,values]of Object.entries({verified_at:[null,'2026-10-29T12:00:00Z'],field_trip_form_received:[null,false,true],field_trip_form_required:[null,false,true],dress_approved:[null,false,true],is_sdhs_jrotc:[null,false,true],school_attended:[null,'SDHS','Soddy-Daisy High School','Sequoyah High School'],sdhs_matched_cadet_id:[null,'00000000-0000-0000-0000-000000000003']}))for(const value of values)add(host,{...guest,[key]:value},`guest ${key} ${value}`);
for(const method of [null,'self_pays','host_delivers'])for(const cash of [null,false,true])for(const hostCash of [null,false,true])for(const due of [null,0,35])add({...host,cash_received:hostCash},{...guest,guest_type:'friend',friend_amount_due:due,friend_payment_method:method,friend_cash_received:cash},`friend ${method} ${cash} ${hostCash} ${due}`);
for(const school of [null,'Sequoyah','SDHS'])for(const matched of [null,'00000000-0000-0000-0000-000000000003'])add(host,{...guest,field_trip_form_required:false,field_trip_form_received:false,is_sdhs_jrotc:false,school_attended:school,sdhs_matched_cadet_id:matched},'school identity overrides old exemption');
for(const gender of ['male','female'])add({...host,cadet_gender:gender,dress_approved:false,door_attire_denied:true},null,'door denial overrides old approval or standard uniform');
if(process.env.BALL_LIVE_SNAPSHOT){const s=JSON.parse(readFileSync(process.env.BALL_LIVE_SNAPSHOT,'utf8'));const by=new Map(s.guests.map(g=>[g.signup_id,g]));for(const h of s.hosts)add(h,by.get(h.id)||null,'live reservation '+h.id);}
const literal=x=>x==null?'null':"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
test('database and JavaScript agree across complete, null, partial, denied, guest and friend states',()=>{
 const values=cases.map((x,i)=>`(${i},${literal(x.h)},${literal(x.g)})`).join(',');
 const sql=`select i,cardinality(public.ball_ticket_blockers(h,g))=0 from (values ${values}) t(i,h,g) order by i;`;
 const out=execFileSync('psql',['-X','-h','/tmp','-p','55491','-U','poll_test','-d','ball_receipt_tests','-v','ON_ERROR_STOP=1','-A','-t','-F','\t'],{input:sql,encoding:'utf8',maxBuffer:16*1024*1024});
 for(const line of out.trim().split('\n')){const [index,ready]=line.split('\t');const c=cases[Number(index)];assert.equal(isBallLabelEligible(c.h,c.g||undefined),ready==='t',c.label);}
 console.log(`Matched ${cases.length} completion decisions, including all supplied live records.`);
});
test('raw names cannot bypass the verified print batch contract',()=>{assert.throws(()=>printBallEnvelopeLabels([{cadetName:'Incomplete person'}]),/database-verified/);});

test('receipt confirmations cannot claim revoked or unpaid statuses are received',()=>{
 for(const [field,yes,no]of [
 ['cash',{...host,cash_received:true}, {...host,cash_received:false}],
 ['form',{...host,field_trip_form_received:true},{...host,field_trip_form_received:false}]
 ]){assert.equal(isBallStatusReceiptCurrent(field,yes,guest),true);assert.equal(isBallStatusReceiptCurrent(field,no,guest),false);}
 assert.equal(isBallStatusReceiptCurrent('cash',{...host,cash_received:true,amount_paid:20},guest),false);
 assert.equal(isBallStatusReceiptCurrent('friend_cash',host,{...guest,guest_type:'friend',friend_amount_due:35,friend_cash_received:false,friend_payment_method:'host_delivers'}),false);
 assert.equal(isBallStatusReceiptCurrent('guest_form',host,{...guest,field_trip_form_received:false}),false);
});
