import {valid,json} from "../lib/auth.js";

// Dynamic discovery from the publicly documented Wikimedia Commons Blender movies category.
// Only selected CC BY/CC BY-SA licensed videos, hosted on Wikimedia, are offered for playback.
// Never ingest or download arbitrary streaming titles from catalog providers.
const API="https://commons.wikimedia.org/w/api.php";
const CACHE_MS=6*60*60*1000;
let cache={date:0,items:null};
function clean(input){return String(input||"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim().slice(0,350)}
function allowedLicense(value){
 const v=String(value||"").trim().replace(/\/$/,"");
 return /^https:\/\/creativecommons\.org\/licenses\/(by|by-sa)\/(2\.5|3\.0|4\.0)$/i.test(v);
}
function httpsWikimedia(url){
 try{const u=new URL(String(url||""));return u.protocol==="https:"&&["upload.wikimedia.org","commons.wikimedia.org"].includes(u.hostname)?u.href:""}
 catch{return ""}
}
async function fetchMedia(){
 if(cache.items&&Date.now()-cache.date<CACHE_MS)return cache.items;
 const url=new URL(API);
 for(const [k,v] of Object.entries({action:"query",generator:"categorymembers",gcmtitle:"Category:Blender movies",gcmtype:"file",gcmlimit:"50",prop:"imageinfo",iiprop:"url|size|mime|extmetadata|timestamp",format:"json",formatversion:"2"}))url.searchParams.set(k,v);
 const r=await fetch(url,{headers:{"Accept":"application/json","User-Agent":"AbuDahamOpenMedia/1.0 (https://abu-daham.vercel.app/)"},signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error("Wikimedia not available");
 const data=await r.json();
 const seen=new Set(),items=[];
 for(const page of data.query?.pages||[]){
  const info=page.imageinfo?.[0],meta=info?.extmetadata||{},license=clean(meta.LicenseShortName?.value),licenseUrl=String(meta.LicenseUrl?.value||"");
  const fileUrl=httpsWikimedia(info?.url),origin=httpsWikimedia(info?.descriptionurl);
  const label=String(page.title||"").replace(/^File:/,"").replace(/\.(webm|mp4|ogv)$/i,"").replace(/\s+/g," ").trim();
  if(!fileUrl||!origin||!allowedLicense(licenseUrl)||!/^video\/(webm|mp4)$/.test(info?.mime||""))continue;
  if(!Number.isFinite(info.size)||info.size<1024*1024||info.size>3.5e9)continue;
  if(/(?:sample|trailer|test only|teaser|clip excerpt)/i.test(label))continue;
  const key=label.toLowerCase().replace(/\s*(?:1080p|4k|full movie).*$/i,"").trim();
  if(seen.has(key))continue;seen.add(key);
  const artist=clean(meta.Artist?.value)||"Blender Foundation / Wikimedia Commons";
  const sourceName=label.toLowerCase().includes("tears of steel")?"movie":"animation";
  const sizeMb=Math.round(info.size/1024/1024);
  items.push({id:"blender-commons-"+page.pageid,title:label,kind:sourceName,label:"فيلم Blender مفتوح الترخيص",year:Number((label.match(/20\d{2}|19\d{2}/)||[])[0])||"",icon:"🎬",license,licenseUrl,credit:artist+" · "+license+" · المصدر Wikimedia Commons",date:String(info.timestamp||""),sizeMb,sources:[{q:info.mime==="video/mp4"?"MP4 · "+sizeMb+"MB":"WebM · "+sizeMb+"MB",url:fileUrl}],origin,archive:origin,provider:"Wikimedia Commons",subtitleFile:page.title});
 }
 items.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
 cache={date:Date.now(),items};
 return items;
}
export default async function handler(req,res){
 if(req.method!=="GET")return json(res,405,{error:"Method not allowed"});
 if(!valid(req))return json(res,401,{error:"يلزم تسجيل الدخول أولاً."});
 try{
  const items=await fetchMedia();
  return json(res,200,{items,count:items.length,updatedAt:new Date(cache.date).toISOString(),source:"Wikimedia Commons · Blender movies",notice:"محتوى أفلام قصيرة مفتوحة الترخيص CC BY/CC BY-SA وفق بيانات Wikimedia Commons، وليس أفلام ومسلسلات المنصات التجارية. نعرض الترخيص ونسبة العمل، والملفات تُشغّل من مصدرها دون تخزينها على أبو داحم."},{"Cache-Control":"private, max-age=300"});
 }catch(e){
  return json(res,502,{error:"تعذر جلب الأفلام المفتوحة الآن. جرب بعد قليل.",reason:"source-unavailable"});
 }
}
