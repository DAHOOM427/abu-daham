import {valid,json} from "../lib/auth.js";

const SOURCES=[
 {id:"free-tv",label:"Free-TV",url:"https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8"},
 {id:"iptv-org",label:"IPTV-org",url:"https://iptv-org.github.io/iptv/index.m3u"}
];
const MAX_CHANNELS=10000;
const TTL_MS=1000*60*30;
let cache={time:0,data:null};
function field(line,name){
 const match=new RegExp("(?:^|\\s)"+name+'="([^"]*)"', "i").exec(line);
 return match?.[1]||"";
}
function safeUrl(value,extensions=false){
 try{
  const url=new URL(String(value||"").trim());
  if(url.protocol!=="https:"||url.username||url.password)return "";
  if(!/^[a-z0-9.-]+$/i.test(url.hostname))return "";
  if(extensions&&!/\.m3u8(?:$|[?#])/i.test(url.href))return "";
  return url.href;
 }catch{return ""}
}
function category(name,group){
 const text=(name+" "+group).toLowerCase();
 if(/news|noticias|actualité|nachrichten|الأخبار|أخبار|العربية|الجزيرة|cnn|euronews|dw /i.test(text))return "news";
 if(/sport|deport|football|futbol|soccer|basket|رياضي|رياضة|كورة|كرة القدم/i.test(text))return "sports";
 if(/kids|children|cartoon|animation|nickelodeon|baby|أطفال|كرتون/i.test(text))return "kids";
 if(/document|science|nature|discovery|wildlife|history|وثائق|علوم|ناسا/i.test(text))return "documentary";
 if(/quran|sunnah|islam|قرآن|سنة|حرم|مكة|المدينة/i.test(text))return "islamic";
 return "global";
}
function parse(text,source){
 if(typeof text!=="string"||!text.startsWith("#EXTM3U"))throw Error("Invalid playlist");
 const lines=text.split(/\r?\n/),items=[],dedupe=new Set();
 for(let i=0;i<lines.length;i++){
  const line=lines[i].trim();
  if(!line.startsWith("#EXTINF:"))continue;
  let link="";
  for(let next=i+1;next<Math.min(i+5,lines.length);next++){
   const test=lines[next].trim();
   if(test.startsWith("#EXTINF:"))break;
   if(test&&test[0]!=="#"){link=test;i=next;break}
  }
  const url=safeUrl(link,true);
  if(!url||dedupe.has(url))continue;
  const title=line.substring(line.indexOf(",")+1).trim()||field(line,"tvg-name");
  if(!title)continue;
  const group=field(line,"group-title");
  if(/adult|xxx|porn|onlyfans|18\+/i.test(title+" "+group))continue;
  if(/^VOD\b|on.demand|movie\s*files/i.test(group))continue;
  const logo=safeUrl(field(line,"tvg-logo"));
  const country=field(line,"tvg-country").slice(0,16);
  const id=String(items.length+1);
  items.push({id:source.id+"-"+id,name:title.replace(/[ⓈⓎⒼⓉ]/g,"").trim().slice(0,100),category:category(title,group),emoji:"📡",group:group.slice(0,65),country,host:new URL(url).hostname,stream:url,logo,quality:/Ⓢ/.test(title)?"SD":/1080|4k|2160|hd/i.test(title)?"HD / وفق المصدر":"حسب المصدر",source:source.label+" public stream directory",checkedServer:false});
  dedupe.add(url);
  if(items.length>=12000)break;
 }
 return items;
}
async function getChannels(){
 if(cache.data&&Date.now()-cache.time<TTL_MS)return cache.data;
 const results=await Promise.allSettled(SOURCES.map(async source=>{
  const response=await fetch(source.url,{headers:{Accept:"text/plain"},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error("Unavailable "+source.id);
  const content=await response.text();
  if(content.length>6500000)throw new Error("Playlist too large");
  return parse(content,source);
 }));
 const items=[],seen=new Set(),sourceCounts={};
 for(let i=0;i<results.length;i++){
  const result=results[i],source=SOURCES[i];
  if(result.status!=="fulfilled"){sourceCounts[source.id]="unavailable";continue}
  sourceCounts[source.id]=result.value.length;
  for(const ch of result.value){
   if(seen.has(ch.stream))continue;
   // Paid and obviously restricted TV channel names must never be mislabeled free.
   if(/\b(?:beIN|Sky Sports|DAZN|OSN|Eleven Sports|SuperSport Premium|TNT Sports)\b/i.test(ch.name))continue;
   items.push(ch);seen.add(ch.stream);
   if(items.length>=MAX_CHANNELS)break;
  }
  if(items.length>=MAX_CHANNELS)break;
 }
 if(items.length<10)throw new Error("No free channels returned");
 items.sort((a,b)=>{
  const rank=x=>(x.country==='SA'?0:x.country==='AE'?1:x.country==='EG'?2:x.country==='KW'?3:x.category==='news'?4:x.category==='islamic'?5:x.category==='sports'?6:7);
  return rank(a)-rank(b);
 });
 cache={time:Date.now(),data:{channels:items,sourceCounts}};
 return cache.data;
}
export default async function handler(req,res){
 if(req.method!=="GET")return json(res,405,{error:"Method not allowed"});
 if(!valid(req))return json(res,401,{error:"يلزم تسجيل الدخول أولاً."});
 try{
  const result=await getChannels();
  const u=new URL(req.url||"/api/live-tv","https://abu-daham.vercel.app");
  const offset=Math.min(Math.max(Number(u.searchParams.get("offset"))||0,0),MAX_CHANNELS);
  const limit=Math.min(Math.max(Number(u.searchParams.get("limit"))||100,1),160);
  const q=String(u.searchParams.get("q")||"").trim().toLocaleLowerCase().slice(0,90);
  const category=String(u.searchParams.get("category")||"").slice(0,40);
  const filtered=result.channels.filter(ch=>(!category||category==="all"||ch.category===category)&&(!q||[ch.name,ch.group,ch.country,ch.host].join(" ").toLocaleLowerCase().includes(q)));
  return json(res,200,{sources:SOURCES.map(s=>({id:s.id,url:s.url})),sourceCounts:result.sourceCounts,total:result.channels.length,count:filtered.length,offset,limit,hasMore:offset+limit<filtered.length,channels:filtered.slice(offset,offset+limit),updatedAt:new Date(cache.time).toISOString(),notice:"روابط البث مدرجة من قوائم عامة ومقسمة إلى صفحات للتصفح السريع، ولا نضمن تشغيلها جميعًا أو الترخيص بإعادة عرضها داخل الموقع."});
 }catch(error){
  return json(res,502,{error:"قائمة القنوات المجانية غير متاحة حاليًا؛ جرّب التحديث بعد قليل.",reason:"upstream-unavailable"});
 }
}
