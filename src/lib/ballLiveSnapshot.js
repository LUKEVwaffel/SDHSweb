import {supabase as SB} from './supabaseClient';
export async function readBallLiveSnapshot(){
 const {data,error}=await SB.rpc('ball_ticket_snapshot');
 if(error)throw error;
 if(!data?.version||!data.checked_at||!['hosts','guests','roster','deliveries'].every(key=>Array.isArray(data[key])))throw new Error('The current Ball ledger could not be verified. Refresh before printing or delivering tickets.');
 return data;
}
