import type {Env,ModelRow,TaskRow} from "./types";
import {cookie,verifySession,signSession,encryptSecret,now,randomId,json} from "./security";
import {runTeam} from "./agents";

async function readBody(req:Request){try{return await req.json() as Record<string,any>}catch{return {}}}
async function admin(req:Request,env:Env){const login=await verifySession(env,cookie(req,"awe_session"));return login&&login.toLowerCase()===(env.ADMIN_GITHUB_LOGIN||"araratavetisyan777999").toLowerCase()?login:null}
function clearCookie(name:string){return name+"=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"}
function safeUrl(value:string){try{const u=new URL(value);if(u.protocol!=="https:"||["localhost","127.0.0.1"].includes(u.hostname))return null;const out=u.toString();return out.endsWith("/")?out.slice(0,-1):out}catch{return null}}
async function auth(req:Request,env:Env,url:URL):Promise<Response|null>{
 if(url.pathname==="/api/auth/login"){
  if(!env.GITHUB_CLIENT_ID||!env.GITHUB_CLIENT_SECRET||!env.SESSION_SECRET)return json({error:"GitHub OAuth secrets are not configured"},503);
  const state=randomId(),target=new URL("https://github.com/login/oauth/authorize");
  target.searchParams.set("client_id",env.GITHUB_CLIENT_ID);target.searchParams.set("redirect_uri",env.GITHUB_CALLBACK_URL||url.origin+"/api/auth/callback");target.searchParams.set("scope","read:user");target.searchParams.set("state",state);
  return new Response(null,{status:302,headers:{Location:target.toString(),"Set-Cookie":"awe_oauth_state="+state+"; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600"}});
 }
 if(url.pathname==="/api/auth/callback"){
  if(cookie(req,"awe_oauth_state")!==url.searchParams.get("state"))return json({error:"OAuth state mismatch"},400);
  const code=url.searchParams.get("code");if(!code)return json({error:"Missing OAuth code"},400);
  const tr=await fetch("https://github.com/login/oauth/access_token",{method:"POST",headers:{Accept:"application/json","Content-Type":"application/json"},body:JSON.stringify({client_id:env.GITHUB_CLIENT_ID,client_secret:env.GITHUB_CLIENT_SECRET,code,redirect_uri:env.GITHUB_CALLBACK_URL||url.origin+"/api/auth/callback"})});
  const td:any=await tr.json();if(!td.access_token)return json({error:"GitHub token exchange failed"},401);
  const pr=await fetch("https://api.github.com/user",{headers:{Authorization:"Bearer "+td.access_token,Accept:"application/vnd.github+json","User-Agent":"AWE-AI-Workforce"}});
  const profile:any=await pr.json(),expected=(env.ADMIN_GITHUB_LOGIN||"araratavetisyan777999").toLowerCase();
  if(!profile.login||String(profile.login).toLowerCase()!==expected)return new Response("Access denied",{status:403,headers:{"Set-Cookie":clearCookie("awe_oauth_state")}});
  const token=await signSession(env,profile.login),h=new Headers({Location:"/", "Cache-Control":"no-store"});
  h.append("Set-Cookie","awe_session="+token+"; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800");h.append("Set-Cookie",clearCookie("awe_oauth_state"));
  return new Response(null,{status:302,headers:h});
 }
 if(url.pathname==="/api/auth/me"){const login=await admin(req,env);return json({authenticated:!!login,login})}
 if(url.pathname==="/api/auth/logout"&&req.method==="POST")return new Response(JSON.stringify({ok:true}),{headers:{"Content-Type":"application/json","Set-Cookie":clearCookie("awe_session")}});
 return null;
}
export async function handleApi(req:Request,env:Env,url:URL):Promise<Response>{
 const a=await auth(req,env,url);if(a)return a;
 const login=await admin(req,env);if(!login)return json({error:"Authentication required"},401);
 if(url.pathname==="/api/health")return json({ok:true,service:"AWE AI Workforce",time:now()});
 if(url.pathname==="/api/overview"){
  const [tasks,models,plugins]=await Promise.all([env.DB.prepare("SELECT status,COUNT(*) count FROM tasks GROUP BY status").all(),env.DB.prepare("SELECT COUNT(*) total,SUM(enabled) enabled FROM models").first(),env.DB.prepare("SELECT COUNT(*) total,SUM(enabled) enabled FROM plugins").first()]);
  return json({tasks:tasks.results,models,plugins,operator:login});
 }
 if(url.pathname==="/api/models"&&req.method==="GET"){
  const r=await env.DB.prepare("SELECT id,name,provider,model_id,base_url,enabled,priority,daily_limit,daily_used,usage_day,max_concurrency,active_count FROM models ORDER BY priority DESC").all();return json({models:r.results});
 }
 if(url.pathname==="/api/models"&&req.method==="POST"){
  const d=await readBody(req),name=String(d.name||"").slice(0,80),provider=String(d.provider||"custom").slice(0,40),model=String(d.model_id||"").slice(0,160),base=safeUrl(String(d.base_url||"")),key=String(d.api_key||"");
  if(!name||!model||!base||key.length<8)return json({error:"Name, model ID, HTTPS base URL and API key are required"},400);
  const id=randomId(),t=now(),secret=await encryptSecret(env,key);
  await env.DB.prepare("INSERT INTO models (id,name,provider,model_id,base_url,encrypted_api_key,enabled,priority,daily_limit,max_concurrency,created_at,updated_at) VALUES (?,?,?,?,?,?,1,?,?,?,?,?)").bind(id,name,provider,model,base,secret,Number(d.priority)||100,Math.max(1,Number(d.daily_limit)||100),Math.max(1,Number(d.max_concurrency)||1),t,t).run();
  return json({id,ok:true},201);
 }
 if(url.pathname.startsWith("/api/models/")&&req.method==="PATCH"){
  const id=url.pathname.split("/").pop()!,d=await readBody(req),keys=["enabled","priority","daily_limit","max_concurrency","name"],sets:string[]=[],vals:any[]=[];
  for(const k of keys)if(d[k]!==undefined){sets.push(k+"=?");vals.push(k==="enabled"?(d[k]?1:0):k==="name"?String(d[k]).slice(0,80):Math.max(0,Number(d[k])||0))}
  if(!sets.length)return json({error:"No supported fields"},400);sets.push("updated_at=?");vals.push(now(),id);
  await env.DB.prepare("UPDATE models SET "+sets.join(",")+" WHERE id=?").bind(...vals).run();return json({ok:true});
 }
 if(url.pathname.startsWith("/api/models/")&&req.method==="DELETE"){await env.DB.prepare("DELETE FROM models WHERE id=?").bind(url.pathname.split("/").pop()!).run();return json({ok:true})}
 if(url.pathname==="/api/tasks"&&req.method==="GET"){const r=await env.DB.prepare("SELECT id,title,prompt,status,priority,result,error,attempts,max_attempts,created_at,updated_at FROM tasks ORDER BY created_at DESC LIMIT 100").all();return json({tasks:r.results})}
 if(url.pathname==="/api/tasks"&&req.method==="POST"){
  const d=await readBody(req),title=String(d.title||"New task").slice(0,160),prompt=String(d.prompt||"").slice(0,12000);if(!prompt.trim())return json({error:"Task prompt is required"},400);
  const count=await env.DB.prepare("SELECT COUNT(*) count FROM tasks WHERE status IN ('queued','running')").first<{count:number}>();if((count?.count||0)>=100)return json({error:"Queue is full"},429);
  const id=randomId(),t=now();await env.DB.prepare("INSERT INTO tasks (id,title,prompt,status,priority,max_attempts,created_at,updated_at) VALUES (?,?,?,'queued',?,?,?,?)").bind(id,title,prompt,Math.min(100,Math.max(0,Number(d.priority)||50)),Math.max(1,Math.min(5,Number(env.MAX_TASK_ATTEMPTS)||3)),t,t).run();
  await env.DB.prepare("INSERT INTO task_events (id,task_id,agent,event,detail,created_at) VALUES (?,?,?,'queued',?,?)").bind(randomId(),id,"system","Task added to persistent queue",t).run();return json({id,status:"queued"},201);
 }
 if(url.pathname.startsWith("/api/tasks/")&&url.pathname.endsWith("/events")){const id=url.pathname.split("/")[3],r=await env.DB.prepare("SELECT agent,event,detail,created_at FROM task_events WHERE task_id=? ORDER BY created_at ASC LIMIT 200").bind(id).all();return json({events:r.results})}
 if(url.pathname.startsWith("/api/tasks/")&&req.method==="DELETE"){await env.DB.prepare("DELETE FROM tasks WHERE id=? AND status<>'running'").bind(url.pathname.split("/").pop()!).run();return json({ok:true})}
 if(url.pathname==="/api/memory"&&req.method==="GET"){const r=await env.DB.prepare("SELECT id,task_id,kind,content,created_at FROM memories ORDER BY created_at DESC LIMIT 100").all();return json({memories:r.results})}
 if(url.pathname==="/api/plugins"&&req.method==="GET"){const r=await env.DB.prepare("SELECT id,name,description,version,manifest,enabled,requires_approval,created_at FROM plugins ORDER BY created_at DESC").all();return json({plugins:r.results})}
 if(url.pathname==="/api/plugins"&&req.method==="POST"){
  const d=await readBody(req),name=String(d.name||"").slice(0,80),description=String(d.description||"").slice(0,500);if(!name)return json({error:"Plugin name required"},400);
  const id=randomId(),t=now(),manifest=JSON.stringify({type:"declarative",version:"1.0.0",capabilities:Array.isArray(d.capabilities)?d.capabilities.slice(0,20):[],note:"Manifest only; executable code is not run."});
  await env.DB.prepare("INSERT INTO plugins (id,name,description,manifest,enabled,requires_approval,created_at,updated_at) VALUES (?,?,?,?,0,1,?,?)").bind(id,name,description,manifest,t,t).run();return json({id,ok:true,enabled:false,requires_approval:true},201);
 }
 if(url.pathname.startsWith("/api/plugins/")&&req.method==="PATCH"){const d=await readBody(req);await env.DB.prepare("UPDATE plugins SET enabled=?,updated_at=? WHERE id=?").bind(d.enabled?1:0,now(),url.pathname.split("/").pop()!).run();return json({ok:true})}
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
  for(const m of chosen)await env.DB.prepare("UPDATE models SET active_count=active_count+1,daily_used=daily_used+1 WHERE id=?").bind(m.id).run();
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
export default {
 async fetch(req:Request,env:Env):Promise<Response>{const url=new URL(req.url);if(url.pathname.startsWith("/api/")){try{const r=await handleApi(req,env,url);r.headers.set("X-Content-Type-Options","nosniff");r.headers.set("Referrer-Policy","same-origin");r.headers.set("X-Frame-Options","DENY");return r}catch(e){return json({error:e instanceof Error?e.message:"Internal error"},500)}}return env.ASSETS.fetch(req)},
 async scheduled(_event:ScheduledController,env:Env,ctx:ExecutionContext){ctx.waitUntil(processOne(env))}
};
