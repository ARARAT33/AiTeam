import {handleApi} from "../../src/index";
import {cookie,verifySession} from "../../src/security";
import {handleWorkspaceApi} from "../../src/workspace";
import type {Env} from "../../src/types";
export const onRequest=async(context:any)=>{
 try{
  const env=context.env as Env,request=context.request,url=new URL(request.url);
  let response=await handleApi(request,env,url);
  if(response.status===404&&url.pathname.startsWith("/api/")){
   const login=await verifySession(env,cookie(request,"__Host-awe_session"));
   if(login)response=await handleWorkspaceApi(request,env,url,login)||response;
  }
  const headers=new Headers(response.headers);
  headers.set("X-Content-Type-Options","nosniff");
  headers.set("Referrer-Policy","no-referrer");
  headers.set("X-Frame-Options",url.pathname==="/api/workspace/preview"?"SAMEORIGIN":"DENY");
  headers.set("Cross-Origin-Opener-Policy","same-origin");
  headers.set("Cross-Origin-Resource-Policy","same-origin");
  headers.set("Cache-Control","no-store");
  headers.set("Permissions-Policy","camera=(), microphone=(), geolocation=()");
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
 }catch(error){return new Response(JSON.stringify({error:"Internal server error"}),{status:500,headers:{"Content-Type":"application/json","Cache-Control":"no-store","X-Content-Type-Options":"nosniff","X-Frame-Options":"DENY"}})}
};
