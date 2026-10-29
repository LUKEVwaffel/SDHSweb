import{invitationMatchesAddition}from '../supabase/functions/_shared/ballGuestInvitation.ts';
import{reservationChangeMessages}from '../supabase/functions/_shared/ballReservationNotice.ts';
const assert=(v:unknown,m:string)=>{if(!v)throw new Error(m);};
Deno.test('invitation retry cannot target a replaced guest, changed address or another reservation',()=>{
 const g={id:'guest-one',personal_email:'guest@example.invalid'};
 const c={action:'add_guest',status:'applied',signup_id:'host-one',result:{guest_id:g.id,date_email:g.personal_email}};
 assert(invitationMatchesAddition(c,g,'host-one'),'Valid invitation rejected');
 for(const changed of [{...g,id:'guest-two'},{...g,personal_email:'another@example.invalid'}])assert(!invitationMatchesAddition(c,changed,'host-one'),'Changed recipient accepted');
 assert(!invitationMatchesAddition(c,g,'host-two'),'Another reservation accepted');
 assert(!invitationMatchesAddition({...c,status:'pending'},g,'host-one'),'Unapplied proposal sent an invitation');
});
Deno.test('new guest messages preserve paid amounts without claiming verification or merging a solo attendee',()=>{
 const messages=reservationChangeMessages({action:'add_guest',host_name:'Host',date_name:'New Guest',guest_type:'friend',host_email:'host@example.invalid',date_email:'guest@example.invalid',host_total:35,host_paid:35,host_balance:0,host_credit:0,date_total:35});
 assert(messages.length===1&&messages[0].key==='host','Guest was sent a generic balance email instead of the verification invitation');
 const text=messages[0].lines.join(' ');
 assert(text.includes('Existing payment preserved: $35.00'),'Paid amount lost');
 assert(text.includes('no payment recorded'),'New friend incorrectly treated as paid');
 assert(!text.includes('former solo reservation'),'Nonexistent reservation merge was invented');
});
