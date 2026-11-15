import type {Env,ModelRow,TaskRow} from "./types";
import {cookie,verifySession,signSession,encryptSecret,now,randomId,json} from "./security";
import {runTeam} from "./agents";

async function readBody(req:Request){try{const raw=await req.text();if(raw.length>20000)return {};return JSON.parse(raw) as Record<string,any>}catch{return {}}}
async function audit(env:Env,actor:string,action:string,targetType:string,targetId:string|null,detail=""){await env.DB.prepare("INSERT INTO audit_logs (id,actor,action,target_type,target_id,detail,created_at) VALUES (?,?,?,?,?,?,?)").bind(randomId(),actor,action,targetType,targetId,String(detail).slice(0,1500),now()).run()}
async function admin(req:Request,env:Env){const login=await verifySession(env,cookie(req,"__Host-awe_session"));return login&&login.toLowerCase()===(env.ADMIN_GITHUB_LOGIN||"ARARAT33").toLowerCase()?login:null}
function clearCookie(name:string){return name+"=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"}
function safeUrl(value:string){try{if(value.length>2048)return null;const u=new URL(value);const host=u.hostname.toLowerCase();if(u.protocol!=="https:"||u.username||u.password||u.search||u.hash||u.port&&u.port!=="443"||!host.includes(".")||host==="localhost"||host.endsWith(".localhost")||host.endsWith(".local")||host.endsWith(".internal")||host.includes(":")||/^\d{1,3}(\.\d{1,3}){3}$/.test(host))return null;const out=u.toString();return out.endsWith("/")?out.slice(0,-1):out}catch{return null}}
async function auth(req:Request,env:Env,url:URL):Promise<Response|null>{
 if(url.pathname==="/api/auth/login"){
  if(!env.GITHUB_CLIENT_ID||!env.GITHUB_CLIENT_SECRET||!env.SESSION_SECRET)return json({error:"GitHub OAuth secrets are not configured"},503);
  const state=randomId(),target=new URL("https://github.com/login/oauth/authorize");
  target.searchParams.set("client_id",env.GITHUB_CLIENT_ID);target.searchParams.set("redirect_uri",env.GITHUB_CALLBACK_URL||url.origin+"/api/auth/callback");target.searchParams.set("scope","read:user user:email");target.searchParams.set("state",state);
  return new Response(null,{status:302,headers:{Location:target.toString(),"Set-Cookie":"__Host-awe_oauth_state="+state+"; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600"}});
 }
 if(url.pathname==="/api/auth/callback"){
  if(cookie(req,"__Host-awe_oauth_state")!==url.searchParams.get("state"))return json({error:"OAuth state mismatch"},400);
  const code=url.searchParams.get("code");if(!code)return json({error:"Missing OAuth code"},400);
  const tr=await fetch("https://github.com/login/oauth/access_token",{method:"POST",headers:{Accept:"application/json","Content-Type":"application/json"},body:JSON.stringify({client_id:env.GITHUB_CLIENT_ID,client_secret:env.GITHUB_CLIENT_SECRET,code,redirect_uri:env.GITHUB_CALLBACK_URL||url.origin+"/api/auth/callback"})});
  const td:any=await tr.json();if(!td.access_token)return json({error:"GitHub token exchange failed"},401);
  const pr=await fetch("https://api.github.com/user",{headers:{Authorization:"Bearer "+td.access_token,Accept:"application/vnd.github+json","User-Agent":"AWE-AI-Workforce"}});
  const profile:any=await pr.json(),expected=(env.ADMIN_GITHUB_LOGIN||"ARARAT33").toLowerCase();
  if(!profile.login||String(profile.login).toLowerCase()!==expected)return new Response("Access denied",{status:403,headers:{"Set-Cookie":clearCookie("__Host-awe_oauth_state"),"Cache-Control":"no-store"}});
  const emailsResponse=await fetch("https://api.github.com/user/emails",{headers:{Authorization:"Bearer "+td.access_token,Accept:"application/vnd.github+json","User-Agent":"AWE-AI-Workforce"}});
  if(!emailsResponse.ok)return json({error:"Could not verify GitHub email"},502);
  const emails:any[]=await emailsResponse.json(),expectedEmail=(env.ADMIN_GITHUB_EMAIL||"araratavetisyan777999@gmail.com").toLowerCase();
  const verified=emails.some(e=>String(e.email||"").toLowerCase()===expectedEmail&&e.verified===true&&e.primary===true);
  if(!verified)return new Response("Access denied: verified primary GitHub email required",{status:403,headers:{"Set-Cookie":clearCookie("__Host-awe_oauth_state"),"Cache-Control":"no-store"}});
  const token=await signSession(env,profile.login),h=new Headers({Location:"/", "Cache-Control":"no-store"});
  h.append("Set-Cookie","__Host-awe_session="+token+"; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800");h.append("Set-Cookie",clearCookie("__Host-awe_oauth_state"));
  return new Response(null,{status:302,headers:h});
 }
 if(url.pathname==="/api/auth/me"){const login=await admin(req,env);return json({authenticated:!!login,login})}
 if(url.pathname==="/api/auth/logout"&&req.method==="POST"){if(req.headers.get("Origin")!==url.origin)return json({error:"Cross-origin request blocked"},403);return new Response(JSON.stringify({ok:true}),{headers:{"Content-Type":"application/json","Cache-Control":"no-store","Set-Cookie":clearCookie("__Host-awe_session")}})}
 return null;
}
export async function handleApi(req:Request,env:Env,url:URL):Promise<Response>{
 const a=await auth(req,env,url);if(a)return a;
 if(!["GET","HEAD","OPTIONS"].includes(req.method)){
  const origin=req.headers.get("Origin");
  if(!origin||origin!==url.origin)return json({error:"Cross-origin request blocked"},403);
  if(!req.headers.get("Content-Type")?.toLowerCase().includes("application/json"))return json({error:"JSON content type required"},415);
 }
 const login=await admin(req,env);if(!login)return json({error:"Authentication required"},401);
 if(url.pathname==="/api/health")return json({ok:true,service:"AWE AI Workforce",time:now()});
 if(url.pathname==="/api/audit"&&req.method==="GET"){const r=await env.DB.prepare("SELECT id,actor,action,target_type,target_id,detail,created_at FROM audit_logs ORDER BY created_at DESC LIMIT 100").all();return json({entries:r.results})}
 if(url.pathname==="/api/overview"){
  const [tasks,models,plugins,healthRow]=await Promise.all([env.DB.prepare("SELECT status,COUNT(*) count FROM tasks GROUP BY status").all(),env.DB.prepare("SELECT COUNT(*) total,SUM(enabled) enabled FROM models").first(),env.DB.prepare("SELECT COUNT(*) total,SUM(enabled) enabled FROM plugins").first(),env.DB.prepare("SELECT value FROM settings WHERE key='scheduler_health'").first<{value:string}>()]);
  let scheduler={online:false,encryptionReady:false,checkedAt:null as string|null};
  try{const h=JSON.parse(healthRow?.value||"{}");scheduler={online:h.online===true&&Date.now()-Date.parse(h.checked_at)<180000,encryptionReady:h.encryption_ready===true,checkedAt:h.checked_at||null}}catch{}
  return json({tasks:tasks.results,models,plugins,operator:login,scheduler,security:{ownerIdentity:!!env.ADMIN_GITHUB_LOGIN&&!!env.ADMIN_GITHUB_EMAIL,githubOAuth:!!env.GITHUB_CLIENT_ID&&!!env.GITHUB_CLIENT_SECRET,sessionSigning:!!env.SESSION_SECRET,providerEncryption:!!env.APP_ENCRYPTION_KEY}});
 }
 if(url.pathname==="/api/models"&&req.method==="GET"){
  const r=await env.DB.prepare("SELECT id,name,provider,model_id,base_url,enabled,priority,daily_limit,daily_used,usage_day,max_concurrency,active_count,CASE WHEN encrypted_api_key='PENDING_API_KEY' THEN 0 ELSE 1 END AS key_ready FROM models ORDER BY priority DESC").all();return json({models:r.results});
 }
 if(url.pathname==="/api/models"&&req.method==="POST"){
  const d=await readBody(req),name=String(d.name||"").slice(0,80),provider=String(d.provider||"custom").slice(0,40),model=String(d.model_id||"").slice(0,160),base=safeUrl(String(d.base_url||"")),key=String(d.api_key||"");
  if(!name||!model||!base||key.length<8||key.length>4096)return json({error:"Name, model ID, safe HTTPS base URL and API key (8–4096 characters) are required"},400);
  const id=randomId(),t=now(),secret=await encryptSecret(env,key);
  await env.DB.prepare("INSERT INTO models (id,name,provider,model_id,base_url,encrypted_api_key,enabled,priority,daily_limit,max_concurrency,created_at,updated_at) VALUES (?,?,?,?,?,?,1,?,?,?,?,?)").bind(id,name,provider,model,base,secret,Number(d.priority)||100,Math.max(1,Number(d.daily_limit)||100),Math.max(1,Number(d.max_concurrency)||1),t,t).run();
  await audit(env,login,"model.created","model",id,name);
  return json({id,ok:true},201);
 }
 if(url.pathname.startsWith("/api/models/")&&req.method==="PATCH"){
  const id=url.pathname.split("/").pop()!,d=await readBody(req),keys=["enabled","priority","daily_limit","max_concurrency","name"],sets:string[]=[],vals:any[]=[];
  if(d.enabled===true){const model=await env.DB.prepare("SELECT encrypted_api_key FROM models WHERE id=?").bind(id).first<{encrypted_api_key:string}>();if(!model)return json({error:"Model not found"},404);if(model.encrypted_api_key==="PENDING_API_KEY")return json({error:"Add and save this model's API key before enabling it."},409)}for(const k of keys)if(d[k]!==undefined){sets.push(k+"=?");vals.push(k==="enabled"?(d[k]?1:0):k==="name"?String(d[k]).slice(0,80):Math.max(k==="priority"?0:1,Number(d[k])||0))}
  if(typeof d.api_key==="string"&&d.api_key.length){if(d.api_key.length<8||d.api_key.length>4096)return json({error:"API key must be 8–4096 characters"},400);sets.push("encrypted_api_key=?");vals.push(await encryptSecret(env,d.api_key))}
  if(!sets.length)return json({error:"No supported fields"},400);sets.push("updated_at=?");vals.push(now(),id);
  await env.DB.prepare("UPDATE models SET "+sets.join(",")+" WHERE id=?").bind(...vals).run();await audit(env,login,"model.updated","model",id,Object.keys(d).join(","));return json({ok:true});
 }
 if(url.pathname.startsWith("/api/models/")&&req.method==="DELETE"){const id=url.pathname.split("/").pop()!;await env.DB.prepare("DELETE FROM models WHERE id=?").bind(id).run();await audit(env,login,"model.deleted","model",id);return json({ok:true})}
 if(url.pathname==="/api/autonomous/standard"&&req.method==="GET"){const row=await env.DB.prepare("SELECT value FROM settings WHERE key=?").bind("autonomous_quality_standard").first<{value:string}>();let standard="";try{standard=String(JSON.parse(row?.value||"{}").standard||"")}catch{}return json({standard,updated_at:row?true:false})}
 if(url.pathname==="/api/autonomous/standard"&&req.method==="POST"){const d=await readBody(req),standard=String(d.standard||"").trim().slice(0,10000);if(!standard)return json({error:"Quality standard is required"},400);await env.DB.prepare("INSERT INTO settings (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind("autonomous_quality_standard",JSON.stringify({standard}),now()).run();await audit(env,login,"autonomous.standard.updated","settings","autonomous_quality_standard","Updated autonomous acceptance standard");return json({ok:true,standard})}
 if(url.pathname==="/api/tasks"&&req.method==="GET"){const r=await env.DB.prepare("SELECT id,title,prompt,status,priority,result,error,attempts,max_attempts,created_at,updated_at FROM tasks ORDER BY created_at DESC LIMIT 100").all();return json({tasks:r.results})}
 if(url.pathname==="/api/tasks"&&req.method==="POST"){
  const d=await readBody(req),title=String(d.title||"New task").slice(0,160),prompt=String(d.prompt||"").slice(0,12000);if(!prompt.trim())return json({error:"Task prompt is required"},400);
  const count=await env.DB.prepare("SELECT COUNT(*) count FROM tasks WHERE status IN ('queued','running')").first<{count:number}>();if((count?.count||0)>=100)return json({error:"Queue is full"},429);
  const id=randomId(),t=now();await env.DB.prepare("INSERT INTO tasks (id,title,prompt,status,priority,max_attempts,created_at,updated_at) VALUES (?,?,?,'queued',?,?,?,?)").bind(id,title,prompt,Math.min(100,Math.max(0,Number(d.priority)||50)),Math.max(1,Math.min(5,Number(env.MAX_TASK_ATTEMPTS)||3)),t,t).run();
  await env.DB.prepare("INSERT INTO task_events (id,task_id,agent,event,detail,created_at) VALUES (?,?,?,'queued',?,?)").bind(randomId(),id,"system","Task added to persistent queue",t).run();await audit(env,login,"task.created","task",id,title);return json({id,status:"queued"},201);
 }
 if(url.pathname.startsWith("/api/tasks/")&&url.pathname.endsWith("/retry")&&req.method==="POST"){
  const id=url.pathname.split("/")[3],t=now();
  const result=await env.DB.prepare("UPDATE tasks SET status='queued',attempts=0,error=NULL,started_at=NULL,finished_at=NULL,updated_at=? WHERE id=? AND status='failed'").bind(t,id).run();
  if(!result.meta.changes)return json({error:"Only failed tasks can be retried"},409);
  await env.DB.prepare("INSERT INTO task_events (id,task_id,agent,event,detail,created_at) VALUES (?,?,?,'retry_requested',?,?)").bind(randomId(),id,login,"Manual retry requested",t).run();await audit(env,login,"task.retried","task",id);
  return json({ok:true,status:"queued"});
 }
 if(url.pathname.startsWith("/api/tasks/")&&url.pathname.endsWith("/cancel")&&req.method==="POST"){
  const id=url.pathname.split("/")[3],t=now();
  const result=await env.DB.prepare("UPDATE tasks SET status='cancelled',updated_at=?,finished_at=? WHERE id=? AND status='queued'").bind(t,t,id).run();
  if(!result.meta.changes)return json({error:"Only queued tasks can be cancelled"},409);
  await env.DB.prepare("INSERT INTO task_events (id,task_id,agent,event,detail,created_at) VALUES (?,?,?,'cancelled',?,?)").bind(randomId(),id,login,"Queued task cancelled",t).run();await audit(env,login,"task.cancelled","task",id);
  return json({ok:true,status:"cancelled"});
 }
 if(url.pathname.startsWith("/api/tasks/")&&url.pathname.endsWith("/events")){const id=url.pathname.split("/")[3],r=await env.DB.prepare("SELECT agent,event,detail,created_at FROM task_events WHERE task_id=? ORDER BY created_at ASC LIMIT 200").bind(id).all();return json({events:r.results})}
 if(url.pathname.startsWith("/api/tasks/")&&req.method==="DELETE"){await env.DB.prepare("DELETE FROM tasks WHERE id=? AND status<>'running'").bind(url.pathname.split("/").pop()!).run();return json({ok:true})}
 if(url.pathname==="/api/memory"&&req.method==="GET"){const r=await env.DB.prepare("SELECT id,task_id,kind,content,created_at FROM memories ORDER BY created_at DESC LIMIT 100").all();return json({memories:r.results})}
 if(url.pathname==="/api/plugins"&&req.method==="GET"){const r=await env.DB.prepare("SELECT id,name,description,version,manifest,enabled,requires_approval,created_at FROM plugins ORDER BY created_at DESC").all();return json({plugins:r.results})}
 if(url.pathname==="/api/plugins"&&req.method==="POST"){
  const d=await readBody(req),name=String(d.name||"").slice(0,80),description=String(d.description||"").slice(0,500);if(!name)return json({error:"Plugin name required"},400);
  const id=randomId(),t=now(),manifest=JSON.stringify({type:"declarative",version:"1.0.0",capabilities:Array.isArray(d.capabilities)?d.capabilities.slice(0,20):[],note:"Manifest only; executable code is not run."});
  await env.DB.prepare("INSERT INTO plugins (id,name,description,manifest,enabled,requires_approval,created_at,updated_at) VALUES (?,?,?,?,0,1,?,?)").bind(id,name,description,manifest,t,t).run();await audit(env,login,"plugin.registered","plugin",id,name);return json({id,ok:true,enabled:false,requires_approval:true},201);
 }
 if(url.pathname.startsWith("/api/plugins/")&&req.method==="PATCH"){const d=await readBody(req),id=url.pathname.split("/").pop()!;await env.DB.prepare("UPDATE plugins SET enabled=?,updated_at=? WHERE id=?").bind(d.enabled?1:0,now(),id).run();await audit(env,login,"plugin.toggled","plugin",id,d.enabled?"enabled":"disabled");return json({ok:true})}
 return json({error:"Not found"},404);
}
async function event(env:Env,id:string,agent:string,kind:string,detail:string){await env.DB.prepare("INSERT INTO task_events (id,task_id,agent,event,detail,created_at) VALUES (?,?,?,?,?,?)").bind(randomId(),id,agent,kind,detail.slice(0,3500),now()).run()}
export async function processOne(env:Env){
 const limit=Math.max(1,Number(env.MAX_ACTIVE_TASKS)||5),active=await env.DB.prepare("SELECT COUNT(*) count FROM tasks WHERE status='running'").first<{count:number}>();if((active?.count||0)>=limit)return;
 const task=await env.DB.prepare("SELECT * FROM tasks WHERE status='queued' ORDER BY priority DESC,created_at ASC LIMIT 1").first<TaskRow>();if(!task)return;
 const claim=await env.DB.prepare("UPDATE tasks SET status='running',attempts=attempts+1,started_at=?,updated_at=? WHERE id=? AND status='queued'").bind(now(),now(),task.id).run();if(!claim.meta.changes)return;
 let chosen:ModelRow[]=[];
 try{
  await event(env,task.id,"director","started","Planning and assigning agents");
  const day=new Date().toISOString().slice(0,10);await env.DB.prepare("UPDATE models SET daily_used=0,usage_day=? WHERE usage_day<>?").bind(day,day).run();
  const rows=await env.DB.prepare("SELECT * FROM models WHERE enabled=1 AND daily_used<daily_limit AND active_count<max_concurrency ORDER BY priority DESC,(daily_limit-daily_used) DESC LIMIT 8").all<ModelRow>();
  if(!rows.results.length)throw new Error("No enabled model has remaining quota and available concurrency.");
  chosen=rows.results.slice(0,3);
  for(const m of chosen)await env.DB.prepare("UPDATE models SET active_count=active_count+1 WHERE id=?").bind(m.id).run();
  const mem=await env.DB.prepare("SELECT content FROM memories ORDER BY created_at DESC LIMIT 8").all<{content:string}>();
  const result=await runTeam(env,chosen,task.prompt,mem.results.map(x=>x.content));
  await event(env,task.id,"planner","completed",result.plan);await event(env,task.id,"worker","completed",result.work);await event(env,task.id,"reviewer","completed",result.review);
  await env.DB.prepare("UPDATE tasks SET status='completed',result=?,error=NULL,updated_at=?,finished_at=? WHERE id=?").bind(JSON.stringify(result),now(),now(),task.id).run();
  await env.DB.prepare("INSERT INTO memories (id,task_id,kind,content,created_at) VALUES (?,?, 'task_summary', ?,?)").bind(randomId(),task.id,(task.title+": "+result.review).slice(0,5000),now()).run();
 }catch(e){
  const msg=e instanceof Error?e.message:String(e);await event(env,task.id,"system","error",msg);
  if(task.attempts+1<task.max_attempts)await env.DB.prepare("UPDATE tasks SET status='queued',error=?,updated_at=? WHERE id=?").bind(msg.slice(0,1500),now(),task.id).run();
  else await env.DB.prepare("UPDATE tasks SET status='failed',error=?,updated_at=?,finished_at=? WHERE id=?").bind(msg.slice(0,1500),now(),now(),task.id).run();
 }finally{for(const m of chosen)await env.DB.prepare("UPDATE models SET active_count=MAX(0,active_count-1) WHERE id=?").bind(m.id).run()}
}
export async function processBatch(env:Env){const batch=Math.max(1,Math.min(10,Number(env.MAX_ACTIVE_TASKS)||5));for(let i=0;i<batch;i++)await processOne(env)}
export default {
 async fetch(req:Request,env:Env):Promise<Response>{const url=new URL(req.url);if(url.pathname.startsWith("/api/")){try{const r=await handleApi(req,env,url);r.headers.set("X-Content-Type-Options","nosniff");r.headers.set("Referrer-Policy","same-origin");r.headers.set("X-Frame-Options","DENY");return r}catch(e){return json({error:e instanceof Error?e.message:"Internal error"},500)}}return env.ASSETS.fetch(req)},
 async scheduled(_event:ScheduledController,env:Env,ctx:ExecutionContext){ctx.waitUntil(processBatch(env))}
};
