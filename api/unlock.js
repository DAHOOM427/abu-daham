import {valid,json,body,equal,setCookie,code,secret} from "../lib/auth.js";
export default async function handler(req,res){
 if(req.method!=="POST") return json(res,405,{error:"Method not allowed"});
 if(code.length<12||secret.length<32) return json(res,503,{error:"إعدادات الدخول غير مكتملة في لوحة Vercel."});
 const b=await body(req);
 if(!equal(b.code||"",code)) return json(res,401,{error:"رمز الدخول غير صحيح."});
 return json(res,200,{ok:true},{ "Set-Cookie":setCookie()});
}