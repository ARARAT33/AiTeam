import type {Env,ModelRow} from "./types";
import {complete} from "./providers";
export async function runTeam(env:Env,models:ModelRow[],prompt:string,context:string[]){
 const memory=context.length?"\\nRelevant memory:\\n"+context.join("\\n---\\n"):"";
 const plan=await complete(env,models[0],[{role:"system",content:"You are the AWE Workforce Director. Produce a concise execution plan, deliverables and risks. Never claim actions not performed."},{role:"user",content:prompt+memory}],1200);
 const work=await complete(env,models[Math.min(1,models.length-1)],[{role:"system",content:"You are a specialist worker. Execute the plan concretely. Produce requested deliverables and state limitations honestly."},{role:"user",content:"Request:\\n"+prompt+"\\nPlan:\\n"+plan+memory}],3000);
 const review=await complete(env,models[Math.min(2,models.length-1)],[{role:"system",content:"You are independent QA. Identify omissions, uncertainty and security risks, then provide an improved final deliverable. Do not reveal hidden reasoning."},{role:"user",content:"Request:\\n"+prompt+"\\nPlan:\\n"+plan+"\\nWorker result:\\n"+work}],2400);
 return {plan,work,review};
}
