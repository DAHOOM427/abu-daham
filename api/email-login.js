import crypto from "node:crypto";
import {body, json, setCookie, secret, equal} from "../lib/auth.js";

const COOKIE = "daham_email_challenge";
const FIVE_MINUTES = 5 * 60 * 1000;
const email = process.env.LOGIN_EMAIL || "";
const sender = process.env.MAIL_FROM || "";
const apiKey = process.env.RESEND_API_KEY || "";
const configured = () => secret.length >= 32 && Boolean(email && sender && apiKey);
const signature = p => crypto.createHmac("sha256",secret).update(p).digest("base64url");
const b64 = obj => Buffer.from(JSON.stringify(obj)).toString("base64url");
const challengeCookie = obj => {
  const p=b64(obj);
  return COOKIE+"="+p+"."+signature(p)+"; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=300";
};
const expiredCookie = COOKIE+"=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0";
function getChallenge(req){
  if(secret.length < 32)return null;
  const raw=(req.headers.cookie||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(COOKIE+"="))?.slice(COOKIE.length+1);
  if(!raw)return null;
  const [p,s]=raw.split(".");
  if(!p||!s||!equal(s,signature(p)))return null;
  try{
    const obj=JSON.parse(Buffer.from(p,"base64url").toString());
    return obj && Number.isFinite(obj.created) && Number.isFinite(obj.expires) ? obj : null;
  }catch{return null}
}
const codeDigest=(nonce,code)=>crypto.createHmac("sha256",secret).update(nonce+":"+code).digest("hex");
export default async function handler(req,res){
  if(req.method==="GET")return json(res,200,{enabled:configured()});
  if(req.method!=="POST")return json(res,405,{error:"Method not allowed"});
  if(!configured())return json(res,503,{error:"الدخول عبر البريد غير مفعّل بعد. استخدم رمز الدخول الحالي."});
  const input=await body(req);
  const now=Date.now();
  if(input.action==="send"){
    const current=getChallenge(req);
    if(current && now-current.created<60000)return json(res,429,{error:"انتظر دقيقة قبل طلب رمز جديد."});
    const code=String(crypto.randomInt(0,100000000)).padStart(8,"0");
    const nonce=crypto.randomBytes(16).toString("hex");
    const pending={nonce,digest:codeDigest(nonce,code),created:now,expires:now+FIVE_MINUTES,attempts:0};
    let result;
    try{
      result=await fetch("https://api.resend.com/emails",{
        method:"POST",
        headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json"},
        body:JSON.stringify({
          from:sender,to:[email],
          subject:"رمز الدخول الجديد — أبو داحم",
          text:"رمز الدخول الخاص بك هو: "+code+"\nصالح لمدة 5 دقائق فقط. إذا لم تطلب هذا الرمز، تجاهل الرسالة."
        })
      });
    }catch{return json(res,502,{error:"تعذر إرسال رسالة البريد الآن. جرّب لاحقاً."})}
    if(!result.ok)return json(res,502,{error:"تعذر إرسال رمز البريد. راجع إعدادات خدمة البريد."});
    return json(res,200,{ok:true,expiresInSeconds:300},{"Set-Cookie":challengeCookie(pending)});
  }
  if(input.action==="verify"){
    const p=getChallenge(req);
    if(!p||now>p.expires)return json(res,401,{error:"انتهت صلاحية الرمز. اطلب رمزاً جديداً."},{"Set-Cookie":expiredCookie});
    if(p.attempts>=5)return json(res,429,{error:"عدد المحاولات تجاوز الحد. اطلب رمزاً جديداً."},{"Set-Cookie":expiredCookie});
    const code=String(input.code||"").trim();
    const correct=/^\d{8}$/.test(code) && equal(codeDigest(p.nonce,code),p.digest);
    if(!correct){
      p.attempts++;
      return json(res,401,{error:"الرمز غير صحيح، بقيت "+(5-p.attempts)+" محاولات."},{"Set-Cookie":challengeCookie(p)});
    }
    return json(res,200,{ok:true},{"Set-Cookie":[expiredCookie,setCookie()]});
  }
  return json(res,400,{error:"طلب غير صالح"});
}
