import test from 'node:test';
import assert from 'node:assert/strict';
import {ballOpsPacketHtml} from '../src/lib/ballOpsPacket.js';
const packet={signup:{id:'test',cadet_name:'Cadet <script>',cadet_gender:'male',amount_due:35,amount_paid:50,field_trip_form_required:true},guest:{name:'Guest',gender:'female',verification_token:'token',field_trip_form_required:true},config:{ball_date:'2026-12-01'}};
test('Packet includes receipt, separate attire instructions, contacts, safe guest link and signatures',()=>{
 const html=ballOpsPacketHtml(packet,'https://example.invalid');
 assert.equal((html.match(/<section>/g)||[]).length,3);
 assert.ok(html.includes('Weston Noblit: (423) 987-2261'));
 assert.ok(html.includes('Kylie Gray: (423) 681-3011'));
 assert.ok(html.includes('https://example.invalid/ball/guest/token'));
 assert.ok(html.includes('Credit for staff review: $15.00'));
 assert.ok(html.includes('Cadet &lt;script&gt;'));
 assert.ok(!html.includes('Cadet <script>'));
 assert.ok(html.includes('Printing this packet does not complete registration'));
 assert.equal((html.match(/Attendee signature/g)||[]).length,3);
});
test('Solo packet contains no guest link and male instructions use Weston only',()=>{
 const html=ballOpsPacketHtml({...packet,guest:null},'https://example.invalid');
 assert.equal((html.match(/<section>/g)||[]).length,2);
 assert.ok(!html.includes('/ball/guest/'));
 assert.ok(!html.includes('Kylie Gray'));
});
test('Printed guest links use the public backend origin instead of localhost',()=>{
 const html=ballOpsPacketHtml({...packet,config:{site_origin:'https://ball.example.invalid'}},'http://127.0.0.1:5183');
 assert.ok(html.includes('https://ball.example.invalid/ball/guest/token'));
 assert.ok(!html.includes('127.0.0.1'));
 assert.throws(()=>ballOpsPacketHtml(packet,'http://localhost:5183'),/public website address/);
});
test('Print requirements honor SDHS identity and keep unknown payment distinct from zero',()=>{
 const html=ballOpsPacketHtml({...packet,signup:{...packet.signup,amount_due:null,amount_paid:null,cash_received:false},guest:{...packet.guest,school_attended:'SDHS',field_trip_form_required:false}},'https://example.invalid');
 assert.ok(html.includes('Host ticket total: Unknown'));
 assert.ok(!html.includes('No field trip form required.'));
});

test('Ball packets never request a staff signature',()=>{
 const html=ballOpsPacketHtml(packet,'https://example.invalid');
 assert.doesNotMatch(html,/staff signature|Received by|Chief.{0,12}signature/i);
 assert.match(html,/Attendee signature/);
});
