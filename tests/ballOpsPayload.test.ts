import {ballOpsPayload} from '../supabase/functions/_shared/ballOpsPayload.ts';
const assert=(condition:unknown,message:string)=>{if(!condition)throw new Error(message);};
Deno.test('Chief packets exclude medical and separate attire-review data while retaining print and payment facts',()=>{
 const original={version:'one',signup:{id:'host',amount_due:50,amount_paid:50,cadet_gender:'male',cadet_allergies:'Private',cadet_has_allergy:true,cadet_allergy_email:'private@example.invalid',allergy_status:'pending',dress_approved:true,dress_approved_by:'reviewer'},guest:{id:'guest',allergies:'Private guest',dress_approved:false,name:'Guest',verification_token:'opaque-token',gender:'female',personal_email:'guest@example.invalid'},config:{ball_date:'2026-12-05'}};
 const result=ballOpsPayload(original);
 for(const key of ['cadet_allergies','cadet_has_allergy','cadet_allergy_email','allergy_status','dress_approved','dress_approved_by'])assert(!(key in result.signup!),`Exposed ${key}`);
 assert(!('allergies' in result.guest!)&&!('dress_approved' in result.guest!),'Guest private fields exposed');
 assert(result.signup?.amount_paid===50&&result.version==='one','Payment or version lost');
 assert(result.guest?.verification_token==='opaque-token'&&result.guest.personal_email==='guest@example.invalid','Invitation fields lost');
 assert(original.signup.cadet_allergies==='Private','Filtering mutated the audit source');
});
Deno.test('Solo packets retain a null guest',()=>{assert(ballOpsPayload({signup:{id:'host'},guest:null}).guest===null,'Absent guest was invented');});
