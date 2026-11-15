import {handleApi} from "../../src/index";
import type {Env} from "../../src/types";
export const onRequest=async(context:any)=>{
 try{
  const response=await handleApi(context.request,context.env as Env,new URL(context.request.url));
  const headers=new Headers(response.headers);
  headers.set("X-Content-Type-Options","nosniff");
  headers.set("Referrer-Policy","no-referrer");
  headers.set("X-Frame-Options","DENY");
  headers.set("Cross-Origin-Opener-Policy","same-origin");
  headers.set("Cross-Origin-Resource-Policy","same-origin");
  headers.set("Cache-Control","no-store");
  headers.set("Permissions-Policy","camera=(), microphone=(), geolocation=()");
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
 }catch(error){return new Response(JSON.stringify({error:"Internal server error"}),{status:500,headers:{"Content-Type":"application/json","Cache-Control":"no-store","X-Content-Type-Options":"nosniff","X-Frame-Options":"DENY"}})}
};
