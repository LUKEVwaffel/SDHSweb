// Require every selected reservation to be present before printing any of them.
export function orderQueuedLabelBatch(batch, ids) {
  const wanted=new Set(ids);
  const labels=new Map((batch.labels||[]).map(label=>[label.signupId,label]));
  if(!ids.length||wanted.size!==ids.length||labels.size!==ids.length||batch.labels.length!==ids.length||ids.some(id=>!labels.has(id)))throw new Error('Some selected reservations are no longer available for labels. Refresh and review the queue; nothing was printed.');
  return {...batch,labels:ids.map(id=>labels.get(id))};
}
