import test from 'node:test';
import assert from 'node:assert/strict';
import {orderQueuedLabelBatch} from '../src/lib/ballLabelQueue.js';
test('queued labels preserve selection order and database verification metadata',()=>{
 const batch={policy_version:2,snapshot_version:'v1',checked_at:'now',labels:[{signupId:'b',cadetName:'B'},{signupId:'a',cadetName:'A'}]};
 const sorted=orderQueuedLabelBatch(batch,['a','b']);
 assert.deepEqual(sorted.labels.map(p=>p.signupId),['a','b']);assert.equal(sorted.snapshot_version,'v1');assert.deepEqual(batch.labels.map(p=>p.signupId),['b','a']);
});
test('queue refuses partial, duplicate, unexpected, and empty batches',()=>{
 const batch={labels:[{signupId:'a'}]};
 assert.throws(()=>orderQueuedLabelBatch(batch,['a','b']),/nothing was printed/);
 assert.throws(()=>orderQueuedLabelBatch(batch,['b']),/nothing was printed/);
 assert.throws(()=>orderQueuedLabelBatch({labels:[{signupId:'a'},{signupId:'a'}]},['a','b']),/nothing was printed/);
 assert.throws(()=>orderQueuedLabelBatch(batch,['a','a']),/nothing was printed/);
 assert.throws(()=>orderQueuedLabelBatch({labels:[]},[]),/nothing was printed/);
});

import {ballLabelBatchLayout} from '../src/lib/ballLabelPrint.js';
test('multiple selected labels share one sheet and continue from a partial sheet',()=>{
 const labels=[{cadetName:'A'},{cadetName:'B'}];
 const fresh=ballLabelBatchLayout(labels,0);assert.equal(fresh.sheets.length,1);assert.deepEqual(fresh.sheets[0].map(cell=>cell.index),[0,1]);
 const partial=ballLabelBatchLayout(labels,29);assert.equal(partial.sheets.length,2);assert.equal(partial.sheets[0][0].index,29);assert.equal(partial.sheets[1][0].index,0);assert.equal(partial.nextIndex,1);
});
