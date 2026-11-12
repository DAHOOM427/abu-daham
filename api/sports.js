import {valid,json} from "../lib/auth.js";

const BASE="https://www.thesportsdb.com/api/v1/json/123";
const LEAGUES={
  spl:{id:"4668",name:"الدوري السعودي",sport:"Soccer"},
  epl:{id:"4328",name:"الدوري الإنجليزي",sport:"Soccer"},
  laliga:{id:"4335",name:"الدوري الإسباني",sport:"Soccer"},
  seriea:{id:"4332",name:"الدوري الإيطالي",sport:"Soccer"},
  bundesliga:{id:"4331",name:"الدوري الألماني",sport:"Soccer"},
  ucl:{id:"4480",name:"دوري أبطال أوروبا",sport:"Soccer"},
  nba:{id:"4387",name:"NBA لكرة السلة",sport:"Basketball"}
};
function currentSeason(){
  const now=new Date();
  const year=now.getUTCFullYear()-(now.getUTCMonth()<6?1:0);
  return year+"-"+(year+1);
}
async function get(path){
  const response=await fetch(BASE+"/"+path,{
    headers:{Accept:"application/json"},
    signal:AbortSignal.timeout(12000)
  });
  if(!response.ok)throw new Error("Sports provider returned "+response.status);
  return response.json();
}
function mapEvent(x){
  return {
    id:String(x.idEvent||""),
    home:String(x.strHomeTeam||""),
    away:String(x.strAwayTeam||""),
    homeScore:x.intHomeScore==null?null:Number(x.intHomeScore),
    awayScore:x.intAwayScore==null?null:Number(x.intAwayScore),
    date:String(x.dateEvent||""),
    time:String(x.strTime||x.strTimestamp||""),
    status:String(x.strStatus||x.strProgress||""),
    venue:String(x.strVenue||""),
    league:String(x.strLeague||"")
  };
}
function mapStanding(x){
  return {
    rank:Number(x.intRank||0),
    team:String(x.strTeam||""),
    badge:String(x.strBadge||""),
    played:Number(x.intPlayed||0),
    wins:Number(x.intWin||0),
    draws:Number(x.intDraw||0),
    losses:Number(x.intLoss||0),
    goalsFor:Number(x.intGoalsFor||0),
    goalsAgainst:Number(x.intGoalsAgainst||0),
    goalDifference:Number(x.intGoalDifference||0),
    points:Number(x.intPoints||0)
  };
}
export default async function handler(req,res){
  if(req.method!=="GET")return json(res,405,{error:"Method not allowed"});
  if(!valid(req))return json(res,401,{error:"يلزم تسجيل الدخول أولاً."});
  const key=String(req.query?.league||"spl");
  const view=String(req.query?.view||"next");
  const league=LEAGUES[key];
  if(!league)return json(res,400,{error:"البطولة غير مدعومة."});
  if(!["next","recent","table"].includes(view))return json(res,400,{error:"نوع العرض غير صحيح."});
  if(view==="table"&&league.sport!=="Soccer"){
    return json(res,200,{league:league.name,view,season:currentSeason(),table:[],message:"جدول الترتيب غير متاح لهذا النوع في المصدر المجاني."});
  }
  try{
    const season=currentSeason();
    let data;
    if(view==="next")data=await get("eventsnextleague.php?id="+league.id);
    else if(view==="recent")data=await get("eventspastleague.php?id="+league.id);
    else data=await get("lookuptable.php?l="+league.id+"&s="+season);
    if(view==="table"){
      const rows=Array.isArray(data.table)?data.table:[];
      return json(res,200,{
        league:league.name,view,season,
        table:rows.map(mapStanding).filter(x=>x.team)
      });
    }
    const rows=Array.isArray(data.events)?data.events:[];
    return json(res,200,{
      league:league.name,view,season,
      events:rows.map(mapEvent).filter(x=>x.home&&x.away),
      source:"TheSportsDB",
      updatedAt:new Date().toISOString()
    });
  }catch(error){
    return json(res,502,{error:"تعذر جلب بيانات الرياضة حالياً. جرّب التحديث بعد قليل."});
  }
}
