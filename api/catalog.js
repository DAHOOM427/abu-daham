import {valid,json} from "../lib/auth.js";

const CINEMETA="https://v3-cinemeta.strem.io";
const JIKAN="https://api.jikan.moe/v4";

async function get(url){
 const r=await fetch(url,{headers:{Accept:"application/json"},signal:AbortSignal.timeout(14000}});
 if(!r.ok)throw new Error("Provider returned "+r.status);
 return r.json();
}
function mapCinemeta(x,type){
 const year=String(x.year||"").slice(0,4);
 return {id:String(x.imdb_id||x.id||""),type,title:x.name||x.title||"بدون عنوان",year,overview:x.description||"",poster:x.poster||"",rating:Number(x.imdbRating||0),source:"Cinemeta"};
}
function mapAnime(x){
 return {id:String(x.mal_id),type:"anime",title:x.title||x.title_english||"بدون عنوان",year:String(x.year||x.aired?.prop?.from?.year||""),overview:x.synopsis||"",poster:x.images?.jpg?.large_image_url||x.images?.jpg?.image_url||"",rating:Number(x.score||0),source:"Jikan"};
}
async function cinemeta(type,q,page){
 const skip=(page-1)*50;
 const search=q?"/search="+encodeURIComponent(q):"";
 const d=await get(CINEMETA+"/catalog/"+type+"/top"+search+".json?skip="+skip);
 return (d.metas||[]).map(x=>mapCinemeta(x,type==="movie"?"movie":"tv"));
}
async function anime(q,page){
 const params=new URLSearchParams({page:String(page),limit:"25",sfw:"true"});
 if(q)params.set("q",q);
 const d=await get(JIKAN+(q?"/anime?":"/top/anime?")+params);
 return (d.data||[]).map(mapAnime);
}
export default async function handler(req,res){
 if(req.method!=="GET")return json(res,405,{error:"Method not allowed"});
 if(!valid(req))return json(res,401,{error:"يلزم تسجيل الدخول أولاً."});
 const q=String(req.query?.q||"").trim().slice(0,100);
 const type=String(req.query?.type||"all");
 const page=Math.max(1,Math.min(100,Number(req.query?.page||1)));
 const jobs=[];
 if(type==="all"||type==="movie")jobs.push(["Cinemeta أفلام",()=>cinemeta("movie",q,page)]);
 if(type==="all"||type==="tv")jobs.push(["Cinemeta مسلسلات",()=>cinemeta("series",q,page)]);
 if(type==="all"||type==="anime")jobs.push(["Jikan أنمي",()=>anime(q,page)]);
 const settled=await Promise.allSettled(jobs.map(([,fn])=>fn()));
 const items=[],providers=[];
 settled.forEach((r,i)=>{
  const name=jobs[i][0];
  if(r.status==="fulfilled"){items.push(...r.value);providers.push({provider:name,count:r.value.length});}
  else providers.push({provider:name,error:"المصدر غير متاح مؤقتاً"});
 });
 const unique=[...new Map(items.filter(x=>x.id).map(x=>[x.type+":"+x.id,x])).values()];
 return json(res,200,{items:unique.slice(0,75),page,providers},{ "Cache-Control":"public, s-maxage=1800, stale-while-revalidate=86400" });
}