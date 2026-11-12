import crypto from "node:crypto";
const cookieName="daham_session";
const secret=process.env.SESSION_SECRET||"";
const code=process.env.APP_ACCESS_CODE||"";
const ttl=43200;
export function equal(a,b){const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y)}
function sign(p){return crypto.createHmac("sha256",secret).update(p).digest("base64url")}
export function valid(req){
 if(secret.length<32)return false;
 const t=(req.headers.cookie||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(cookieName+"="))?.slice(cookieName.length+1);
 if(!t)return false;const [p,s]=t.split(".");
 if(!p||!s||!equal(s,sign(p)))return false;
 try{return JSON.parse(Buffer.from(p,"base64url").toString()).exp>Date.now()/1000}catch{return false}
}
export function setCookie(){
 const p=Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+ttl,n:crypto.randomBytes(12).toString("hex")})).toString("base64url");
 return cookieName+"="+p+"."+sign(p)+"; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age="+ttl;
}
export async function body(req){const a=[];for await(const b of req)a.push(b);try{return JSON.parse(Buffer.concat(a).toString()||"{}")}catch{return {}}}
export function json(res,status,data,headers={}){res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...headers});res.end(JSON.stringify(data))}
export {code,secret,cookieName};
