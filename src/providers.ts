import type {Env,ModelRow} from "./types";
import {decryptSecret} from "./security";
export async function complete(env:Env,m:ModelRow,messages:Array<{role:string;content:string}>,maxTokens=1800){
 const key=await decryptSecret(env,m.encrypted_api_key);
 const base=m.base_url.endsWith("/")?m.base_url.slice(0,-1):m.base_url;
 const url=base.endsWith("/chat/completions")?base:base+"/chat/completions";
 const r=await fetch(url,{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({model:m.model_id,messages,temperature:.25,max_tokens:maxTokens})});
 if(!r.ok)throw new Error(m.provider+" HTTP "+r.status+": "+(await r.text()).slice(0,800));
 const d:any=await r.json();const text=d?.choices?.[0]?.message?.content;
 if(typeof text!=="string"||!text.trim())throw new Error("Provider returned no text");return text;
}
