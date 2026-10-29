import {supabase as SB} from './supabaseClient';
export async function readBallLiveSnapshot(){
 const {data,error}=await SB.rpc('ball_ticket_snapshot',{p_policy_version:2});
 if(error)throw error;
 if(data?.policy_version!==2||!data?.version||!data.checked_at||!['hosts','guests','roster','deliveries'].every(key=>Array.isArray(data[key])))throw new Error('The current Ball ledger could not be verified. Refresh before printing or delivering tickets.');
 return data;
}

export async function readBallLabelBatch(signupIds,undeliveredOnly=false){
 const {data,error}=await SB.rpc('ball_label_print_batch',{p_signup_ids:signupIds,p_undelivered_only:undeliveredOnly});
 if(error)throw error;
 if(data?.policy_version!==2||!data?.snapshot_version||!data.checked_at||!Array.isArray(data.labels)||!data.labels.length)throw new Error('The database could not confirm a complete label batch. Nothing was printed.');
 const current=await readBallLiveSnapshot();
 if(current.version!==data.snapshot_version)throw new Error('Reservations changed while preparing labels. Refresh and retry; nothing was printed.');
 return data;
}
