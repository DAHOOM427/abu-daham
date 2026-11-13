import {valid,json} from "../lib/auth.js";

const PLAYLIST_URL="https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8";
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
function parse(text){
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
  items.push({id:"free-tv-"+id,name:title.replace(/[ⓈⓎⒼⓉ]/g,"").trim().slice(0,100),category:category(title,group),emoji:"📡",group:group.slice(0,65),country,host:new URL(url).hostname,stream:url,logo,quality:/Ⓢ/.test(title)?"SD":/1080|4k|2160|hd/i.test(title)?"HD / وفق المصدر":"حسب المصدر",source:"Free-TV public FTA list"});
  dedupe.add(url);
  if(items.length>=4000)break;
 }
 return items;
}
async function getChannels(){
 if(cache.data&&Date.now()-cache.time<TTL_MS)return cache.data;
 const response=await fetch(PLAYLIST_URL,{headers:{Accept:"text/plain"},signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error("playlist unavailable");
 const content=await response.text();
 if(content.length>6000000)throw Error("playlist too large");
 const items=parse(content);
 if(items.length<10)throw Error("playlist empty");
 cache={time:Date.now(),data:items};
 return items;
}
export default async function handler(req,res){
 if(req.method!=="GET")return json(res,405,{error:"Method not allowed"});
 if(!valid(req))return json(res,401,{error:"يلزم تسجيل الدخول أولاً."});
 try{
  const items=await getChannels();
  return json(res,200,{source:"Free-TV/IPTV",sourceUrl:"https://github.com/Free-TV/IPTV",count:items.length,channels:items,updatedAt:new Date(cache.time).toISOString(),notice:"روابط بث عامة مدرجة بوصفها قنوات مجانية في القائمة الأصلية؛ بعض الروابط قد تكون محجوبة أو لا تسمح بالتشغيل داخل المتصفح. لم تُختبر كل قناة بشكل مستقل."});
 }catch(error){
  return json(res,502,{error:"قائمة القنوات المجانية غير متاحة حاليًا؛ جرّب التحديث بعد قليل.",reason:"upstream-unavailable"});
 }
}
