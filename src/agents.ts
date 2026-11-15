import type {Env,ModelRow} from "./types";
import {complete} from "./providers";
async function callTeam(env:Env,models:ModelRow[],preferred:number,messages:Array<{role:string;content:string}>,tokens:number){
 const errors:string[]=[];
 for(let offset=0;offset<models.length;offset++){
  const model=models[(preferred+offset)%models.length];
  try{return await complete(env,model,messages,tokens)}catch(e){errors.push(model.name+": "+(e instanceof Error?e.message:String(e)))}
 }
 throw new Error("All eligible model fallbacks failed: "+errors.join(" | ").slice(0,1400));
}
export async function runTeam(env:Env,models:ModelRow[],prompt:string,context:string[]){
 const memory=context.length?"\nRelevant memory:\n"+context.join("\n---\n"):"";
 const plan=await callTeam(env,models,0,[{role:"system",content:"You are the AWE Workforce Director. Produce a concise execution plan, deliverables and risks. Never claim actions not performed."},{role:"user",content:prompt+memory}],1200);
 const work=await callTeam(env,models,1%models.length,[{role:"system",content:"You are a specialist worker. Execute the plan concretely. Produce requested deliverables and state limitations honestly."},{role:"user",content:"Request:\n"+prompt+"\nPlan:\n"+plan+memory}],3000);
 const review=await callTeam(env,models,2%models.length,[{role:"system",content:"You are independent QA. Identify omissions, uncertainty and security risks, then provide an improved final deliverable. Do not reveal hidden reasoning."},{role:"user",content:"Request:\n"+prompt+"\nPlan:\n"+plan+"\nWorker result:\n"+work}],2400);
 return {plan,work,review};
}
