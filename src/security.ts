import type {Env} from "./types";
const te=new TextEncoder();
const b64=(b:Uint8Array)=>btoa(String.fromCharCode(...b));
const unb64=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function hmac(secret:string,usage:KeyUsage[]){return crypto.subtle.importKey("raw",te.encode(secret),{name:"HMAC",hash:"SHA-256"},false,usage)}
export async function signSession(env:Env,login:string){const p=b64(te.encode(JSON.stringify({iss:"awe-ai-workforce",aud:"admin",login,iat:Date.now(),exp:Date.now()+604800000})));const k=await hmac(env.SESSION_SECRET,["sign"]);return p+"."+b64(new Uint8Array(await crypto.subtle.sign("HMAC",k,te.encode(p))))}
export async function verifySession(env:Env,token?:string|null):Promise<string|null>{if(!token)return null;try{const [p,s]=token.split(".");const k=await hmac(env.SESSION_SECRET,["verify"]);if(!await crypto.subtle.verify("HMAC",k,unb64(s),te.encode(p)))return null;const d=JSON.parse(new TextDecoder().decode(unb64(p)));const t=Date.now();return d.iss==="awe-ai-workforce"&&d.aud==="admin"&&Number(d.iat)<=t+60000&&Number(d.exp)>t&&Number(d.exp)<=Number(d.iat)+604800000?String(d.login):null}catch{return null}}
export function cookie(req:Request,name:string){const x=(req.headers.get("Cookie")||"").split(";").map(v=>v.trim()).find(v=>v.startsWith(name+"="));return x?decodeURIComponent(x.slice(name.length+1)):null}
function keyBytes(v:string){return /^[0-9a-f]{64}$/i.test(v)?Uint8Array.from(v.match(/.{2}/g)!,x=>parseInt(x,16)):te.encode(v)}
async function aes(env:Env,usage:KeyUsage[]){const m=await crypto.subtle.importKey("raw",keyBytes(env.APP_ENCRYPTION_KEY),"HKDF",false,["deriveKey"]);return crypto.subtle.deriveKey({name:"HKDF",hash:"SHA-256",salt:te.encode("awe-workforce"),info:te.encode("provider-keys-v1")},m,{name:"AES-GCM",length:256},false,usage)}
export async function encryptSecret(env:Env,value:string){const iv=crypto.getRandomValues(new Uint8Array(12));const c=await crypto.subtle.encrypt({name:"AES-GCM",iv},await aes(env,["encrypt"]),te.encode(value));return b64(iv)+"."+b64(new Uint8Array(c))}
export async function decryptSecret(env:Env,value:string){const [i,c]=value.split(".");const p=await crypto.subtle.decrypt({name:"AES-GCM",iv:unb64(i)},await aes(env,["decrypt"]),unb64(c));return new TextDecoder().decode(p)}
export const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
export const randomId=()=>crypto.randomUUID();export const now=()=>new Date().toISOString();
