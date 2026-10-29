import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
import {getCaller} from "../_shared/supabase.ts";
import {json,preflight} from "../_shared/http.ts";
import {generatePdf} from "../_shared/pdf/tools.ts";
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return preflight();
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 const caller=await getCaller(req);
 if(!caller||caller.role!=='s6'||caller.mustChangePassword)return json({error:'S-6 required'},403);
 try{
  const body=await req.json();
  const scoped=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:req.headers.get('Authorization')!}},auth:{persistSession:false}});
  const artifact=await generatePdf('generate_ball_receipts_pdf',body.filters||{},scoped,'s6');
  return json({artifact});
 }catch(e){return json({error:e instanceof Error?e.message:'Could not generate current receipts'},400);}
});
