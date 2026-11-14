import {valid,json} from "../lib/auth.js";

// Arabic WebVTT from Commons for the exact matching open-license video.
const ENDPOINT="https://commons.wikimedia.org/w/api.php";
const FILE=/^File:[^?#\r\n]{1,220}\.(?:webm|mp4|ogv)$/i;
export default async function handler(req,res){
 if(req.method!=="GET")return json(res,405,{error:"Method not allowed"});
 if(!valid(req))return json(res,401,{error:"يلزم تسجيل الدخول أولاً."});
 const title=String(req.query?.file||"").trim();
 if(!FILE.test(title))return json(res,400,{error:"عنوان ملف غير صالح."});
 const url=new URL(ENDPOINT);
 for(const [key,value] of Object.entries({action:"timedtext",title,lang:"ar",trackformat:"vtt"}))url.searchParams.set(key,value);
 try{
  const r=await fetch(url,{headers:{Accept:"text/vtt,text/plain","User-Agent":"AbuDahamOpenMedia/1.0 (https://abu-daham.vercel.app/)"},signal:AbortSignal.timeout(10000)});
  if(r.status===404||r.status===400)return json(res,404,{error:"الترجمة العربية غير متوفرة."});
  if(!r.ok)throw Error("source unavailable");
  if(Number(r.headers.get("content-length")||0)>262144)return json(res,502,{error:"ملف ترجمة كبير جدًا."});
  const data=(await r.text()).replace(/^\uFEFF/,"");
  if(Buffer.byteLength(data,"utf8")>262144||!/^\s*WEBVTT(?:\s|$)/.test(data))return json(res,404,{error:"لا يوجد ملف ترجمة عربية قابل للعرض."});
  res.writeHead(200,{"Content-Type":"text/vtt; charset=utf-8","Cache-Control":"private, max-age=600","X-Content-Type-Options":"nosniff"});
  return res.end(data);
 }catch{return json(res,502,{error:"تعذر الاتصال بمصدر الترجمة."});}
}
