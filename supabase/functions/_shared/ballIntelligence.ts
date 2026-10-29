export type Row = Record<string, unknown>;
const sdhsSchool = (value:unknown)=>/\bsoddy[\s-]*daisy\b|\bsdhs\b/i.test(String(value??''));
const cents = (value: unknown) => Math.round(Number(value ?? 0) * 100);
const dollars = (value: number) => value / 100;
import {isBallHostFormRequired,isBallGuestFormRequired} from './ballTicketEligibility.js';
export const hostFormRequired=isBallHostFormRequired;
export const guestFormRequired=isBallGuestFormRequired;
export function paymentState(row: Row, totalKey = 'amount_due', paidKey = 'amount_paid', cashKey = 'cash_received') {
  const total = row[totalKey] == null ? null : cents(row[totalKey]);
  const paid = row[paidKey] == null ? (row[cashKey] === true ? total : 0) : cents(row[paidKey]);
  return { total: total == null ? null : dollars(total), paid: paid == null ? null : dollars(paid),
    balance: total == null || paid == null ? null : dollars(Math.max(total-paid,0)),
    credit: total == null || paid == null ? null : dollars(Math.max(paid-total,0)) };
}
export function reservationStatus(host: Row, guest?: Row) {
  const hostPayment = paymentState(host);
  const friendPaid = guest?.friend_cash_received === true || (guest?.friend_payment_method === 'host_delivers' && host.cash_received === true);
  const guestPayment = guest?.guest_type === 'friend' ? paymentState({amount_due:guest.friend_amount_due,cash_received:friendPaid}) : null;
  const issues: string[] = [];
  if (hostPayment.total == null) issues.push('host_price_missing');
  if (hostPayment.paid == null) issues.push('host_payment_unknown');
  if (hostPayment.balance != null && hostPayment.balance > 0) issues.push('host_balance_due');
  if (hostPayment.credit != null && hostPayment.credit > 0) issues.push('host_credit_review');
  if (hostFormRequired(host) && host.field_trip_form_received !== true) {
    issues.push(host.standalone_guest !== true || host.field_trip_form_required === true ? 'host_form_missing' : 'host_form_requirement_unknown');
  }
  if (host.status !== 'fully_verified' || (guest && !guest.verified_at)) issues.push('verification_incomplete');
  const standardUniform = String(host.cadet_gender || '').trim().toLowerCase() === 'male' && host.standalone_guest !== true;
  if (!standardUniform && host.dress_approved !== true) issues.push('host_dress_unapproved');
  if (host.cadet_has_allergy && host.allergy_status !== 'contacted') issues.push('allergy_follow_up');
  if (guest) {
    if (guestFormRequired(guest) && guest.field_trip_form_received !== true) {
      issues.push(guest.field_trip_form_required === true || guest.is_sdhs_jrotc === true || sdhsSchool(guest.school_attended)
        ? 'guest_form_missing'
        : 'guest_form_requirement_unknown');
    }
    if (guest.dress_approved !== true) issues.push('guest_attire_unapproved');
    if (guestPayment?.total == null && guest.guest_type === 'friend') issues.push('friend_price_missing');
    if (guestPayment?.balance != null && guestPayment.balance > 0) issues.push('friend_balance_due');
  }
  const reviewOnly = new Set(['host_credit_review','allergy_follow_up']);
  return { id:host.id, name:host.cadet_name, company:host.cadet_company,
    guest: guest ? {id:guest.id,name:guest.name,type:guest.guest_type} : null,
    payment:hostPayment, friend_payment:guestPayment, issues,
    ready:issues.length===0, attendance_requirements_complete:issues.every(issue=>reviewOnly.has(issue)) };
}
export function ballReport(hosts: Row[], guests: Row[]) {
  const bySignup = new Map(guests.map(guest=>[guest.signup_id,guest]));
  const rows = hosts.map(host=>reservationStatus(host,bySignup.get(host.id)));
  const issueCounts: Record<string,number> = {};
  for(const row of rows)for(const issue of row.issues)issueCounts[issue]=(issueCounts[issue]||0)+1;
  const sum=(key:'total'|'paid'|'balance'|'credit')=>dollars(rows.reduce((total,row)=>total+cents(row.payment[key])+cents(row.friend_payment?.[key]),0));
  return { reservations:hosts.length, attendees:hosts.length+guests.filter(guest=>hosts.some(host=>host.id===guest.signup_id)).length,
    ready:rows.filter(row=>row.ready).length, issues:issueCounts,
    finance:{ticket_total_known:sum('total'),payment_recorded_known:sum('paid'),balance_due_known:sum('balance'),credit_for_review_known:sum('credit'),
      unknown_host_prices:rows.filter(row=>row.payment.total==null).length,
      unknown_friend_prices:rows.filter(row=>row.friend_payment && row.friend_payment.total==null).length,
      note:'Recorded payments are ledger amounts, not bank reconciliation. Credits require staff review; no refund is implied.'},rows };
}
export function redactPrivate(value: unknown): unknown {
  if(Array.isArray(value))return value.map(redactPrivate);
  if(value && typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!/(token|password|secret|credential|pin_hash|access_key)/i.test(key)).map(([key,item])=>[key,redactPrivate(item)]));
  return typeof value==='string' && value.length>5000 ? value.slice(0,5000)+' [text truncated]' : value;
}
