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
 const response=await fetch(endpoint,{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({model:model.model_id,messages,temperature:.25,max_tokens:tokens}),signal:AbortSignal.timeout(45000)});
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
function parsePlan(raw,prompt,maxAgents){
 try{
  const candidate=raw.match(/\{[\s\S]*\}/)?.[0];
  if(candidate){
   const parsed=JSON.parse(candidate);
   const agents=(Array.isArray(parsed.agents)?parsed.agents:[]).map(a=>({role:String(a.role||"specialist").slice(0,60),task:String(a.task||"").slice(0,2400)})).filter(a=>a.task.trim()).slice(0,maxAgents);
   if(agents.length)return {plan:JSON.stringify(parsed,null,2),agents};
  }
 }catch{}
 return {plan:raw,agents:[
  {role:"implementer",task:"Complete the requested outcome with concrete deliverables: "+prompt},
  {role:"independent_checker",task:"Independently verify the requested outcome, identify omissions and propose corrections: "+prompt}
 ].slice(0,maxAgents)};
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
  const rawPlan=await role(env,chosen,0,[{role:"system",content:"You are the AWE Workforce Director. Decompose the request into independent agent tasks. Return ONLY valid JSON: {objective:string, agents:[{role:string,task:string}], risks:string[]}. Use 2-4 complementary roles when useful, no more than 4. Each task must be concrete. Never claim actions not performed."},{role:"user",content:task.prompt+memory}],1500);
  const maxAgents=chosen.length===1?2:Math.min(3,chosen.length),parsed=parsePlan(rawPlan,task.prompt,maxAgents),specs=parsed.agents.slice(0,maxAgents);
  const execute=async(spec,index)=>({role:spec.role,output:await role(env,chosen,index%chosen.length,[{role:"system",content:"You are a specialist agent in a collaborative AI workforce. Execute only your assigned subtask, produce concrete outputs, cite uncertainty, and do not claim external actions."},{role:"user",content:"Overall request:\\n"+task.prompt+"\\nYour assigned role: "+spec.role+"\\nYour subtask:\\n"+spec.task+memory}],2200)});
  const agents=chosen.length===1?await (async()=>{const out=[];for(let i=0;i<specs.length;i++)out.push(await execute(specs[i],i));return out})():await Promise.all(specs.map((spec,i)=>execute(spec,i)));
  const work=agents.map(a=>"## "+a.role+"\\n"+a.output).join("\\n\\n");
  const review=await role(env,chosen,Math.max(0,chosen.length-1),[{role:"system",content:"You are the independent QA lead. Review all specialist outputs against the original request. Resolve conflicts, identify missing requirements and security risks, then provide one coherent final deliverable. Do not reveal hidden reasoning."},{role:"user",content:"Original request:\\n"+task.prompt+"\\nDirector plan:\\n"+parsed.plan+"\\nSpecialist outputs:\\n"+work}],2600);
  await event(env,task.id,"planner","completed",parsed.plan);
  for(const agent of agents)await event(env,task.id,agent.role,"completed",agent.output);
  await event(env,task.id,"reviewer","completed",review);
  await env.DB.prepare("UPDATE tasks SET status='completed',result=?,error=NULL,updated_at=?,finished_at=? WHERE id=?").bind(JSON.stringify({plan:parsed.plan,work,review,agents}),iso(),iso(),task.id).run();
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
   const checkedAt=iso(),health={online:true,encryption_ready:!!env.APP_ENCRYPTION_KEY,checked_at:checkedAt};
   await env.DB.prepare("INSERT INTO settings (key,value,updated_at) VALUES ('scheduler_health',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(JSON.stringify(health),checkedAt).run();
   const cutoff=new Date(Date.now()-15*60*1000).toISOString();
   const stale=await env.DB.prepare("UPDATE tasks SET status='queued',updated_at=? WHERE status='running' AND started_at<?").bind(iso(),cutoff).run();
   if(stale.meta.changes)await env.DB.prepare("UPDATE models SET active_count=0").run();
   const max=Math.max(1,Math.min(10,Number(env.MAX_ACTIVE_TASKS||5)));
   for(let i=0;i<max;i++){const did=await processOne(env);if(!did)break}
  })());
 },
 async fetch(){return new Response("AWE AI Workforce scheduler is online",{status:200})}
};