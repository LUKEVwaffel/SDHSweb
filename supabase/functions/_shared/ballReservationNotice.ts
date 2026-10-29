const money = (value: unknown) => `$${Number(value ?? 0).toFixed(2)}`;

// Shared transactional content; delivery uses the standard Ball email shell.
export function reservationChangeMessages(result: Record<string, any>) {
  if(result.action==='add_guest')return newGuestMessages(result);
  if (result.action === 'restore_date') return restorationMessages(result);
  if (result.action === 'add_date') return additionMessages(result);
  const split = result.action === 'split_date';
  const friend = result.action === 'remove_friend';
  return [
    { key: 'host', email: result.host_email, name: result.host_name,
      description: split
        ? `${result.date_name} now has a separate solo reservation. Your reservation remains active as a solo reservation.`
        : `${result.date_name} has been removed as your ${friend ? 'friend' : 'date'} and is no longer registered through your reservation. Your own reservation remains active.`,
      total: result.host_total, paid: result.host_paid, balance: result.host_balance, credit: result.host_credit },
    { key: 'date', email: result.date_email, name: result.date_name,
      description: split
        ? `Your reservation has been separated from ${result.host_name}'s couple reservation. You now have your own solo reservation.`
        : `You have been removed as ${result.host_name}'s ${friend ? 'friend' : 'date'}. You no longer have a place through that reservation. ${result.host_name}'s own reservation remains active. Contact Chief if you still plan to attend.`,
      total: result.date_total, paid: result.date_paid, balance: result.date_balance, credit: result.date_credit },
  ].map(message => ({ ...message, lines: [
    message.description,
    friend
      ? `Previous ${message.key === 'host' ? 'host' : 'friend'} ticket total: ${money(message.key === 'host' ? result.old_host_total : result.old_friend_total)}. Recorded payment before change: ${money(message.key === 'host' ? result.old_host_paid : result.old_friend_paid)}.`
      : `Previous couple total: ${money(result.old_total)}. Recorded payment before change: ${money(result.old_paid)}.`,
    `Revised reservation total: ${money(message.total)}. Payment recorded: ${money(message.paid)}. Balance due: ${money(message.balance)}.`,
    message.credit > 0 ? `Credit for staff review: ${money(message.credit)}. No refund has been issued automatically.` : '',
    friend ? 'The host ticket price and recorded host payment are unchanged. Any recorded friend payment is retained in the change audit for staff credit/refund review and is not transferred to the host.' : '',
    !split && !friend && message.key === 'date' ? `All previously recorded payment remains on ${result.host_name}'s reservation. Contact Chief about any payment or refund questions.` : '',
  ].filter(Boolean) }));
}

function additionMessages(result: Record<string, any>) {
  return [
    {key:'host',email:result.host_email,name:result.host_name,description:`${result.date_name} has been added as your date. You are both attending on your couple reservation.`},
    {key:'date',email:result.date_email,name:result.date_name,description:`You have been added as ${result.host_name}'s date. Your former solo ticket has been merged into the couple reservation. You are still attending; your attendance has not been cancelled.`},
  ].map(message=>({...message,lines:[
    message.description,
    `Previous solo ticket totals: ${result.host_name} ${money(result.old_host_total)}; ${result.date_name} ${money(result.old_date_total)}.`,
    `Recorded payments combined: ${result.host_name} ${money(result.old_host_paid)}; ${result.date_name} ${money(result.old_date_paid)}.`,
    `Shared couple ticket total: ${money(result.host_total)}. Total payment recorded: ${money(result.host_paid)}. Shared balance due: ${money(result.host_balance)}. This is one shared balance, not a separate charge to each person.`,
    result.host_credit>0 ? `Credit for staff review: ${money(result.host_credit)}. No refund has been issued automatically.` : '',
    'Your existing form and outfit approval records have been carried over. Any outstanding attendance requirements still need to be completed. This update does not approve missing forms or dress requirements.',
  ].filter(Boolean)}));
}

function restorationMessages(result: Record<string, any>) {
  return [
    { key: 'host', email: result.host_email, name: result.host_name },
    { key: 'date', email: result.date_email, name: result.date_name },
  ].map(message => ({ ...message, lines: [
    `${result.date_name} has been added as ${result.host_name}'s date on one couple reservation, using the guest details saved from the previous reservation.`,
    `Shared couple total: ${money(result.host_total)}. Payment recorded: ${money(result.host_paid)}. Shared balance due: ${money(result.host_balance)}. This is one shared balance, not a separate charge to each person.`,
    `Previous credit of ${money(result.previous_credit)} remains in the removal audit for staff refund review. No previous payment has been transferred and no refund has been issued automatically.`,
    result.host_credit > 0 ? `Current couple credit for staff review: ${money(result.host_credit)}.` : '',
    result.guest_verified ? 'Previously completed guest verification has been preserved.' : 'Guest verification is still outstanding. Contact Ball staff to arrange a new invitation.',
    'Existing form and outfit records have been preserved. Outstanding requirements still need to be completed; this update does not approve missing forms or dress requirements.',
  ].filter(Boolean) }));
}

export function newGuestMessages(result:Record<string,any>){
 const friend=result.guest_type==='friend';
 return [{key:'host',name:result.host_name,email:result.host_email,lines:[
  `${result.date_name} has been added as your ${friend?'friend':'date'} on your Military Ball reservation.`,
  `Host ticket total at this change: ${money(result.host_total)}. Existing payment preserved: ${money(result.host_paid)}. Host balance: ${money(result.host_balance)}.`,
  friend?`The friend ticket is a separate ${money(result.date_total)} charge. It has no payment recorded; record the guest payment separately, including if you bring it.`:'The couple total covers both attendees; there is no separate date ticket charge.',
  'A separate guest verification invitation is required. Staff can check its delivery status. Adding this guest does not mark verification, forms or attire complete. Existing host form and attire records are preserved.',
  result.host_credit>0?`Credit for staff review: ${money(result.host_credit)}. No automatic refund was issued.`:'',
 ].filter(Boolean)}];
}
