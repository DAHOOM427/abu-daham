import {valid,json} from "../lib/auth.js";

const SPORTSDB="https://www.thesportsdb.com/api/v1/json/123";
const FOOTBALL_KEY=process.env.API_FOOTBALL_KEY||process.env.APISPORTS_KEY||"";
const cache=new Map();
function safeId(v){return /^\d{2,14}$/.test(String(v||""))?String(v):""}
function clean(v){return String(v??"").trim().slice(0,180)}
async function remote(url,headers={}){
 const r=await fetch(url,{headers:{Accept:"application/json",...headers},signal:AbortSignal.timeout(9000)});
 if(!r.ok)throw Error("provider "+r.status);return r.json();
}
async function cached(key,fn){
 const old=cache.get(key);if(old&&Date.now()-old.time<300000)return old.data;
 const data=await fn();cache.set(key,{data,time:Date.now()});if(cache.size>70)cache.delete(cache.keys().next().value);return data;
}
function licensedStream(matchId){
 let cfg=[];
 try{cfg=JSON.parse(process.env.SPORTS_EMBEDS_JSON||"[]")}catch{}
 if(!Array.isArray(cfg))return null;
 const x=cfg.find(row=>String(row.matchId||"")===matchId&&row.authorized===true);
 if(!x)return null;
 let u;try{u=new URL(x.embedUrl)}catch{return null}
 const allowed=(u.protocol==="https:")&&
  ((u.hostname==="www.youtube-nocookie.com"&&/^\/embed\/[\w-]+\/?$/.test(u.pathname))||
   (u.hostname==="player.vimeo.com"&&/^\/video\/\d+\/?$/.test(u.pathname)));
 if(!allowed)return null;
 return {embedUrl:u.origin+u.pathname,title:clean(x.title||"البث الرسمي"),source:clean(x.source||"مصدر مصرح"),quality:"حسب المصدر"};
}
function officialPage(league){
 const l=String(league||"").toLowerCase();
 if(["spl","4668"].includes(l)||/saudi|روشن|السعود/i.test(l))
  return {title:"ثمانية – الناقل الرسمي للدوري السعودي",url:"https://app.thmanyah.com/",desc:"افتح البث الرسمي بحسب سياسة الناقل. قد يتضمن إعلانات."};
 if(["worldcup","clubworldcup","4429","4503"].includes(l)||/fifa|كأس العالم/i.test(l))
  return {title:"FIFA+ – جدول البث الرسمي المتاح",url:"https://www.fifa.com/fifaplus",desc:"تختلف المباريات المجانية بحسب الحقوق والمنطقة."};
 return null;
}
function line(row){
 return {name:clean(row.strPlayer||row.name||row.player?.name),number:clean(row.intSquadNumber||row.intNumber||row.number||row.player?.number),position:clean(row.strPosition||row.strPos||row.position||row.player?.pos),team:clean(row.strTeam||row.team?.name),photo:clean(row.strThumb||row.player?.photo)};
}
export default async function handler(req,res){
 if(req.method!=="GET")return json(res,405,{error:"Method not allowed"});
 if(!valid(req))return json(res,401,{error:"يلزم تسجيل الدخول."});
 const action=String(req.query?.action||"stream");
 const id=safeId(req.query?.id);
 const league=clean(req.query?.league)+' '+clean(req.query?.leagueName);
 if(action==="stream"){
  const playable=id?licensedStream(id):null;
  let channels=[];
  if(id)try{
   const d=await cached("tv:"+id,()=>remote(SPORTSDB+"/lookuptv.php?id="+id));
   const rows=d.tvevents||d.tv||d.tvlist||[];
   channels=rows.slice(0,8).map(x=>({name:clean(x.strChannel||x.strTV||x.strTVName||x.strNetwork),country:clean(x.strCountry)})).filter(x=>x.name);
  }catch{}
  return json(res,200,{stream:playable,official:officialPage(league),channels,message:playable?"تشغيل مصرح داخل الموقع":"لا يتوفر رابط بث مصرح بتضمينه لهذه المباراة حتى الآن. استخدم المصدر الرسمي إن توفر."});
 }
 if(!id)return json(res,400,{error:"رقم المباراة أو النادي غير صالح."});
 try{
  if(action==="lineup"){
   if(FOOTBALL_KEY){
    const d=await cached("afl:"+id,()=>remote("https://v3.football.api-sports.io/fixtures/lineups?fixture="+id,{"x-apisports-key":FOOTBALL_KEY}));
    const groups=(d.response||[]).map(row=>({
     team:clean(row.team?.name),formation:clean(row.formation),
     coach:clean(row.coach?.name),players:(row.startXI||[]).map(row=>line(row.player||row)).filter(p=>p.name),
     substitutes:(row.substitutes||[]).map(row=>line(row.player||row)).filter(p=>p.name)
    }));
    return json(res,200,{source:"API-Football",groups,available:groups.some(g=>g.players.length>0)});
   }
   const d=await cached("lineup:"+id,()=>remote(SPORTSDB+"/lookuplineup.php?id="+id));
   const rows=(d.lineup||d.lineups||[]).map(line).filter(x=>x.name);
   const groups=Object.values(rows.reduce((acc,p)=>{const k=p.team||"اللاعبون";if(!acc[k])acc[k]={team:k,players:[]};acc[k].players.push(p);return acc},{}));
   return json(res,200,{source:"TheSportsDB",groups,available:rows.length>0,message:rows.length?"":"التشكيلة لم تُنشر في المصدر بعد."});
  }
  if(action==="players"){
   if(FOOTBALL_KEY){
    const d=await cached("afplayers:"+id,()=>remote("https://v3.football.api-sports.io/players/squads?team="+id,{"x-apisports-key":FOOTBALL_KEY}));
    const groups=(d.response||[]).map(x=>({team:clean(x.team?.name),players:(x.players||[]).map(line).filter(p=>p.name)}));
    return json(res,200,{source:"API-Football",groups,available:groups.some(g=>g.players.length)});
   }
   const d=await cached("players:"+id,()=>remote(SPORTSDB+"/lookup_all_players.php?id="+id));
   const rows=(d.player||d.players||[]).map(line).filter(x=>x.name);
   return json(res,200,{source:"TheSportsDB",groups:[{team:"قائمة اللاعبين المتاحة",players:rows}],available:rows.length>0,message:rows.length?"":"لا تتوفر قائمة لاعبين محدثة من المصدر."});
  }
  return json(res,400,{error:"طلب غير معروف."});
 }catch{return json(res,502,{error:"تعذر تحميل قائمة اللاعبين من المصدر الرياضي الآن."})}
}
