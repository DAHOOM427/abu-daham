import {valid,json} from "../lib/auth.js";

const FOOTBALL_KEY=process.env.API_FOOTBALL_KEY||process.env.APISPORTS_KEY||"";
const FOOTBALL_BASE="https://v3.football.api-sports.io";
const TSD_BASE="https://www.thesportsdb.com/api/v1/json/123";
const localCache=new Map();
const FALLBACK_COMPETITIONS=[
 {id:"spl",providerId:"4668",name:"Saudi Pro League",nameAr:"دوري روشن السعودي",country:"Saudi Arabia",sport:"Soccer",season:"2026-2027",logo:""},
 {id:"epl",providerId:"4328",name:"English Premier League",nameAr:"الدوري الإنجليزي الممتاز",country:"England",sport:"Soccer",season:"2026-2027",logo:""},
 {id:"laliga",providerId:"4335",name:"Spanish La Liga",nameAr:"الدوري الإسباني",country:"Spain",sport:"Soccer",season:"2026-2027",logo:""},
 {id:"seriea",providerId:"4332",name:"Italian Serie A",nameAr:"الدوري الإيطالي",country:"Italy",sport:"Soccer",season:"2026-2027",logo:""},
 {id:"bundesliga",providerId:"4331",name:"German Bundesliga",nameAr:"الدوري الألماني",country:"Germany",sport:"Soccer",season:"2026-2027",logo:""},
 {id:"ucl",providerId:"4480",name:"UEFA Champions League",nameAr:"دوري أبطال أوروبا",country:"Europe",sport:"Soccer",season:"2026-2027",logo:""},
 {id:"worldcup",providerId:"4429",name:"FIFA World Cup",nameAr:"كأس العالم",country:"World",sport:"Soccer",season:"2026",logo:""},
 {id:"clubworldcup",providerId:"4503",name:"FIFA Club World Cup",nameAr:"كأس العالم للأندية",country:"World",sport:"Soccer",season:"2025",logo:""},
 {id:"afc_elite",providerId:"4719",name:"AFC Champions League Elite",nameAr:"دوري أبطال آسيا للنخبة",country:"Asia",sport:"Soccer",season:"2026-2027",logo:""},
 {id:"afc_two",providerId:"4804",name:"AFC Champions League Two",nameAr:"دوري أبطال آسيا 2",country:"Asia",sport:"Soccer",season:"2026-2027",logo:""},
 {id:"nba",providerId:"4387",name:"NBA",nameAr:"دوري كرة السلة الأمريكي",country:"USA",sport:"Basketball",season:"2026-2027",logo:""}
];
const CLUBS_AR={
 "al hilal":"الهلال","al-hilal":"الهلال","al nassr":"النصر","al-nassr":"النصر",
 "al ahli":"الأهلي","al-ahli":"الأهلي","al ittihad":"الاتحاد","al-ittihad":"الاتحاد",
 "al shabab":"الشباب","al-shabab":"الشباب","al ettifaq":"الاتفاق","al fateh":"الفتح",
 "al qadsiah":"القادسية","al taawoun":"التعاون","al wehda":"الوحدة","damac":"ضمك",
 "real madrid":"ريال مدريد","barcelona":"برشلونة","atletico madrid":"أتلتيكو مدريد",
 "manchester city":"مانشستر سيتي","manchester united":"مانشستر يونايتد",
 "liverpool":"ليفربول","arsenal":"آرسنال","chelsea":"تشيلسي","tottenham":"توتنهام",
 "newcastle":"نيوكاسل يونايتد","bayern munich":"بايرن ميونخ",
 "borussia dortmund":"بوروسيا دورتموند","inter":"إنتر ميلان","inter milan":"إنتر ميلان",
 "ac milan":"إيه سي ميلان","juventus":"يوفنتوس","paris saint germain":"باريس سان جيرمان",
 "psg":"باريس سان جيرمان","napoli":"نابولي","roma":"روما","ajax":"أياكس",
 "benfica":"بنفيكا","porto":"بورتو","sporting cp":"سبورتينغ لشبونة",
 "celtic":"سيلتيك","rangers":"رينجرز","flamengo":"فلامنغو","boca juniors":"بوكا جونيورز",
 "river plate":"ريفر بليت"
};
const COMPETITIONS_AR={
 "saudi pro league":"دوري روشن السعودي","saudi pro league":"دوري روشن السعودي",
 "english premier league":"الدوري الإنجليزي الممتاز","premier league":"الدوري الإنجليزي الممتاز",
 "la liga":"الدوري الإسباني","laliga":"الدوري الإسباني","serie a":"الدوري الإيطالي",
 "bundesliga":"الدوري الألماني","ligue 1":"الدوري الفرنسي","uefa champions league":"دوري أبطال أوروبا",
 "uefa europa league":"الدوري الأوروبي","uefa conference league":"دوري المؤتمر الأوروبي",
 "fifa world cup":"كأس العالم","world cup":"كأس العالم",
 "fifa club world cup":"كأس العالم للأندية","afc champions league elite":"دوري أبطال آسيا للنخبة",
 "afc champions league two":"دوري أبطال آسيا 2","nba":"دوري كرة السلة الأمريكي"
};
function todayInRiyadh(offset=0){
 const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(Date.now()+offset*86400000));
 const o=Object.fromEntries(parts.map(p=>[p.type,p.value]));
 return o.year+"-"+o.month+"-"+o.day;
}
function seasonYear(value){
 const n=Number(value);
 return Number.isInteger(n)&&n>=1900&&n<=2100?n:new Date().getUTCFullYear();
}
function toArabicClub(name){return CLUBS_AR[String(name||"").toLowerCase()]||String(name||"");}
function toArabicCompetition(name){return COMPETITIONS_AR[String(name||"").toLowerCase()]||String(name||"");}
async function requestJson(url,headers={}){
 const response=await fetch(url,{headers:{Accept:"application/json",...headers},signal:AbortSignal.timeout(14000)});
 if(!response.ok)throw new Error("Sports provider returned "+response.status);
 const data=await response.json();
 if(data&&data.errors&&Object.keys(data.errors).length)throw new Error("Sports provider rejected request");
 return data;
}
async function cached(key,ttl,loader){
 const now=Date.now(),hit=localCache.get(key);
 if(hit&&now-hit.at<ttl)return hit.value;
 const value=await loader();
 localCache.set(key,{at:now,value});
 if(localCache.size>120){for(const [k,v] of localCache)if(now-v.at>3600000)localCache.delete(k);}
 return value;
}
function queryUrl(base,path,params){
 const url=new URL(base+path);
 for(const [k,v] of Object.entries(params||{}))if(v!==undefined&&v!==null&&String(v)!=="")url.searchParams.set(k,String(v));
 return url.toString();
}
async function football(path,params,ttl=60000){
 if(!FOOTBALL_KEY)throw new Error("API_FOOTBALL_KEY is not configured");
 const url=queryUrl(FOOTBALL_BASE,path,params);
 return cached("af:"+url,ttl,()=>requestJson(url,{"x-apisports-key":FOOTBALL_KEY}));
}
function mapCompetition(row){
 const l=row.league||{},c=row.country||{},seasons=Array.isArray(row.seasons)?row.seasons:[];
 const current=seasons.find(x=>x.current)||seasons[seasons.length-1]||{};
 return {
  id:String(l.id||""),providerId:String(l.id||""),name:String(l.name||""),
  nameAr:toArabicCompetition(l.name),country:String(c.name||""),
  countryCode:String(c.code||""),sport:"Soccer",type:String(l.type||"league"),
  logo:String(l.logo||""),season:Number(current.year)||new Date().getUTCFullYear(),
  current:Boolean(current.current),coverage:current.coverage||{}
 };
}
function mapFixture(x){
 const f=x.fixture||{},l=x.league||{},h=x.teams?.home||{},a=x.teams?.away||{},g=x.goals||{};
 return {
  id:String(f.id||""),date:String(f.date||""),
  timestamp:Number(f.timestamp||0),timezone:String(f.timezone||"Asia/Riyadh"),
  status:String(f.status?.short||""),statusLong:String(f.status?.long||""),
  elapsed:f.status?.elapsed==null?null:Number(f.status.elapsed),
  home:{id:String(h.id||""),name:String(h.name||""),nameAr:toArabicClub(h.name),logo:String(h.logo||""),winner:h.winner},
  away:{id:String(a.id||""),name:String(a.name||""),nameAr:toArabicClub(a.name),logo:String(a.logo||""),winner:a.winner},
  homeScore:g.home==null?null:Number(g.home),awayScore:g.away==null?null:Number(g.away),
  league:{id:String(l.id||""),name:String(l.name||""),nameAr:toArabicCompetition(l.name),logo:String(l.logo||""),country:String(l.country||""),season:Number(l.season)||null,round:String(l.round||"")},
  venue:String(f.venue?.name||""),referee:String(f.referee||"")
 };
}
function mapStanding(row){
 const team=row.team||{},all=row.all||{},goals=row.goals||{};
 return {
  rank:Number(row.rank||0),team:String(team.name||""),teamAr:toArabicClub(team.name),badge:String(team.logo||""),
  played:Number(all.played||0),wins:Number(all.win||0),draws:Number(all.draw||0),losses:Number(all.lose||0),
  goalsFor:Number(goals.for||0),goalsAgainst:Number(goals.against||0),goalDifference:Number(row.goalsDiff||0),
  points:Number(row.points||0),form:String(row.form||""),description:String(row.description||"")
 };
}
function mapTeam(row){
 const t=row.team||{};
 return {id:String(t.id||""),name:String(t.name||""),nameAr:toArabicClub(t.name),country:String(t.country||""),logo:String(t.logo||""),founded:t.founded||null,venue:row.venue?.name||""};
}
async function footballHandler(req,res,action){
 const q=req.query||{};
 const league=String(q.league||"");
 const selectedStatic=FALLBACK_COMPETITIONS.find(x=>x.id===league||x.providerId===league);
 if(selectedStatic&&selectedStatic.sport!=="Soccer")return fallbackHandler(req,res,action);
 const season=seasonYear(q.season);
 if(action==="competitions"){
  const search=String(q.search||"").trim().slice(0,80);
  const params={country:String(q.country||"").trim()};
  if(search)params.search=search;else if(q.all!=="1")params.current="true";
  const d=await football("/leagues",params,3600000);
  const competitions=(d.response||[]).map(mapCompetition);
  const includeBasketball=!params.search||/basket|nba|كرة/i.test(params.search);
  if(includeBasketball)competitions.push(...FALLBACK_COMPETITIONS.filter(x=>x.sport==="Basketball"));
  return json(res,200,{provider:"API-Football",completeCatalog:true,competitions,updatedAt:new Date().toISOString()});
 }
 if(action==="matches"){
  const view=String(q.view||"today");
  const params={timezone:"Asia/Riyadh"};
  if(view==="live")params.live="all";
  else if(view==="next"&&league){params.league=league;params.season=season;params.next="20";}
  else if(view==="recent"&&league){params.league=league;params.season=season;params.last="20";}
  else if(view==="results"){params.date=String(q.date||todayInRiyadh());params.status="FT-AET-PEN";}
  else if(view==="tomorrow")params.date=String(q.date||todayInRiyadh(1));
  else params.date=String(q.date||todayInRiyadh());
  if(league){params.league=league;if(!params.season&&view!=="live")params.season=season;}
  if(q.team)params.team=String(q.team);
  const d=await football("/fixtures",params,view==="live"?300000:900000);
  const fixtures=(d.response||[]).map(mapFixture);
  return json(res,200,{provider:"API-Football",view,fixtures,updatedAt:new Date().toISOString(),quota:d.paging||null});
 }
 if(action==="standings"){
  if(!league)return json(res,400,{error:"اختر بطولة أولاً لعرض الترتيب."});
  const d=await football("/standings",{league,season},3600000);
  const groups=d.response?.[0]?.league?.standings||[];
  const table=groups.flat().map(mapStanding);
  return json(res,200,{provider:"API-Football",season,table,updatedAt:new Date().toISOString()});
 }
 if(action==="teams"){
  const search=String(q.search||"").trim();
  const params={};
  if(search.length>=3)params.search=search;
  else if(league){params.league=league;params.season=season;}
  else return json(res,400,{error:"اكتب ثلاثة أحرف على الأقل أو اختر بطولة."});
  const d=await football("/teams",params,search?3600000:86400000);
  return json(res,200,{provider:"API-Football",teams:(d.response||[]).map(mapTeam),updatedAt:new Date().toISOString()});
 }
 return json(res,400,{error:"طلب رياضي غير معروف."});
}
function mapTsdEvent(x){
 const utcValue=String(x.strTimestamp||"").trim();
 const iso=utcValue?(utcValue+(utcValue.endsWith("Z")||/[+-]\d{2}:?\d{2}$/.test(utcValue)?"":"Z")):(String(x.dateEvent||"")+(x.strTime?"T"+String(x.strTime).slice(0,8)+"Z":"T00:00:00Z"));
 const dt=new Date(iso);
 const isValid=!Number.isNaN(dt.getTime());
 const riyadhDate=isValid?new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Riyadh",year:"numeric",month:"2-digit",day:"2-digit"}).format(dt):String(x.dateEvent||"");
 return {
  id:String(x.idEvent||""),date:riyadhDate,time:String(x.strTime||""),timestamp:isValid?dt.toISOString():"",
  status:String(x.strStatus||x.strProgress||""),elapsed:null,
  home:{id:String(x.idHomeTeam||""),name:String(x.strHomeTeam||""),nameAr:toArabicClub(x.strHomeTeam),logo:String(x.strHomeTeamBadge||"")},
  away:{id:String(x.idAwayTeam||""),name:String(x.strAwayTeam||""),nameAr:toArabicClub(x.strAwayTeam),logo:String(x.strAwayTeamBadge||"")},
  homeScore:x.intHomeScore==null?null:Number(x.intHomeScore),awayScore:x.intAwayScore==null?null:Number(x.intAwayScore),
  league:{id:String(x.idLeague||""),name:String(x.strLeague||""),nameAr:toArabicCompetition(x.strLeague),logo:String(x.strLeagueBadge||"")},
  venue:String(x.strVenue||"")
 };
}
function mapTsdStanding(x){
 return {rank:Number(x.intRank||0),team:String(x.strTeam||""),teamAr:toArabicClub(x.strTeam),badge:String(x.strTeamBadge||""),played:Number(x.intPlayed||0),wins:Number(x.intWin||0),draws:Number(x.intDraw||0),losses:Number(x.intLoss||0),goalsFor:Number(x.intGoalsFor||0),goalsAgainst:Number(x.intGoalsAgainst||0),goalDifference:Number(x.intGoalDifference||0),points:Number(x.intPoints||0)};
}
async function tsd(path,params={},ttl=900000){
 const url=queryUrl(TSD_BASE,path,params);
 return cached("tsd:"+url,ttl,()=>requestJson(url));
}
async function fallbackHandler(req,res,action){
 const q=req.query||{},id=String(q.league||"epl");
 const selected=FALLBACK_COMPETITIONS.find(x=>x.id===id)||FALLBACK_COMPETITIONS.find(x=>x.providerId===id);
 if(action==="competitions"){
  const search=String(q.search||"").toLowerCase();
  const items=FALLBACK_COMPETITIONS.filter(x=>!search||x.name.toLowerCase().includes(search)||x.nameAr.includes(search)||x.country.toLowerCase().includes(search));
  return json(res,200,{provider:"TheSportsDB free",completeCatalog:false,liveAvailable:false,competitions:items,updatedAt:new Date().toISOString(),message:"التغطية المجانية محدودة بقائمة البطولات الظاهرة."});
 }
 if(action==="teams"){
  const search=String(q.search||"").trim();
  let d;
  if(search.length>=3)d=await tsd("/searchteams.php",{t:search},3600000);
  else if(selected)d=await tsd("/search_all_teams.php",{l:selected.name.replace(/ /g,"_")},86400000);
  else return json(res,400,{error:"اكتب اسم النادي أو اختر بطولة."});
  const teams=(d.teams||[]).map(x=>({id:String(x.idTeam||""),name:String(x.strTeam||""),nameAr:toArabicClub(x.strTeam),country:String(x.strCountry||""),logo:String(x.strBadge||""),founded:x.intFormedYear||null,venue:String(x.strStadium||"")}));
  return json(res,200,{provider:"TheSportsDB free",teams,limited:true});
 }
 if(!selected)return json(res,400,{error:"البطولة غير متاحة في المصدر المجاني."});
 const view=String(q.view||"today");
 if(q.team&&action==="matches"){
  const endpoint=view==="recent"||view==="results"?"eventslast.php":"eventsnext.php";
  const d=await tsd("/"+endpoint,{id:String(q.team)},900000);
  return json(res,200,{provider:"TheSportsDB free",view,fixtures:(d.results||d.events||[]).map(mapTsdEvent),liveAvailable:false});
 }
 if(view==="live")return json(res,200,{provider:"TheSportsDB free",view,fixtures:[],liveAvailable:false,message:"المصدر المجاني لا يقدم لوحة نتائج مباشرة سريعة. تظهر المواعيد والنتائج السابقة؛ تفعيل النتائج الحية الشاملة يحتاج مزودًا آخر."});
 if(!q.league&&action==="matches"){
  if(view==="standings")return json(res,400,{error:"اختر بطولة لعرض جدول الترتيب."});
  const choices=FALLBACK_COMPETITIONS.filter(x=>["spl","epl","laliga","seriea","bundesliga","ucl","afc_elite","nba"].includes(x.id));
  const endpoint=view==="recent"||view==="results"?"eventspastleague.php":"eventsnextleague.php";
  const results=await Promise.allSettled(choices.map(x=>tsd("/"+endpoint,{id:x.providerId},view==="recent"||view==="results"?900000:3600000)));
  let fixtures=[];
  results.forEach((r,i)=>{if(r.status==="fulfilled")fixtures.push(...(r.value.events||[]).map(x=>({...mapTsdEvent(x),league:{id:String(x.idLeague||choices[i].providerId),name:choices[i].name,nameAr:choices[i].nameAr,logo:x.strLeagueBadge||choices[i].logo,country:choices[i].country}})))});
  if(view==="today"||view==="tomorrow"){
   const target=todayInRiyadh(view==="tomorrow"?1:0);
   fixtures=fixtures.filter(x=>!x.date||x.date===target);
  }
  return json(res,200,{provider:"TheSportsDB free",view,fixtures,liveAvailable:false,updatedAt:new Date().toISOString(),message:"نتائج المصدر المجاني محدودة بعدد البطولات واللقاءات المتاحة."});
 }
 if(action==="standings"||view==="table"||view==="standings"){
  const d=await tsd("/lookuptable.php",{l:selected.providerId,s:String(q.season||selected.season)},3600000);
  return json(res,200,{provider:"TheSportsDB free",table:(d.table||[]).map(mapTsdStanding),season:q.season||selected.season,liveAvailable:false});
 }
 const endpoint=view==="recent"||view==="results"?"eventspastleague.php":"eventsnextleague.php";
 const d=await tsd("/"+endpoint,{id:selected.providerId},view==="recent"||view==="results"?900000:3600000);
 let fixtures=(d.events||[]).map(mapTsdEvent);
 if(view==="today"||view==="tomorrow"){
  const target=todayInRiyadh(view==="tomorrow"?1:0);
  fixtures=fixtures.filter(x=>!x.date||x.date===target);
 }
 return json(res,200,{provider:"TheSportsDB free",view,fixtures,season:q.season||selected.season,updatedAt:new Date().toISOString(),liveAvailable:false});
}
export default async function handler(req,res){
 if(req.method!=="GET")return json(res,405,{error:"Method not allowed"});
 if(!valid(req))return json(res,401,{error:"يلزم تسجيل الدخول أولاً."});
 const q=req.query||{};
 const view=String(q.view||"next");
 const action=String(q.action||(view==="table"||view==="standings"?"standings":"matches"));
 try{
  if(FOOTBALL_KEY)return await footballHandler(req,res,action);
  return await fallbackHandler(req,res,action);
 }catch(error){
  const message=error?.message==="API_FOOTBALL_KEY is not configured"?"":"تعذر جلب بيانات الرياضة حالياً. تحقق من مفتاح المصدر أو حاول لاحقاً.";
  return json(res,502,{error:message||"تعذر جلب بيانات الرياضة حالياً. تحقق من إعدادات مزوّد النتائج.",provider:FOOTBALL_KEY?"API-Football":"TheSportsDB free"});
 }
}
