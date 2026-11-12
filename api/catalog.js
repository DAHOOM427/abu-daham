import {valid,json} from "../lib/auth.js";

const CINEMETA="https://v3-cinemeta.strem.io";
const JIKAN="https://api.jikan.moe/v4";
const TVMAZE="https://api.tvmaze.com";
function normalizeQualities(value){
 const values=Array.isArray(value)?value:(value==null?[]:[value]);
 const found=new Set();
 for(const item of values){
  const text=String(typeof item==="object"?(item.quality||item.resolution||item.name||""):item).toLowerCase();
  if(/4k|uhd|2160/.test(text))found.add("4K");
  else if(/2k|qhd|1440/.test(text))found.add("2K");
  else if(/hd|1080|720/.test(text))found.add("HD");
 }
 return ["4K","2K","HD"].filter(q=>found.has(q));
}
const MIN_YEAR=1985;
const MAX_YEAR=new Date().getFullYear();

async function get(url){
 const r=await fetch(url,{headers:{Accept:"application/json"},signal:AbortSignal.timeout(14000)});
 if(!r.ok)throw new Error("Provider returned "+r.status);
 return r.json();
}
function mapCinemeta(x,type){
 return {id:String(x.imdb_id||x.id||""),type,title:x.name||x.title||"بدون عنوان",year:String(x.year||"").slice(0,4),overview:x.description||"",poster:x.poster||"",rating:Number(x.imdbRating||0),genres:Array.isArray(x.genres)?x.genres:[],qualities:normalizeQualities(x.qualities||x.quality||x.resolution||x.videoQuality),source:"Cinemeta"};
}
function mapAnime(x){
 return {id:String(x.mal_id),type:"anime",title:x.title||x.title_english||"بدون عنوان",titleEnglish:x.title_english||"",titleJapanese:x.title_japanese||"",year:String(x.year||x.aired?.prop?.from?.year||""),overview:x.synopsis||"",poster:x.images?.jpg?.large_image_url||x.images?.jpg?.image_url||"",rating:Number(x.score||0),genres:(x.genres||[]).map(g=>g.name),qualities:normalizeQualities(x.qualities||x.quality||x.resolution),source:"Jikan",url:x.url||""};
}
function mapTVMaze(row){
 const x=row.show||row;
 const summary=String(x.summary||"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();
 return {id:"tvmaze-"+x.id,type:"tv",title:x.name||"بدون عنوان",year:String(x.premiered||"").slice(0,4),overview:summary,poster:x.image?.original||x.image?.medium||"",rating:Number(x.rating?.average||0),genres:Array.isArray(x.genres)?x.genres:[],qualities:normalizeQualities(x.qualities||x.quality||x.resolution),source:"TVmaze",url:x.url||""};
}
function yearValid(y){const n=Number(y);return Number.isInteger(n)&&n>=MIN_YEAR&&n<=MAX_YEAR;}
async function cinemeta(type,q,page,year){
 const skip=(page-1)*50;
 const catalog=year&&!q?"year/genre="+year:"top";
 const search=q&&catalog==="top"?"/search="+encodeURIComponent(q):"";
 const d=await get(CINEMETA+"/catalog/"+type+"/"+catalog+search+".json?skip="+skip);
 return (d.metas||[]).map(x=>mapCinemeta(x,type==="movie"?"movie":"tv"));
}
async function anime(q,page,year){
 const params=new URLSearchParams({page:String(page),limit:"25",sfw:"true"});
 if(q)params.set("q",q);
 if(year){params.set("start_date",year+"-01-01");params.set("end_date",year+"-12-31");params.set("order_by","start_date");params.set("sort","desc");}
 const useSearch=Boolean(q||year);
 const d=await get(JIKAN+(useSearch?"/anime?":"/top/anime?")+params);
 return (d.data||[]).map(mapAnime);
}
async function tvmaze(q,page){
 if(!q)return [];
 const rows=await get(TVMAZE+"/search/shows?q="+encodeURIComponent(q));
 return (rows||[]).map(mapTVMaze).slice((page-1)*20,page*20);
}
export default async function handler(req,res){
 if(req.method!=="GET")return json(res,405,{error:"Method not allowed"});
 if(!valid(req))return json(res,401,{error:"يلزم تسجيل الدخول أولاً."});
 const q=String(req.query?.q||"").trim().slice(0,100);
 const type=String(req.query?.type||"all");
 const page=Math.max(1,Math.min(100,Number(req.query?.page||1)));
 const rawYear=String(req.query?.year||"");
 const year=rawYear&&yearValid(rawYear)?rawYear:"";
 const jobs=[];
 if(type==="all"||type==="movie")jobs.push(["Cinemeta أفلام",()=>cinemeta("movie",q,page,year)]);
 if(type==="all"||type==="tv")jobs.push(["Cinemeta مسلسلات",()=>cinemeta("series",q,page,year)]);
 if((type==="all"||type==="tv")&&q)jobs.push(["TVmaze مسلسلات",()=>tvmaze(q,page)]);
 if(type==="all"||type==="anime")jobs.push(["Jikan أنمي",()=>anime(q,page,year)]);
 const settled=await Promise.allSettled(jobs.map(([,fn])=>fn()));
 const items=[],providers=[];
 settled.forEach((r,i)=>{
  const name=jobs[i][0];
  if(r.status==="fulfilled"){items.push(...r.value);providers.push({provider:name,count:r.value.length});}
  else providers.push({provider:name,error:"المصدر غير متاح مؤقتاً"});
 });
 const filtered=items.filter(x=>{
  const y=Number(x.year);
  if(!Number.isInteger(y)||y<MIN_YEAR||y>MAX_YEAR)return false;
  return !year||String(y)===year;
 });
 const unique=[...new Map(filtered.filter(x=>x.id).map(x=>[x.type+":"+x.id,x])).values()];
 return json(res,200,{items:unique.slice(0,100),page,year:year||null,updatedAt:new Date().toISOString(),providers},{ "Cache-Control":"public, s-maxage=900, stale-while-revalidate=3600"});
}