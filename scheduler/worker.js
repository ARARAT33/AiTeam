const iso=()=>new Date().toISOString();
const id=()=>crypto.randomUUID();
const enc=new TextEncoder();
const b64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const unb64=b=>btoa(String.fromCharCode(...b));
async function decrypt(env,value){
 const [iv,cipher]=value.split(".");
 const raw=/^[0-9a-f]{64}$/i.test(env.APP_ENCRYPTION_KEY)?Uint8Array.from(env.APP_ENCRYPTION_KEY.match(/.{2}/g),x=>parseInt(x,16)):enc.encode(env.APP_ENCRYPTION_KEY);
 const material=await crypto.subtle.importKey("raw",raw,"HKDF",false,["deriveKey"]);
 const key=await crypto.subtle.deriveKey({name:"HKDF",hash:"SHA-256",salt:enc.encode("awe-workforce"),info:enc.encode("provider-keys-v1")},material,{name:"AES-GCM",length:256},false,["decrypt"]);
 const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:b64(iv)},key,b64(cipher));
 return new TextDecoder().decode(plain);
}
async function call(env,model,messages,tokens){
 const day=new Date().toISOString().slice(0,10);
 await env.DB.prepare("UPDATE models SET daily_used=0,usage_day=? WHERE id=? AND usage_day<>?").bind(day,model.id,day).run();
 const quota=await env.DB.prepare("UPDATE models SET daily_used=daily_used+1 WHERE id=? AND enabled=1 AND daily_used<daily_limit").bind(model.id).run();
 if(!quota.meta.changes)throw new Error("Daily quota exhausted: "+model.name);
 const key=await decrypt(env,model.encrypted_api_key);
 const base=model.base_url.endsWith("/")?model.base_url.slice(0,-1):model.base_url;
 const endpoint=base.endsWith("/chat/completions")?base:base+"/chat/completions";
 const response=await fetch(endpoint,{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({model:model.model_id,messages,temperature:.25,max_tokens:tokens})});
 if(!response.ok)throw new Error(model.provider+" HTTP "+response.status+": "+(await response.text()).slice(0,700));
 const data=await response.json(),content=data?.choices?.[0]?.message?.content;
 if(typeof content!=="string"||!content.trim())throw new Error("Provider returned empty output");
 return content;
}
async function role(env,models,start,messages,tokens){
 const errors=[];
 for(let i=0;i<models.length;i++){const model=models[(start+i)%models.length];try{return await call(env,model,messages,tokens)}catch(e){errors.push(model.name+": "+String(e?.message||e))}}
 throw new Error("All model fallbacks failed: "+errors.join(" | ").slice(0,1200));
}
async function event(env,task,agent,type,detail){
 await env.DB.prepare("INSERT INTO task_events (id,task_id,agent,event,detail,created_at) VALUES (?,?,?,?,?,?)").bind(id(),task,agent,type,String(detail).slice(0,3500),iso()).run();
}
async function processOne(env){
 const active=await env.DB.prepare("SELECT COUNT(*) count FROM tasks WHERE status='running'").first();
 if((active?.count||0)>=Number(env.MAX_ACTIVE_TASKS||5))return false;
 const task=await env.DB.prepare("SELECT * FROM tasks WHERE status='queued' ORDER BY priority DESC,created_at ASC LIMIT 1").first();
 if(!task)return false;
 const t=iso(),claim=await env.DB.prepare("UPDATE tasks SET status='running',attempts=attempts+1,started_at=?,updated_at=? WHERE id=? AND status='queued'").bind(t,t,task.id).run();
 if(!claim.meta.changes)return true;
 const chosen=[];
 try{
  await event(env,task.id,"director","started","Planning and assigning agents");
  const day=new Date().toISOString().slice(0,10);
  await env.DB.prepare("UPDATE models SET daily_used=0,usage_day=? WHERE usage_day<>?").bind(day,day).run();
  const models=await env.DB.prepare("SELECT * FROM models WHERE enabled=1 AND daily_used<daily_limit AND active_count<max_concurrency ORDER BY priority DESC,(daily_limit-daily_used) DESC LIMIT 8").all();
  if(!models.results.length)throw new Error("No enabled model has remaining quota and concurrency");
  chosen.push(...models.results.slice(0,3));
  for(const m of chosen)await env.DB.prepare("UPDATE models SET active_count=active_count+1 WHERE id=?").bind(m.id).run();
  const memories=await env.DB.prepare("SELECT content FROM memories ORDER BY created_at DESC LIMIT 8").all();
  const context=memories.results.map(x=>x.content).join("\n---\n");
  const memory=context?"\nRelevant prior memory:\n"+context:"";
  const plan=await role(env,chosen,0,[{role:"system",content:"You are the AWE Workforce Director. Produce an execution plan, deliverables and risks. Do not claim unperformed actions."},{role:"user",content:task.prompt+memory}],1200);
  const work=await role(env,chosen,1%chosen.length,[{role:"system",content:"You are a specialist worker. Execute the plan concretely and state limitations honestly."},{role:"user",content:"Request:\n"+task.prompt+"\nDirector plan:\n"+plan+memory}],3000);
  const review=await role(env,chosen,2%chosen.length,[{role:"system",content:"You are independent QA. Find omissions, uncertainty and security issues, then provide the improved final deliverable. Do not reveal hidden reasoning."},{role:"user",content:"Request:\n"+task.prompt+"\nPlan:\n"+plan+"\nWorker output:\n"+work}],2400);
  await event(env,task.id,"planner","completed",plan);
  await event(env,task.id,"worker","completed",work);
  await event(env,task.id,"reviewer","completed",review);
  await env.DB.prepare("UPDATE tasks SET status='completed',result=?,error=NULL,updated_at=?,finished_at=? WHERE id=?").bind(JSON.stringify({plan,work,review}),iso(),iso(),task.id).run();
  await env.DB.prepare("INSERT INTO memories (id,task_id,kind,content,created_at) VALUES (?,?, 'task_summary', ?,?)").bind(id(),task.id,(task.title+": "+review).slice(0,5000),iso()).run();
 }catch(error){
  const message=String(error?.message||error);
  await event(env,task.id,"system","error",message);
  if(task.attempts+1<task.max_attempts)await env.DB.prepare("UPDATE tasks SET status='queued',error=?,updated_at=? WHERE id=?").bind(message.slice(0,1400),iso(),task.id).run();
  else await env.DB.prepare("UPDATE tasks SET status='failed',error=?,updated_at=?,finished_at=? WHERE id=?").bind(message.slice(0,1400),iso(),iso(),task.id).run();
 }finally{
  for(const m of chosen)await env.DB.prepare("UPDATE models SET active_count=MAX(0,active_count-1) WHERE id=?").bind(m.id).run();
 }
 return true;
}
export default {
 async scheduled(_event,env,ctx){
  ctx.waitUntil((async()=>{
   const cutoff=new Date(Date.now()-15*60*1000).toISOString();
   const stale=await env.DB.prepare("UPDATE tasks SET status='queued',updated_at=? WHERE status='running' AND started_at<?").bind(iso(),cutoff).run();
   if(stale.meta.changes)await env.DB.prepare("UPDATE models SET active_count=0").run();
   const max=Math.max(1,Math.min(10,Number(env.MAX_ACTIVE_TASKS||5)));
   for(let i=0;i<max;i++){const did=await processOne(env);if(!did)break}
  })());
 },
 async fetch(){return new Response("AWE AI Workforce scheduler is online",{status:200})}
};