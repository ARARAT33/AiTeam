import type {Env,ModelRow} from "./types";
import {complete} from "./providers";

type AgentSpec={role:string;task:string};
async function callTeam(env:Env,models:ModelRow[],preferred:number,messages:Array<{role:string;content:string}>,tokens:number){
 const errors:string[]=[];
 for(let offset=0;offset<models.length;offset++){
  const model=models[(preferred+offset)%models.length];
  try{return await complete(env,model,messages,tokens)}catch(e){errors.push(model.name+": "+(e instanceof Error?e.message:String(e)))}
 }
 throw new Error("All eligible model fallbacks failed: "+errors.join(" | ").slice(0,1400));
}
function parsePlan(raw:string,prompt:string,maxAgents:number){
 try{
  const candidate=raw.match(/\{[\s\S]*\}/)?.[0];
  if(candidate){
   const parsed=JSON.parse(candidate);
   const agents:AgentSpec[]=(Array.isArray(parsed.agents)?parsed.agents:[])
    .map((a:any)=>({role:String(a.role||"specialist").slice(0,60),task:String(a.task||"").slice(0,2400)}))
    .filter((a:AgentSpec)=>a.task.trim()).slice(0,maxAgents);
   if(agents.length)return {plan:JSON.stringify(parsed,null,2),agents};
  }
 }catch{}
 const agents:AgentSpec[]=[
  {role:"implementer",task:"Complete the requested outcome with concrete deliverables: "+prompt},
  {role:"independent_checker",task:"Independently verify the requested outcome, identify omissions and propose corrections: "+prompt}
 ].slice(0,maxAgents);
 return {plan:raw,agents};
}
export async function runTeam(env:Env,models:ModelRow[],prompt:string,context:string[]){
 if(!models.length)throw new Error("No models available for the agent team");
 const memory=context.length?"\nRelevant memory:\n"+context.join("\n---\n"):"";
 const maxAgents=models.length===1?2:Math.min(3,models.length);
 const rawPlan=await callTeam(env,models,0,[
  {role:"system",content:"You are the AWE Workforce Director. Decompose the request into independent, useful agent tasks. Return ONLY valid JSON: {objective:string, agents:[{role:string,task:string}], risks:string[]}. Use 2-4 complementary roles when useful, no more than 4. Each task must be concrete and independently executable. Never claim actions not performed."},
  {role:"user",content:prompt+memory}
 ],1500);
 const parsed=parsePlan(rawPlan,prompt,maxAgents);
 const specs=parsed.agents.slice(0,maxAgents);
 const execute=async(spec:AgentSpec,index:number)=>({
  role:spec.role,
  output:await callTeam(env,models,index%models.length,[
   {role:"system",content:"You are a specialist agent in a collaborative AI workforce. Execute only your assigned subtask, produce concrete outputs, cite uncertainty, and do not claim external actions."},
   {role:"user",content:"Overall request:\n"+prompt+"\nYour assigned role: "+spec.role+"\nYour subtask:\n"+spec.task+memory}
  ],2200)
 });
 const agents= models.length===1
  ? await (async()=>{const out:any[]=[];for(let i=0;i<specs.length;i++)out.push(await execute(specs[i],i));return out})()
  : await Promise.all(specs.map((spec,i)=>execute(spec,i)));
 const work=agents.map(a=>"## "+a.role+"\n"+a.output).join("\n\n");
 const review=await callTeam(env,models,Math.max(0,models.length-1),[
  {role:"system",content:"You are the independent QA lead. Review all specialist outputs against the original request. Resolve conflicts, identify missing requirements and security risks, then provide one coherent final deliverable. Do not reveal hidden reasoning."},
  {role:"user",content:"Original request:\n"+prompt+"\nDirector plan:\n"+parsed.plan+"\nSpecialist outputs:\n"+work}
 ],2600);
 return {plan:parsed.plan,work,review,agents};
}
